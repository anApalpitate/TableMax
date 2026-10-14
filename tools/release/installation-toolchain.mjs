import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';

export const INNO_VERSION = '6.7.3';
export const INNO_INSTALLER_SHA256 =
  '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732';
const run = promisify(execFile);
export const compilerDirectory = resolve(
  '.cache/inno',
  INNO_VERSION,
  'compiler',
);
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function present(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function download(url, path, expected) {
  if (!(await present(path))) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok)
      throw new Error('Build dependency download failed: ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== expected)
      throw new Error('Build dependency SHA-256 mismatch');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
  }
  if (hash(await readFile(path)) !== expected)
    throw new Error('Cached build dependency SHA-256 mismatch');
}

/** Static extraction only: never run the compiler's installer or write registration. */
export async function prepareInstallationToolchain() {
  assertWorkspaceRoot();
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('Windows x64 compiler required');
  const lock = JSON.parse(
    await readFile('tools/release/installation-toolchain.json', 'utf8'),
  );
  const archive = resolve(
    '.cache/inno',
    INNO_VERSION,
    lock.compiler.archiveName,
  );
  await download(lock.compiler.url, archive, INNO_INSTALLER_SHA256);
  if (!(await present(join(compilerDirectory, 'ISCC.exe')))) {
    const unpackRoot = resolve('.cache/inno/innounp-2.67');
    const unpackArchive = join(unpackRoot, 'innounp-267.zip');
    await download(lock.extractor.url, unpackArchive, lock.extractor.sha256);
    await run(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '$ErrorActionPreference="Stop"; Expand-Archive -LiteralPath $env:TABLEMAX_UNPACK_ARCHIVE -DestinationPath $env:TABLEMAX_UNPACK_RUNTIME -Force',
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          TABLEMAX_UNPACK_ARCHIVE: unpackArchive,
          TABLEMAX_UNPACK_RUNTIME: join(unpackRoot, 'runtime'),
        },
      },
    );
    const extractor = join(unpackRoot, 'runtime/innounp.exe');
    if (hash(await readFile(extractor)) !== lock.extractor.executableSha256)
      throw new Error('Extractor executable changed');
    const extracted = resolve('.cache/inno', INNO_VERSION, 'extracted');
    await run(extractor, ['-x', '-y', '-d' + extracted, archive, '{app}\\*'], {
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    for (const file of lock.files) {
      const source = join(extracted, '{app}', file.path);
      if (
        hash(await readFile(source)) !== file.sha256 ||
        (await stat(source)).size !== file.bytes
      )
        throw new Error('Official compiler member mismatch: ' + file.path);
      const destination = join(compilerDirectory, file.path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
  }
  for (const file of lock.files) {
    const path = join(compilerDirectory, file.path);
    if (
      (await stat(path)).size !== file.bytes ||
      hash(await readFile(path)) !== file.sha256
    )
      throw new Error('Compiler cache changed: ' + file.path);
  }
  return {
    executable: join(compilerDirectory, 'ISCC.exe'),
    version: INNO_VERSION,
    installerSha256: INNO_INSTALLER_SHA256,
    lockSha256: hash(
      await readFile('tools/release/installation-toolchain.json'),
    ),
  };
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  console.log(JSON.stringify(await prepareInstallationToolchain()));
}
