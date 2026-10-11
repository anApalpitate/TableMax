import { readFile, mkdir, writeFile, lstat } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { gameReleaseAssets } from './game-release-assets.mjs';
import { sha256 } from './game-package-format.mjs';
import { PROJECT_GAME_PUBLIC_KEY } from '../../apps/server/src/game-packages/project-public-key.ts';
import {
  GAME_PAGES_ROOT,
  gameAssetUrl,
  gameCatalogUrl,
} from '../../apps/server/src/game-packages/distribution.ts';
import {
  verifyCatalog,
  readZip,
} from '../../apps/server/src/game-packages/verification.ts';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
const html = (title, content) =>
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{max-width:900px;margin:40px auto;padding:0 20px;font:18px/1.7 system-ui;background:#fffdf3;color:#173b32}a{color:#206948}li{margin:16px 0;overflow-wrap:anywhere}</style><h1>${escape(title)}</h1>${content}</html>\n`;

/** Prepare a static directory only. Never enables Pages or invokes deployment. */
export async function preparePages({ directory, out, tag = 'v1.0.6' }) {
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(tag))
    throw new Error('Invalid Pages release directory');
  directory = resolve(directory);
  out = resolve(out);
  const nested = (parent, child) => {
    const path = relative(parent, child);
    return path === '' || (!path.startsWith('..') && !isAbsolute(path));
  };
  if (nested(directory, out) || nested(out, directory))
    throw new Error('Separate Pages output required');
  const assets = await gameReleaseAssets(directory, {
    publicKey: PROJECT_GAME_PUBLIC_KEY,
  });
  const catalog = JSON.parse(
    await readFile(
      join(directory, `TableMax-game-catalog-${tag}.json`),
      'utf8',
    ),
  );
  verifyCatalog(catalog, PROJECT_GAME_PUBLIC_KEY);
  for (const release of catalog.payload.releases) {
    const entries = readZip(
      await readFile(join(directory, release.offlineAsset)),
    );
    const dependencies = [release.code, ...release.resources];
    if (
      entries.size !== dependencies.length + 2 ||
      !entries.has('catalog.json') ||
      !entries.has('release.json')
    )
      throw new Error('Invalid complete offline package');
    const embedded = verifyCatalog(
      JSON.parse(entries.get('catalog.json').toString('utf8')),
      PROJECT_GAME_PUBLIC_KEY,
    );
    if (
      !embedded.releases.some((item) => item.releaseId === release.releaseId) ||
      JSON.parse(entries.get('release.json').toString('utf8')).releaseId !==
        release.releaseId
    )
      throw new Error('Offline release mismatch');
    for (const id of dependencies) {
      const blob = catalog.payload.blobs.find((item) => item.id === id);
      const bytes = entries.get(`blobs/${id}.zip`);
      if (!bytes || sha256(bytes) !== blob.archiveSha256)
        throw new Error('Offline dependency integrity mismatch');
    }
  }
  for (const blob of catalog.payload.blobs)
    if (blob.releaseTag !== tag)
      throw new Error('Prepare each referenced release directory separately');
  // Fail closed: a fresh output avoids deleting or silently overwriting old refs.
  try {
    await lstat(out);
    throw new Error(
      'Pages output already exists; use a fresh preparation directory',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(out, { recursive: true });
  const records = [];
  const put = async (path, bytes, url) => {
    const target = join(out, path);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, bytes);
    records.push({
      path: path.replaceAll('\\', '/'),
      bytes: Buffer.byteLength(bytes),
      sha256: sha256(bytes),
      ...(url ? { url } : {}),
    });
  };
  await put('.nojekyll', '');
  // GitHub Pages consumes this deployment marker and does not serve its dotfile URL.
  records.at(-1).deploymentOnly = true;
  for (const asset of assets) {
    if ((await lstat(asset.path)).isSymbolicLink())
      throw new Error('Pages source links forbidden');
    const isCatalog = asset.name === `TableMax-game-catalog-${tag}.json`;
    const path = isCatalog
      ? `games/${tag}/catalog.json`
      : `games/${tag}/packages/${asset.name}`;
    await put(
      path,
      await readFile(asset.path),
      isCatalog
        ? gameCatalogUrl(tag)
        : gameAssetUrl({ releaseTag: tag, assetName: asset.name }),
    );
  }
  const links = [];
  const displayed = new Set();
  for (const release of catalog.payload.releases) {
    const game = release.module.id;
    const variant = release.variantId ?? 'default';
    // Catalog order chooses the current version; historical references remain installable.
    const key = `${game}/${variant}`;
    if (displayed.has(key)) continue;
    displayed.add(key);
    if (![game, variant].every((part) => /^[a-z0-9][a-z0-9-]*$/.test(part)))
      throw new Error('Invalid game directory');
    const path = `games/${tag}/${game}/${variant}/index.html`;
    const title = `${release.module.catalog?.name ?? game} · ${variant}`;
    await put(
      path,
      html(
        title,
        `<p>发行引用：<code>${escape(release.releaseId)}</code></p><p><a href="../../packages/${escape(release.offlineAsset)}">下载完整离线玩法包</a></p><p>在电脑管理员的游戏包管理中导入；包内含完整依赖。签名与逐文件哈希由主机再次验证。</p>`,
      ),
    );
    links.push(`<li><a href="${path}">${escape(title)}</a></li>`);
  }
  await put(
    'index.html',
    html(
      'TableMax 游戏包目录',
      `<p>基础程序在 GitHub Release 下载。游戏安装完成后可离线游玩。</p><ul>${links.join('')}</ul><p><a href="games/${tag}/catalog.json">项目签名目录</a></p>`,
    ),
  );
  const bytes = records.reduce((sum, file) => sum + file.bytes, 0);
  if (bytes > 1_000_000_000)
    throw new Error('Pages site exceeds 1 GB published-site limit');
  for (const record of records) {
    const actual = await readFile(join(out, record.path));
    if (sha256(actual) !== record.sha256)
      throw new Error('Pages output integrity mismatch');
  }
  const report = {
    result: 'prepared-not-published',
    tag,
    root: GAME_PAGES_ROOT,
    directory: out,
    bytes,
    files: records,
    published: false,
  };
  // Audit stays outside the publicly served directory.
  const reportPath = resolve(
    out,
    '..',
    relative(resolve(out, '..'), out) + '-manifest.json',
  );
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  return { ...report, manifest: reportPath };
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  const option = (name) =>
    process.argv
      .find((arg) => arg.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const report = await preparePages({
    directory: option('packages') ?? 'artifacts/game-packages/v1.0.6',
    out: option('out') ?? `artifacts/pages/v1.0.6/prepared-${Date.now()}/site`,
    tag: option('tag') ?? 'v1.0.6',
  });
  console.log(
    JSON.stringify({
      result: report.result,
      bytes: report.bytes,
      files: report.files.length,
      directory: report.directory,
      manifest: report.manifest,
    }),
  );
}
