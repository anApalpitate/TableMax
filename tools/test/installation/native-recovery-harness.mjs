import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
assert.ok(
  process.argv.slice(2).every((argument) => argument === '--playing-only'),
  'Only the focused playing gate selection is supported',
);
const workspace = resolve('.');
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(join(workspace, 'tmp', 'native-recovery-'));
const executable = join(work, 'NativeRecoveryHarness.exe');
async function run(program, args) {
  return new Promise((done, reject) => {
    const process = spawn(program, args, {
      windowsHide: true,
      env: {
        ...globalThis.process.env,
        DOTNET_CLI_HOME: join(workspace, '.cache/dotnet-home'),
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const timeout = setTimeout(() => {
      process.kill();
      reject(new Error('Recovery harness exceeded 60 seconds'));
    }, 60000);
    process.stdout.on('data', (chunk) => {
      output += chunk;
    });
    process.stderr.on('data', (chunk) => {
      output += chunk;
    });
    process.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    process.once('exit', (code) => {
      clearTimeout(timeout);
      done({ code, output });
    });
  });
}
const sources = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'apps/desktop/installation-runtime/UpdateHelper.cs',
  'apps/desktop/native/LegacyGames.cs',
  'tools/test/installation/native-recovery-harness.cs',
];
const references = join(
  workspace,
  '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
);
const compiler = join(
  process.env.ProgramFiles ?? 'C:/Program Files',
  'dotnet/sdk/9.0.102/Roslyn/bincore/csc.dll',
);
const compilation = await run('dotnet', [
  compiler,
  '/nologo',
  '/target:exe',
  '/platform:x64',
  '/langversion:12',
  '/optimize+',
  '/warnaserror+',
  '/nostdlib+',
  '/define:TABLEMAX_INSTALLATION_TEST',
  '/main:NativeRecoveryHarness',
  `/out:${executable}`,
  ...[
    'mscorlib',
    'System',
    'System.Core',
    'System.Security',
    'System.Xml',
    'System.Web.Extensions',
  ].map((name) => `/reference:${join(references, name + '.dll')}`),
  ...sources.map((path) => join(workspace, path)),
]);
await writeFile(join(work, 'compile.log'), compilation.output);
assert.equal(compilation.code, 0, `Compilation failed: ${work}`);
const execution = await run(executable, [
  process.argv.includes('--playing-only') ? '--playing-only' : '--run',
]);
await writeFile(join(work, 'run.log'), execution.output);
const reportLine = execution.output
  .split(/\r?\n/)
  .find((line) => line.startsWith('{"passed":'));
const report = reportLine
  ? JSON.parse(reportLine)
  : { passed: false, failure: 'Missing JSON result' };
report.sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (path) => [
      path,
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    ]),
  ),
);
report.work = work;
await writeFile(
  join(work, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    passed: report.passed,
    checks: report.checks,
    report: join(work, 'report.json'),
  }),
);
assert.equal(execution.code, 0);
assert.equal(report.passed, true);
