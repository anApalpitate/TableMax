import { spawn } from 'node:child_process';
import { resolve, dirname, join, posix } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, copyFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const electronDir = dirname(require.resolve('electron/package.json'));
const { version } = require('electron/package.json');
const cacheRoot = resolve('.cache/electron');
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
async function execute(command, args, env = process.env) {
  const child = spawn(command, args, { stdio: 'inherit', env });
  await new Promise((fulfill, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? fulfill()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('This project targets Windows x64');
const installed =
  (await exists(join(electronDir, 'dist/electron.exe'))) &&
  (await readFile(join(electronDir, 'dist/version'), 'utf8'))
    .trim()
    .replace(/^v/, '') === version;
if (installed) {
  console.log(`Electron ${version} runtime is already installed.`);
} else {
  const name = `electron-v${version}-win32-x64.zip`;
  const url = `https://github.com/electron/electron/releases/download/v${version}/${name}`;
  const cacheUrl = new URL(url);
  cacheUrl.pathname = posix.dirname(cacheUrl.pathname);
  const cacheKey = createHash('sha256')
    .update(cacheUrl.toString())
    .digest('hex');
  const cached = join(cacheRoot, cacheKey, name);
  const download = join(cacheRoot, name);
  await mkdir(cacheRoot, { recursive: true });
  if (!(await exists(cached)) && !(await exists(download))) {
    await execute('curl.exe', [
      '--fail',
      '--location',
      '--retry',
      '2',
      '--connect-timeout',
      '20',
      '--max-time',
      '600',
      '--output',
      download,
      url,
    ]);
  }
  const candidate = (await exists(cached)) ? cached : download;
  const expected = JSON.parse(
    await readFile(join(electronDir, 'checksums.json'), 'utf8'),
  )[name];
  const actual = createHash('sha256')
    .update(await readFile(candidate))
    .digest('hex');
  if (!expected || actual !== expected)
    throw new Error(
      'Electron archive SHA-256 mismatch; cache preserved for inspection',
    );
  await mkdir(dirname(cached), { recursive: true });
  if (candidate !== cached) await copyFile(candidate, cached);
  console.log(
    `Verified official Electron ${version} archive SHA-256: ${actual}`,
  );
  await execute(process.execPath, [join(electronDir, 'install.js')], {
    ...process.env,
    ELECTRON_CACHE: cacheRoot,
    electron_config_cache: cacheRoot,
  });
}
