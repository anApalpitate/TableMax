import { failureLimit } from '../runner/failure-policy.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { constants, createHash, generateKeyPairSync, sign } from 'node:crypto';
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
  'completed-cleanup',
  'completed-cleanup-pending',
  'completed-cleanup-unknown',
  'completed-cleanup-tamper',
  'completed-cleanup-in-use',
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
const limit = failureLimit();
const prior = options.get('prior-failures') ?? '0';
assert(
  /^(0|[1-9]\d*)$/.test(prior) && Number(prior) < limit,
  `Prior failures must be an integer from 0 to ${limit - 1}.`,
);
const priorFailures = Number(prior);
assert.equal(process.platform, 'win32', 'This harness requires Windows net48.');
const workspace = resolve('.');
const sources = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'tools/test/installation/native-launch-harness.cs',
  'tools/test/installation/native-launch-harness.mjs',
  'tools/test/runner/failure-policy.mjs',
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
const digest = (value) => createHash('sha256').update(value).digest('hex');
const installerBytes = Buffer.from('synthetic installer bytes; never executed');
const keyId = 'test-native-launch-cleanup-v1';
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicExponent: 65537,
});
const jwk = publicKey.export({ format: 'jwk' });
const xml = `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
const payload = Buffer.from(
  JSON.stringify({
    schemaVersion: 1,
    productId: '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
    channel: 'stable',
    os: 'windows',
    arch: 'x64',
    installProtocol: 1,
    releaseVersion: '1.0.6',
    buildVersion: '1.0.6.11',
    releaseTag: 'v1.0.6',
    repo: 'anApalpitate/TableMax',
    assetName: 'TableMax-1.0.6-installer-win-x64.exe',
    assetUrl:
      'https://github.com/anApalpitate/TableMax/releases/download/v1.0.6/TableMax-1.0.6-installer-win-x64.exe',
    bytes: installerBytes.length,
    sha256: digest(installerBytes),
    payloadManifestSha256: digest(Buffer.from('synthetic-next-payload')),
    currentMappingSha256: digest(Buffer.from('synthetic-next-mapping')),
  }),
);
const publicFixtureBytes = Buffer.from(
  JSON.stringify({
    trust: { schemaVersion: 1, keys: { [keyId]: xml } },
    envelope: {
      schemaVersion: 1,
      algorithm: 'RSA3072-SHA256-PKCS1v15',
      keyId,
      payload: payload.toString('base64'),
      signature: sign('sha256', payload, {
        key: privateKey,
        padding: constants.RSA_PKCS1_PADDING,
      }).toString('base64'),
    },
  }),
);
const publicFixturePath = join(work, 'public-signature-fixture.json');
await writeFile(publicFixturePath, publicFixtureBytes, { flag: 'wx' });
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
        TABLEMAX_TEST_MAX_FAILURES: String(limit),
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
      '--signed-fixture=' + publicFixturePath,
    ],
    'Launch component cases',
  );
  await writeFile(join(work, 'run.stdout.json'), run.stdout, { flag: 'wx' });
  await writeFile(join(work, 'run.stderr.log'), run.stderr, { flag: 'wx' });
  report = JSON.parse(run.stdout.trim());
  assert.deepEqual(report.selectedCases, selectedCases);
  assert.equal(report.priorFailures, priorFailures);
  assert.equal(report.failureLimit, limit);
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
    failureLimit: limit,
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
  if (report.totalFailures < limit) {
    report.failures++;
    report.totalFailures++;
  }
}
report.sourceHashes = sourceHashes;
report.finalSourceHashes = finalSourceHashes;
report.componentOnly = true;
report.syntheticFilesAreExecutable = false;
report.publicSignatureFixture = {
  path: publicFixturePath,
  bytes: publicFixtureBytes.length,
  sha256: digest(publicFixtureBytes),
  keyId,
  generatedInMemory: true,
  privateKeyWritten: false,
};
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
