import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReleaseExecutable } from './release-executable.mjs';
import { execute } from './setup-desktop.mjs';
const run = promisify(execFile);
const work = await mkdtemp(resolve('tmp/release-launcher-test-'));
const input = join(work, 'input');
await mkdir(input);
const probe = join(work, 'Probe.cs');
await writeFile(
  probe,
  'using System.Threading; class Probe { static void Main() { Thread.Sleep(30000); } }',
);
await execute(
  join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),
  ['/nologo', '/target:winexe', `/out:${join(input, 'TableMax.exe')}`, probe],
);
await writeFile(join(input, 'a.txt'), 'initial');
const archive = join(work, 'payload.zip');
await run(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    'Compress-Archive -Path (Join-Path $env:TABLEMAX_FIXTURE_INPUT "*") -DestinationPath $env:TABLEMAX_FIXTURE_ZIP',
  ],
  {
    windowsHide: true,
    env: {
      ...process.env,
      TABLEMAX_FIXTURE_INPUT: input,
      TABLEMAX_FIXTURE_ZIP: archive,
    },
  },
);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const manifest = {
  version: '1.0.2',
  archive: { sha256: hash(await readFile(archive)) },
  files: [],
};
for (const name of ['TableMax.exe', 'a.txt'])
  manifest.files.push({
    path: name,
    bytes: (await stat(join(input, name))).size,
    sha256: hash(await readFile(join(input, name))),
  });
const manifestPath = join(work, 'manifest.json');
await writeFile(manifestPath, JSON.stringify(manifest));
const wrapper = join(work, 'release.exe');
await createReleaseExecutable({
  archivePath: archive,
  manifestPath,
  outputPath: wrapper,
});
const target = join(work, 'installed');
const checks = [];
const extract = async (exe, path, ok = true) => {
  try {
    await run(exe, [`--extract-only=${path}`], {
      windowsHide: true,
      timeout: 60000,
    });
    assert.equal(ok, true, 'Unexpected accepted extraction');
  } catch (error) {
    if (ok) throw error;
    assert.equal(error.code, 1);
  }
};
await Promise.all([extract(wrapper, target), extract(wrapper, target)]);
for (const file of manifest.files)
  assert.equal(hash(await readFile(join(target, file.path))), file.sha256);
checks.push(
  'Concurrent first extraction and reuse yield declared exact runtime hashes',
);
const markerTime = (await stat(join(target, '.tablemax-release.json'))).mtimeMs;
await extract(wrapper, target);
assert.equal(
  (await stat(join(target, '.tablemax-release.json'))).mtimeMs,
  markerTime,
);
checks.push(
  'Unchanged second launch reuses verified resources without rewriting',
);
await writeFile(join(target, 'a.txt'), 'damaged');
await extract(wrapper, target);
assert.equal(await readFile(join(target, 'a.txt'), 'utf8'), 'initial');
checks.push('Damaged owned runtime is repaired through staging replacement');
const unmanaged = join(work, 'unmanaged');
await mkdir(unmanaged);
await writeFile(join(unmanaged, 'save.db'), 'user content');
await extract(wrapper, unmanaged, false);
assert.equal(
  await readFile(join(unmanaged, 'save.db'), 'utf8'),
  'user content',
);
checks.push('Unmanaged directory rejected and user files preserved');
await writeFile(join(target, 'a.txt'), 'damaged');
const busy = spawn(join(target, 'TableMax.exe'), [], {
  windowsHide: true,
  stdio: 'ignore',
});
try {
  await new Promise((done) => setTimeout(done, 300));
  await extract(wrapper, target, false);
  assert.equal(await readFile(join(target, 'a.txt'), 'utf8'), 'damaged');
} finally {
  busy.kill();
  await new Promise((done) => busy.once('exit', done));
}
await extract(wrapper, target);
checks.push(
  'Running owned executable refuses replacement, then succeeds after exit',
);
const bad = {
  ...manifest,
  files: [{ ...manifest.files[0], path: '../escape.exe' }],
};
const badManifest = join(work, 'bad.json');
await writeFile(badManifest, JSON.stringify(bad));
const badExe = join(work, 'bad.exe');
await createReleaseExecutable({
  archivePath: archive,
  manifestPath: badManifest,
  outputPath: badExe,
});
await extract(badExe, join(work, 'rejected'), false);
await assert.rejects(stat(join(work, 'escape.exe')));
checks.push('Traversal manifest rejected before any outside write');
const evidence = resolve(
  'artifacts/maintenance/v1.0.2/github-release-20261005',
);
await mkdir(evidence, { recursive: true });
await writeFile(
  join(evidence, 'launcher-tests.json'),
  JSON.stringify(
    {
      result: 'passed',
      checks,
      work,
      boundary:
        'Actual compiled .NET self-extractor and OS processes with tiny local fixture; final shipping payload verified separately.',
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ result: 'passed', checks: checks.length }));
