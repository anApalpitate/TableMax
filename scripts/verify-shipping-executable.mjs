import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  stat,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
const run = promisify(execFile);
const hash = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const evidence = resolve(
  'artifacts/maintenance',
  `v${version}`,
  'github-release-20261005',
);
const executable = resolve(
  `artifacts/releases/TableMax-${version}-win-x64.exe`,
);
const manifest = JSON.parse(
  await readFile(
    `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
    'utf8',
  ),
);
const extracted = await mkdtemp(resolve('tmp/shipping-executable-'));
const started = performance.now();
await run(executable, [`--extract-only=${extracted}`], {
  windowsHide: true,
  timeout: 120000,
});
let bytes = 0,
  count = 0;
async function countFiles(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!item.isSymbolicLink());
    const path = join(directory, item.name);
    if (item.isDirectory()) await countFiles(path);
    else {
      bytes += (await stat(path)).size;
      count++;
    }
  }
}
await countFiles(extracted);
assert.equal(
  count,
  manifest.files.length + 1,
  'Only frozen payload plus ownership marker',
);
for (const file of manifest.files) {
  const path = join(extracted, file.path);
  assert.equal((await stat(path)).size, file.bytes);
  assert.equal(await hash(path), file.sha256, file.path);
}
const marker = JSON.parse(
  await readFile(join(extracted, '.tablemax-release.json'), 'utf8'),
);
assert.equal(marker.version, version);
assert.equal(marker.archive.sha256, manifest.archive.sha256);
assert.ok(bytes < 100000000, 'Actual extraction including ownership marker');
const firstWrite = (await stat(join(extracted, 'TableMax.exe'))).mtimeMs;
await run(executable, [`--extract-only=${extracted}`], {
  windowsHide: true,
  timeout: 120000,
});
assert.equal(
  (await stat(join(extracted, 'TableMax.exe'))).mtimeMs,
  firstWrite,
  'Valid extraction is reused',
);
await run(
  process.execPath,
  [
    'scripts/verify-native-safety.mjs',
    '--portable',
    `--executable=${join(extracted, 'TableMax.exe')}`,
    '--evidence=github-exe-v102',
  ],
  { windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024 },
);
const safetyPath = resolve(
  `artifacts/maintenance/v${version}/webview2/github-exe-v102/results.json`,
);
const safety = JSON.parse(await readFile(safetyPath, 'utf8'));
assert.equal(safety.result, 'passed');
assert.equal(safety.archiveSha256, manifest.archive.sha256);
const record = {
  result: 'passed',
  version,
  executableSha256: await hash(executable),
  executableBytes: (await stat(executable)).size,
  payloadSha256: manifest.archive.sha256,
  extracted,
  extractedBytes: bytes,
  payloadBytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
  fileCount: count,
  durationMs: Math.round(performance.now() - started),
  nativeSafety: safetyPath,
  checks: [
    'complete payload hashes',
    'exact file set',
    '100MB actual extraction',
    'repeat extraction reuses files',
    'real packaged native/WebView2/Node safety',
  ],
};
await mkdir(evidence, { recursive: true });
await writeFile(
  join(evidence, 'shipping-executable-checks.json'),
  JSON.stringify(record, null, 2) + '\n',
);
console.log(JSON.stringify(record));
