import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
export async function exportAuthorToolkit(
  outputDirectory,
  workspaceDirectory = resolve(here, '../..'),
) {
  const output = resolve(outputDirectory);
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  await mkdir(resolve(output, 'public'));
  for (const name of ['game-sdk', 'protocol', 'web-host']) {
    const target = resolve(output, 'public', name);
    await cp(
      resolve(workspaceDirectory, 'packages', name, 'src'),
      resolve(target, 'src'),
      {
        recursive: true,
        filter: (path) => !/\.test\.[cm]?[jt]sx?$/.test(path),
      },
    );
    const manifest = JSON.parse(
      await readFile(
        resolve(workspaceDirectory, 'packages', name, 'package.json'),
        'utf8',
      ),
    );
    for (const [id, version] of Object.entries(manifest.dependencies ?? {}))
      if (version.startsWith('workspace:'))
        manifest.dependencies[id] = `file:../${id.split('/')[1]}`;
    await writeFile(
      resolve(target, 'package.json'),
      JSON.stringify(manifest, null, 2),
    );
  }
  for (const file of [
    'cli.mjs',
    'contract.mjs',
    'build.mjs',
    'harness.mjs',
    'isolated-dev.mjs',
  ])
    await cp(resolve(here, file), resolve(output, file));
  await cp(
    resolve(workspaceDirectory, 'tools/release/game-package-format.mjs'),
    resolve(output, 'package-format.mjs'),
  );
  const cli = await readFile(resolve(output, 'cli.mjs'), 'utf8');
  await writeFile(
    resolve(output, 'cli.mjs'),
    cli.replace('../release/game-package-format.mjs', './package-format.mjs'),
  );
  await cp(resolve(here, 'template'), resolve(output, 'template'), {
    recursive: true,
  });
  await writeFile(
    resolve(output, 'package.json'),
    JSON.stringify(
      {
        name: '@tablemax/author-tools',
        version: '1.0.6',
        private: true,
        type: 'module',
        engines: { node: '>=22.14.0 <23' },
        dependencies: {
          esbuild: '0.28.2',
          typescript: '5.9.3',
          playwright: '1.63.0',
        },
        bin: { 'tablemax-author': './cli.mjs' },
        overrides: { fsevents: '2.3.3' },
      },
      null,
      2,
    ),
  );
  const files = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else {
        const bytes = await readFile(path);
        files.push({
          path: relative(output, path).replaceAll('\\', '/'),
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
    }
  };
  await walk(output);
  files.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(
    resolve(output, 'toolkit-manifest.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        version: '1.0.6',
        moduleContract: 7,
        networkProtocol: 8,
        files,
      },
      null,
      2,
    ),
  );
  return { output, files };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const output = process.argv[2];
  if (!output || process.argv.length !== 3)
    throw new Error(
      'Usage: node tools/author/export-toolkit.mjs <new-output-directory>',
    );
  const result = await exportAuthorToolkit(output);
  console.log(
    JSON.stringify({
      output: result.output,
      files: result.files.length,
      privateSource: false,
    }),
  );
}
