import { build as esbuild } from 'esbuild';
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  rename,
  rm,
  cp,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAuthorProject, inside } from './contract.mjs';

const media =
  /\.(png|jpg|jpeg|webp|svg|gif|avif|mp3|wav|flac|ogg|m4a|woff2?)$/i;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function buildAuthorProject(directory) {
  const { root, manifest, files } = await checkAuthorProject(directory);
  const output = resolve(root, 'out');
  const stage = resolve(root, `.tablemax/build-${randomUUID()}`);
  await mkdir(stage, { recursive: true });
  const resources = new Map();
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      files.map(async (path) => [
        relative(root, path).replaceAll('\\', '/'),
        hash(await readFile(path)),
      ]),
    ),
  );
  const pipelineSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
  let previous;
  try {
    previous = JSON.parse(
      await readFile(resolve(output, 'author-build.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const codeReused =
    previous?.pipelineSha256 === pipelineSha256 &&
    JSON.stringify(previous.inputs) === JSON.stringify(sourceHashes);
  const boundary = {
    name: 'tablemax-author-boundary',
    setup(build) {
      build.onResolve({ filter: /./ }, (args) => {
        const runtime = {
          react: 'react',
          'react-dom': 'react-dom',
          'react-dom/client': 'react-dom-client',
          'react/jsx-runtime': 'jsx-runtime',
          '@tablemax/web-host': 'web-host',
        };
        if (build.initialOptions.platform === 'browser' && runtime[args.path])
          return {
            path: `/runtime/v1/${runtime[args.path]}.js`,
            external: true,
          };
        if (args.kind === 'url-token' && args.path.startsWith('../resources/'))
          return { path: args.path, external: true };
        if (
          args.path.startsWith('.') ||
          args.path.startsWith('/') ||
          /^[A-Z]:/i.test(args.path)
        ) {
          const path = resolve(args.resolveDir, args.path);
          if (!inside(root, path))
            throw new Error(`Import escapes author project: ${args.path}`);
        }
        if (media.test(args.path))
          return {
            path: resolve(args.resolveDir, args.path),
            namespace: 'media',
          };
      });
      build.onLoad({ filter: /./, namespace: 'media' }, async ({ path }) => {
        const bytes = await readFile(path);
        const id = `${manifest.id}/${relative(root, path).replaceAll('\\', '/')}`;
        resources.set(id, bytes);
        return {
          contents: `import {resourceUrl} from '@tablemax/web-host'; export default resourceUrl(${JSON.stringify(id)}, import.meta.url);`,
          loader: 'js',
        };
      });
      build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
        let contents = await readFile(path, 'utf8');
        const matches = [
          ...contents.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g),
        ];
        for (const match of matches) {
          if (/^(data:|https?:|\/)/.test(match[2]))
            throw new Error('Author CSS must use declared local resources');
          const target = resolve(dirname(path), match[2]);
          if (!inside(root, target))
            throw new Error('CSS resource escapes project');
          const id = `${manifest.id}/${relative(root, target).replaceAll('\\', '/')}`;
          resources.set(id, await readFile(target));
          contents = contents.replace(match[0], `url("../resources/${id}")`);
        }
        return { contents, loader: 'css', resolveDir: dirname(path) };
      });
    },
  };
  try {
    if (codeReused) {
      for (const part of ['rules.cjs', 'bot.cjs', 'web'])
        await cp(resolve(output, part), resolve(stage, part), {
          recursive: true,
        });
      for (const file of previous.files.filter((file) =>
        file.path.startsWith('resources/'),
      )) {
        const id = file.path.slice(10);
        if (!id.startsWith(`${manifest.id}/`))
          throw new Error('Invalid cached author resource');
        resources.set(
          id,
          await readFile(resolve(root, id.slice(manifest.id.length + 1))),
        );
      }
    } else
      for (const part of ['rules', 'bot', 'web'])
        await esbuild({
          absWorkingDir: root,
          entryPoints: [resolve(root, manifest.entries[part])],
          bundle: true,
          outfile: resolve(
            stage,
            part === 'web' ? 'web/entry.js' : `${part}.cjs`,
          ),
          format: part === 'web' ? 'esm' : 'cjs',
          platform: part === 'web' ? 'browser' : 'node',
          target: part === 'web' ? ['chrome110', 'safari16'] : 'node22',
          jsx: 'automatic',
          minify: true,
          external:
            part === 'web'
              ? [
                  'react',
                  'react-dom',
                  'react/jsx-runtime',
                  '@tablemax/web-host',
                ]
              : [],
          plugins: [boundary],
          logLevel: 'silent',
        });
    for (const [id, bytes] of resources) {
      const path = resolve(stage, 'resources', id);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
    for (const [name, expected] of Object.entries(sourceHashes))
      if (hash(await readFile(resolve(root, name))) !== expected)
        throw new Error('Author input changed during build');
    const compiled = {
      ...manifest,
      entries: { rules: 'rules.cjs', bot: 'bot.cjs', web: 'web/entry.js' },
      styles: [],
    };
    const inventory = [];
    const collect = async (path) => {
      for (const item of await readdir(path, { withFileTypes: true })) {
        const full = resolve(path, item.name);
        if (item.isDirectory()) await collect(full);
        else {
          const name = relative(stage, full).replaceAll('\\', '/');
          const bytes = await readFile(full);
          inventory.push({
            path: name,
            bytes: bytes.length,
            sha256: hash(bytes),
          });
          if (name.startsWith('web/') && extname(name) === '.css')
            compiled.styles.push(name);
        }
      }
    };
    await collect(stage);
    inventory.sort((a, b) => a.path.localeCompare(b.path));
    await writeFile(
      resolve(stage, 'module.json'),
      JSON.stringify(compiled, null, 2),
    );
    await writeFile(
      resolve(stage, 'author-build.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          moduleContract: 7,
          networkProtocol: 8,
          inputs: sourceHashes,
          pipelineSha256,
          files: inventory,
        },
        null,
        2,
      ),
    );
    // A project-local lock keeps parallel tasks from overwriting each other.
    await mkdir(resolve(root, '.tablemax/build.lock'));
    const backup = resolve(root, `.tablemax/previous-${randomUUID()}`);
    let moved = false;
    try {
      try {
        await rename(output, backup);
        moved = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      try {
        await rename(stage, output);
      } catch (error) {
        if (moved) await rename(backup, output);
        throw error;
      }
      if (moved) await rm(backup, { recursive: true, force: true });
    } finally {
      await rm(resolve(root, '.tablemax/build.lock'), { recursive: true });
    }
    return { output, manifest: compiled, files: inventory, codeReused };
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}
