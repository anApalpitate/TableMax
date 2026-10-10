import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function nodeRuntimeInputs({
  version,
  archiveSha256,
  read = readFile,
}) {
  const paths = [
    'scripts/setup-desktop.mjs',
    'tools/build/node-runtime-inputs.mjs',
  ];
  return {
    files: await Promise.all(
      paths.map(async (path) => ({
        path,
        sha256: createHash('sha256')
          .update(await read(path))
          .digest('hex'),
      })),
    ),
    globs: [],
    runtime: { version, archiveSha256, platform: 'win32', architecture: 'x64' },
  };
}
