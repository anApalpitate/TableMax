import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const caseIds = [
  'private-copy-bindings',
  'temp-drive-root',
  'nonprivate-directory',
  'metadata-tamper',
  'target-source-tamper',
  'unknown-member',
  'unstarted-owned-cleanup',
  'installer-cleanup',
];
const options = new Map();
for (const argument of process.argv.slice(2)) {
  const match = /^--(only|prior-failures)=(.*)$/.exec(argument);
  if (!match || options.has(match[1]))
    throw new Error('Use unique --only/--prior-failures options.');
  options.set(match[1], match[2]);
}
const selected = options.has('only') ? options.get('only').split(',') : caseIds;
assert(
  selected.every((id) => caseIds.includes(id)) &&
    new Set(selected).size === selected.length,
  'Select unique known launch case IDs.',
);
const selectedCases = caseIds.filter((id) => selected.includes(id));
const prior = options.get('prior-failures') ?? '0';
assert(/^[0-2]$/.test(prior), 'Prior failures must be 0, 1 or 2.');
const priorFailures = Number(prior);
assert.equal(process.platform, 'win32', 'This harness requires Windows net48.');
const workspace = resolve('.');
const sources = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'tools/test/installation/native-launch-harness.cs',
  'tools/test/installation/native-launch-harness.mjs',
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      sources.map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(join(workspace, path)))
          .digest('hex'),
      ]),
    ),
  );
const sourceHashes = await hashes();
await mkdir(join(workspace, 'tmp'), { recursive: true });
const work = await mkdtemp(join(workspace, 'tmp', 'native-launch-'));
const fixtures = join(work, 'cases');
await mkdir(fixtures);
const executable = join(work, 'NativeLaunchHarness.exe');
const references = join(
  workspace,
  '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
);
const dotnet = join(process.env.ProgramFiles ?? 'C:/Program Files', 'dotnet');
const started = performance.now();
async function execute(program, args, label) {
  return await new Promise((done) => {
    const child = spawn(program, args, {
      cwd: workspace,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DOTNET_CLI_HOME: join(workspace, '.cache/dotnet-home'),
        DOTNET_NOLOGO: '1',
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TABLEMAX_TEST_MAINTENANCE: '0',
      },
    });
    let stdout = '',
      stderr = '',
      error = null;
    const timer = setTimeout(() => {
      error = `${label} exceeded 90 seconds`;
      child.kill();
    }, 90000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.once('error', (cause) => {
      error = cause.message;
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      done({ code, signal, stdout, stderr, error });
    });
  });
}
let report;
try {
  const compilation = await execute(
    join(dotnet, 'dotnet.exe'),
    [
      join(dotnet, 'sdk/9.0.102/Roslyn/bincore/csc.dll'),
      '/nologo',
      '/target:exe',
      '/platform:x64',
      '/langversion:12',
      '/optimize+',
      '/warnaserror+',
      '/nostdlib+',
      '/define:TABLEMAX_INSTALLATION_TEST',
      '/main:NativeLaunchHarness',
      `/out:${executable}`,
      ...[
        'mscorlib',
        'System',
        'System.Core',
        'System.Security',
        'System.Xml',
        'System.Web.Extensions',
      ].map((name) => `/reference:${join(references, name + '.dll')}`),
      ...sources
        .filter((path) => path.endsWith('.cs'))
        .map((path) => join(workspace, path)),
    ],
    'Compile launch component harness',
  );
  await writeFile(
    join(work, 'compile.log'),
    compilation.stdout + compilation.stderr,
    { flag: 'wx' },
  );
  assert(compilation.code === 0 && !compilation.error, 'Compilation failed.');
  const run = await execute(
    executable,
    [
      fixtures,
      '--only=' + selectedCases.join(','),
      '--prior-failures=' + priorFailures,
    ],
    'Launch component cases',
  );
  await writeFile(join(work, 'run.stdout.json'), run.stdout, { flag: 'wx' });
  await writeFile(join(work, 'run.stderr.log'), run.stderr, { flag: 'wx' });
  report = JSON.parse(run.stdout.trim());
  assert.deepEqual(report.selectedCases, selectedCases);
  assert.equal(report.priorFailures, priorFailures);
  assert.equal(report.failureLimit, 3);
  assert.equal(report.totalFailures, priorFailures + report.failures);
  assert.equal(
    report.failures,
    report.results.filter((result) => !result.passed).length,
  );
  assert.deepEqual(
    report.results.map((result) => result.id),
    selectedCases.slice(0, report.results.length),
  );
  assert.equal(report.processEnvironmentRestored, true);
  assert(!run.error && run.code === (report.passed ? 0 : 1));
} catch (cause) {
  const observedFailures =
    report && Number.isInteger(report.failures) && report.failures >= 0
      ? report.failures
      : 0;
  report = {
    ...report,
    schemaVersion: 1,
    passed: false,
    selectedCases,
    priorFailures,
    failures: observedFailures + 1,
    totalFailures: priorFailures + observedFailures + 1,
    failureLimit: 3,
    results: report?.results ?? [],
    toolFailure: cause.stack,
    preservedWork: work,
  };
}
const finalSourceHashes = await hashes();
report.sourcesUnchanged =
  JSON.stringify(sourceHashes) === JSON.stringify(finalSourceHashes);
if (!report.sourcesUnchanged) {
  report.passed = false;
  report.sourceChangeError = 'A compiled or harness source changed during run.';
  if (report.totalFailures < 3) {
    report.failures++;
    report.totalFailures++;
  }
}
report.sourceHashes = sourceHashes;
report.finalSourceHashes = finalSourceHashes;
report.componentOnly = true;
report.syntheticFilesAreExecutable = false;
report.maintenanceExecuted = false;
report.durationMs = Math.round(performance.now() - started);
report.work = work;
await writeFile(
  join(work, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
  {
    flag: 'wx',
  },
);
console.log(
  JSON.stringify({
    passed: report.passed,
    selectedCases,
    failures: report.failures,
    totalFailures: report.totalFailures,
    report: join(work, 'report.json'),
    componentOnly: true,
  }),
);
if (!report.passed) process.exitCode = 1;
