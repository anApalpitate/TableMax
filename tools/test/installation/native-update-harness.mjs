import { createHash, generateKeyPairSync, sign, constants } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const caseIds = [
  'valid-download',
  'valid-redirect',
  'cancel',
  'oversized-stream',
  'truncated-stream',
  'broken-stream',
  'wrong-sha',
  'unsafe-redirect',
  'exact-two-assets',
  'source-asset-state',
  'asset-digest',
  'foreign-release',
  'multiple-machine-blocks',
  'highest-version',
  'same-build-different-sha',
  'same-current-different-sha',
  'current-is-idle',
  'highest-tamper-refused',
  'parameters-not-network',
  'long-path-download',
];
const options = new Map();
for (const argument of process.argv.slice(2)) {
  const match = /^--(only|prior-failures)=(.*)$/.exec(argument);
  if (!match || options.has(match[1]))
    throw new Error('Use unique --only/--prior-failures options.');
  options.set(match[1], match[2]);
}
const selected = options.has('only') ? options.get('only').split(',') : caseIds;
if (
  selected.some((name) => !caseIds.includes(name)) ||
  new Set(selected).size !== selected.length
)
  throw new Error('Select unique known controller case IDs.');
const selectedCases = caseIds.filter((name) => selected.includes(name));
const priorFailuresText = options.get('prior-failures') ?? '0';
if (!/^[0-2]$/.test(priorFailuresText))
  throw new Error('Prior failures must be 0, 1 or 2.');
const priorFailures = Number(priorFailuresText);
const workspace = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const started = performance.now();
const work = await mkdtemp(join(workspace, 'tmp', 'native-update-controller-'));
const installationRoot = join(work, 'installations');
await mkdir(installationRoot);
const keyId = 'test-native-controller-v1';
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicExponent: 65537,
});
const jwk = publicKey.export({ format: 'jwk' });
const xml = `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
const trust = join(work, 'ApplicationUpdateKeys.json');
await writeFile(
  trust,
  JSON.stringify({ schemaVersion: 1, keys: { [keyId]: xml } }),
);
const bytes = Buffer.alloc(4096);
for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
const current = Buffer.from('fixture-installed-installer-v1');
const base = {
  schemaVersion: 1,
  productId: '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
  channel: 'stable',
  os: 'windows',
  arch: 'x64',
  installProtocol: 1,
  releaseVersion: '1.0.6',
  buildVersion: '1.0.6.12',
  releaseTag: 'v1.0.6',
  repo: 'anApalpitate/TableMax',
  assetName: 'TableMax-1.0.6-win-x64.exe',
  assetUrl:
    'https://github.com/anApalpitate/TableMax/releases/download/v1.0.6/TableMax-1.0.6-win-x64.exe',
  bytes: bytes.length,
  sha256: hash(bytes),
  payloadManifestSha256: hash(Buffer.from('fixture-next-payload')),
  currentMappingSha256: hash(Buffer.from('fixture-next-mapping')),
};
function descriptor(description) {
  const payload = Buffer.from(JSON.stringify(description));
  const envelope = {
    schemaVersion: 1,
    algorithm: 'RSA3072-SHA256-PKCS1v15',
    keyId,
    payload: payload.toString('base64'),
    signature: sign('sha256', payload, {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING,
    }).toString('base64'),
  };
  return {
    description,
    envelope,
    body: `Fixture release notes.\n<!-- TABLEMAX-APPLICATION-UPDATE-V1:${Buffer.from(JSON.stringify(envelope)).toString('base64')} -->`,
  };
}
const currentDescription = {
  ...base,
  buildVersion: '1.0.6.10',
  bytes: current.length,
  sha256: hash(current),
  payloadManifestSha256: hash(Buffer.from('fixture-payload-manifest')),
  currentMappingSha256: hash(Buffer.from('fixture-bootstrap-mapping')),
};
const fixture = join(work, 'public-http-fixture.json');
await writeFile(
  fixture,
  JSON.stringify({
    installerBase64: bytes.toString('base64'),
    descriptors: {
      good: descriptor(base),
      lower: descriptor({ ...base, buildVersion: '1.0.6.11' }),
      other: descriptor({
        ...base,
        sha256: hash(Buffer.from('other-installer-byte-identity')),
      }),
      current: descriptor(currentDescription),
      currentOther: descriptor({
        ...currentDescription,
        sha256: hash(Buffer.from('changed-same-build-installer')),
      }),
    },
  }),
);

async function execute(executable, arguments_, label, timeout = 90000) {
  return await new Promise((done, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: workspace,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DOTNET_CLI_HOME: join(workspace, '.cache', 'dotnet-home'),
        DOTNET_NOLOGO: '1',
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TABLEMAX_TEST_MAINTENANCE: '0',
      },
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${label} timed out`));
    }, timeout);
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
const executable = join(work, 'NativeUpdateHarness.exe');
const references = join(
  workspace,
  '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
);
const compiler = join(
  process.env.ProgramFiles ?? 'C:/Program Files',
  'dotnet/sdk/9.0.102/Roslyn/bincore/csc.dll',
);
const compile = await execute(
  'dotnet',
  [
    compiler,
    '/nologo',
    '/target:exe',
    '/platform:x64',
    '/langversion:12',
    '/optimize+',
    '/warnaserror+',
    '/nostdlib+',
    `/out:${executable}`,
    ...[
      'mscorlib',
      'System',
      'System.Core',
      'System.Security',
      'System.Xml',
      'System.Net.Http',
      'System.Web.Extensions',
    ].map((name) => `/reference:${join(references, name + '.dll')}`),
    `/resource:${trust},ApplicationUpdateKeys.json`,
    ...[
      'apps/desktop/installation-runtime/InstallationCore.cs',
      'apps/desktop/installation-runtime/UpdateProtocol.cs',
      'apps/desktop/installation-runtime/TrustRoots.cs',
      'apps/desktop/native/ApplicationUpdate.cs',
      'apps/desktop/native/Json.cs',
      'apps/desktop/native/InstallationSession.cs',
      'tools/test/installation/native-update-harness.cs',
    ].map((path) => join(workspace, path)),
  ],
  'Compile native update harness',
);
await writeFile(join(work, 'compile.log'), compile.output);
if (compile.code !== 0)
  throw new Error(
    `Native harness compilation failed; ${join(work, 'compile.log')}`,
  );
const run = await execute(
  executable,
  [
    installationRoot,
    fixture,
    '--only=' + selectedCases.join(','),
    '--prior-failures=' + priorFailures,
  ],
  'Native update controller cases',
);
await writeFile(join(work, 'run.log'), run.output);
let report;
try {
  report = JSON.parse(run.output.trim());
} catch {
  throw new Error(
    `Native harness returned invalid report; ${join(work, 'run.log')}`,
  );
}
if (
  report.priorFailures !== priorFailures ||
  report.failureLimit !== 3 ||
  report.totalFailures !== priorFailures + report.failures ||
  JSON.stringify(report.selectedCases) !== JSON.stringify(selectedCases)
)
  throw new Error(
    'The controller harness scope or shared failure budget changed.',
  );
const sources = [
  'apps/desktop/native/ApplicationUpdate.cs',
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'apps/desktop/native/Json.cs',
  'apps/desktop/native/InstallationSession.cs',
  'tools/test/installation/native-update-harness.cs',
  'tools/test/installation/native-update-harness.mjs',
];
report.sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (path) => [
      path,
      hash(await readFile(join(workspace, path))),
    ]),
  ),
);
report.durationMs = Math.round(performance.now() - started);
report.privateKey =
  'Generated only in Node memory; never exported or persisted';
report.artifacts = await readdir(work);
await writeFile(
  join(work, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    passed: report.passed,
    selectedCases: report.selectedCases,
    cases: report.results.length,
    priorFailures: report.priorFailures,
    totalFailures: report.totalFailures,
    failures: report.results.filter((test) => !test.passed),
    report: join(work, 'report.json'),
    durationMs: report.durationMs,
  }),
);
if (run.code !== 0 || !report.passed) process.exitCode = 1;
