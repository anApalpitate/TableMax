import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  discover,
  unitsFor,
  buildUnit,
  validateInputs,
  inventory,
  json,
} from '../build/module-build.mjs';
import {
  isDirectExecution,
  assertWorkspaceRoot,
} from '../shared/workspace-root.mjs';
export {
  sha256,
  canonical,
  zipFiles,
  packageCodeDirectory,
  createSignedCatalog,
} from './game-package-format.mjs';
import {
  sha256,
  canonical,
  zipFiles,
  createBlob,
  createSignedCatalog,
} from './game-package-format.mjs';
export async function packageGames({
  gameId,
  out = 'artifacts/game-packages/v1.0.6',
  keyPath = process.env.TABLEMAX_GAME_SIGNING_KEY,
  releaseTag = 'v1.0.6',
} = {}) {
  if (!keyPath)
    throw new Error(
      'Signing key path required (--key or TABLEMAX_GAME_SIGNING_KEY)',
    );
  out = resolve(out);
  await mkdir(out, { recursive: true });
  const modules = (await discover(gameId)).filter(
    (item) => !item.internal && (!gameId || item.id === gameId),
  );
  if (!modules.length) throw new Error('Unknown game');
  const units = (await unitsFor(modules)).filter((unit) => unit.module),
    results = [];
  for (const unit of units) {
    const result = await buildUnit(unit);
    results.push(result);
    console.log(
      result.id +
        ': ' +
        (result.cached ? 'cache hit' : result.durationMs + 'ms'),
    );
  }
  for (const result of results) await validateInputs(result);
  const blobs = [],
    releases = [];
  for (const module of modules) {
    const codeRecords = [];
    const builtModule = {
      ...module,
      entries: {
        rules: `rules/${module.id}.cjs`,
        bot: `bots/${module.id}.cjs`,
        web: 'web/entry.js',
      },
    };
    for (const part of ['rules', 'bot', 'web']) {
      const result = results.find(
        (item) => item.id === `game-${module.id}-${part}`,
      );
      for (const file of result.files)
        codeRecords.push({
          path: `${part === 'bot' ? 'bots' : part}/${file.path}`,
          data: await readFile(join(result.directory, 'files', file.path)),
        });
    }
    builtModule.styles = codeRecords
      .filter((file) => file.path.endsWith('.css'))
      .map((file) => file.path);
    const code = await createBlob('code', codeRecords, out, releaseTag);
    blobs.push(code);
    const resourceUnits = {};
    for (const part of ['common', 'variant']) {
      const result = results.find(
        (item) => item.id === `game-${module.id}-resources-${part}`,
      );
      if (!result) continue;
      const records = await Promise.all(
        result.files.map(async (file) => ({
          path: file.path,
          data: await readFile(join(result.directory, 'files', file.path)),
        })),
      );
      resourceUnits[part] = await createBlob(
        'resources',
        records,
        out,
        releaseTag,
      );
      blobs.push(resourceUnits[part]);
    }
    for (const variant of module.variants?.length
      ? module.variants
      : [{ id: undefined }]) {
      const resources = [
        resourceUnits.common,
        ...(variant.id === 'expansion' && resourceUnits.variant
          ? [resourceUnits.variant]
          : []),
      ].filter(Boolean);
      const resourceMap = Object.fromEntries(
        resources.flatMap((blob) =>
          blob.files.map((file) => [
            `${module.id}/${file.path}`,
            { blobId: blob.id, path: file.path },
          ]),
        ),
      );
      const body = {
        gameId: module.id,
        variantId: variant.id,
        module: builtModule,
        code: code.id,
        resources: resources.map((blob) => blob.id),
        resourceMap,
        releaseTag,
      };
      body.offlineAsset = `TableMax-${module.id}${variant.id ? '-' + variant.id : ''}-${releaseTag}-${sha256(canonical(body))}-offline.zip`;
      const release = { releaseId: sha256(canonical(body)), ...body };
      const closure = [code, ...resources],
        download = closure.reduce((n, blob) => n + blob.archiveBytes, 0),
        installed = closure.reduce((n, blob) => n + blob.installedBytes, 0);
      if (download >= 64_000_000 || installed >= 64_000_000)
        throw new Error(
          `Gameplay package exceeds 64 MB: ${module.id}/${variant.id ?? ''}`,
        );
      releases.push(release);
      console.log(
        `${module.id}/${variant.id ?? ''}: download ${download}, installed ${installed} bytes${Math.max(download, installed) >= 48_000_000 ? ' [budget warning]' : ''}`,
      );
    }
  }
  const payload = {
    schemaVersion: 1,
    releases,
    blobs: [...new Map(blobs.map((blob) => [blob.id, blob])).values()],
  };
  const envelope = createSignedCatalog(payload, await readFile(keyPath));
  await writeFile(
    join(out, 'TableMax-game-catalog-v1.0.6.json'),
    JSON.stringify(envelope, null, 2) + '\n',
  );
  for (const release of releases) {
    const closure = [release.code, ...release.resources];
    const records = [
      { path: 'catalog.json', data: Buffer.from(JSON.stringify(envelope)) },
      {
        path: 'release.json',
        data: Buffer.from(JSON.stringify({ releaseId: release.releaseId })),
      },
    ];
    for (const id of closure) {
      const blob = payload.blobs.find((blob) => blob.id === id);
      records.push({
        path: `blobs/${id}.zip`,
        data: await readFile(join(out, blob.assetName)),
      });
    }
    const archive = zipFiles(records);
    if (archive.length >= 64_000_000)
      throw new Error('Offline package exceeds download gate');
    await writeFile(join(out, release.offlineAsset), archive);
  }
  await writeFile(
    join(out, 'build-record.json'),
    JSON.stringify(
      {
        version: (await json('package.json')).version,
        releaseTag,
        units: results.map(({ id, fingerprint, directory }) => ({
          id,
          fingerprint,
          directory,
        })),
        files: await inventory(out),
      },
      null,
      2,
    ) + '\n',
  );
  return envelope;
}
if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  const value = (name) =>
    process.argv
      .find((arg) => arg.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  try {
    await packageGames({
      gameId: value('game'),
      out: value('out'),
      keyPath: value('key'),
      releaseTag: value('tag') ?? 'v1.0.6',
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
