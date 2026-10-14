import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileInstallationProgram } from '../../release/installation-package.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const workspace = resolve('.');
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(join(workspace, 'tmp', 'native-confirm-'));
const sources = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'apps/desktop/installation-runtime/UpdateHelper.cs',
  'apps/desktop/native/LegacyGames.cs',
  'tools/test/installation/native-confirm-harness.cs',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (path) => [path, hash(await readFile(path))]),
  ),
);
async function execute(path) {
  return new Promise((done, reject) => {
    const child = spawn(path, ['--run'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TABLEMAX_TEST_MAINTENANCE: '0',
      },
    });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Controlled Confirm exceeded its 30 second budget'));
    }, 30000);
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      done({ code, output });
    });
  });
}
const report = { passed: false, sourceHashes, work, results: [] };
try {
  for (const fixture of [false, true]) {
    const role = fixture ? 'persistent-handoff-fixture' : 'production';
    const executable = join(work, role, 'NativeConfirmHarness.exe');
    const compilation = await compileInstallationProgram({
      outputPath: executable,
      main: 'NativeConfirmHarness',
      sources,
      buildVersion: '1.0.6.10',
      fixture,
      handoffTest: fixture,
    });
    await writeFile(
      join(work, role, 'compile.json'),
      JSON.stringify(compilation, null, 2) + '\n',
    );
    const result = await execute(executable);
    await writeFile(join(work, role, 'run.log'), result.output);
    const line = result.output
      .split(/\r?\n/)
      .find((value) => value.startsWith('{"passed":'));
    assert.ok(line, 'Missing controlled Confirm result');
    const value = JSON.parse(line);
    report.results.push({ role, ...value, exitCode: result.code });
    assert.equal(result.code, 0);
    assert.equal(value.passed, true);
  }
  for (const [path, sha256] of Object.entries(sourceHashes))
    assert.equal(hash(await readFile(path)), sha256, 'Source changed: ' + path);
  report.passed = true;
} catch (error) {
  report.error = error.message;
} finally {
  await writeFile(
    join(work, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    passed: report.passed,
    checks: report.results.flatMap((item) => item.checks),
    report: join(work, 'report.json'),
  }),
);
assert.equal(report.passed, true);
