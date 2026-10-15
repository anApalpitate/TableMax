import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { constants, createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';
import { failureLimit } from '../runner/failure-policy.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

const workspace = assertWorkspaceRoot();
assert.equal(
  process.platform,
  'win32',
  'This component harness requires Windows net48.',
);
const caseIds = [
  'same-instance-activation',
  'same-instance-repeated',
  'wrong-root-request',
  'extra-field-request',
  'foreign-image-peer',
  'foreign-owner-declaration',
  'current-is-up-to-date',
  'older-release-is-ahead',
  'same-current-different-bytes',
  'highest-water-refuses-older',
  'panel-request-id',
  'untrusted-release-not-latest',
];
const options = new Map();
for (const argument of process.argv.slice(2)) {
  const match = /^--(only|prior-failures)=(.*)$/.exec(argument);
  assert(
    match && !options.has(match[1]),
    'Use unique --only/--prior-failures options.',
  );
  options.set(match[1], match[2]);
}
const selected = options.has('only') ? options.get('only').split(',') : caseIds;
assert(
  selected.length > 0 &&
    selected.every((id) => caseIds.includes(id)) &&
    new Set(selected).size === selected.length,
  'Select unique known activation case IDs.',
);
const selectedCases = caseIds.filter((id) => selected.includes(id));
const limit = failureLimit();
const priorText = options.get('prior-failures') ?? '0';
assert(
  /^(0|[1-9]\d*)$/.test(priorText) && Number(priorText) < limit,
  `Prior failures must be 0..${limit - 1}.`,
);
const priorFailures = Number(priorText);
const sources = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'apps/desktop/native/ApplicationUpdate.cs',
  'apps/desktop/native/UpdateActivation.cs',
  'apps/desktop/native/InstallationSession.cs',
  'apps/desktop/native/Json.cs',
  'tools/test/installation/verify-update-activation.cs',
  'tools/test/installation/verify-update-activation.mjs',
  'tools/test/runner/failure-policy.mjs',
  'tools/shared/workspace-root.mjs',
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      sources.map(async (path) => [
        path,
        hash(await readFile(join(workspace, path))),
      ]),
    ),
  );
const before = await sourceHashes();
await mkdir(join(workspace, 'tmp'), { recursive: true });
const work = await mkdtemp(join(workspace, 'tmp', 'update-activation-'));
const root = join(work, 'I');
const app = join(root, 'data', 'app');
await mkdir(app, { recursive: true });
const executable = join(app, 'TableMax.exe');
const metadata = join(work, 'build-metadata.cs');
await writeFile(
  metadata,
  `using System.Reflection;\n[assembly: AssemblyMetadata("TableMaxActivationWorkspace", @"${workspace.replaceAll('"', '""')}")]\n`,
  { flag: 'wx' },
);
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicExponent: 65537,
});
const jwk = publicKey.export({ format: 'jwk' });
const keyId = 'test-update-activation-v1';
const xml = `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
const trust = join(work, 'ApplicationUpdateKeys.json');
await writeFile(
  trust,
  JSON.stringify({ schemaVersion: 1, keys: { [keyId]: xml } }),
  { flag: 'wx' },
);
const current = {
  schemaVersion: 1,
  productId: '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
  channel: 'stable',
  os: 'windows',
  arch: 'x64',
  installProtocol: 1,
  releaseVersion: '1.0.7',
  buildVersion: '1.0.7.10',
  releaseTag: 'v1.0.7',
  repo: 'anApalpitate/TableMax',
  assetName: 'TableMax-1.0.7-installer-win-x64.exe',
  assetUrl:
    'https://github.com/anApalpitate/TableMax/releases/download/v1.0.7/TableMax-1.0.7-installer-win-x64.exe',
  bytes: 4096,
  sha256: hash(Buffer.from('synthetic current installer; never executed')),
  payloadManifestSha256: 'a'.repeat(64),
  currentMappingSha256: 'b'.repeat(64),
};
function descriptor(description, untrusted = false) {
  const payload = Buffer.from(JSON.stringify(description));
  const envelope = {
    schemaVersion: 1,
    algorithm: 'RSA3072-SHA256-PKCS1v15',
    keyId,
    payload: payload.toString('base64'),
    signature: (untrusted
      ? Buffer.alloc(384)
      : sign('sha256', payload, {
          key: privateKey,
          padding: constants.RSA_PKCS1_PADDING,
        })
    ).toString('base64'),
  };
  return {
    description,
    body: `Public synthetic release.\n<!-- TABLEMAX-APPLICATION-UPDATE-V1:${Buffer.from(JSON.stringify(envelope)).toString('base64')} -->`,
  };
}
const fixture = join(root, 'public-fixture.json');
await writeFile(
  fixture,
  JSON.stringify({
    descriptors: {
      current: descriptor(current),
      older: descriptor({ ...current, buildVersion: '1.0.7.9' }),
      future: descriptor({ ...current, buildVersion: '1.0.7.11' }),
      changed: descriptor({
        ...current,
        sha256: hash(Buffer.from('different same-build installer')),
      }),
      untrusted: descriptor(current, true),
    },
  }),
  { flag: 'wx' },
);
const dotnet = join(process.env.ProgramFiles ?? 'C:/Program Files', 'dotnet');
const references = join(
  workspace,
  '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
);
async function execute(program, args, label, timeout) {
  return await new Promise((done) => {
    const child = spawn(program, args, {
      cwd: workspace,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DOTNET_CLI_HOME: join(workspace, '.cache', 'dotnet-home'),
        DOTNET_NOLOGO: '1',
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
        TABLEMAX_TEST_MAX_FAILURES: String(limit),
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TABLEMAX_TEST_MAINTENANCE: '0',
      },
    });
    const stdout = {
      parts: [],
      bytes: 0,
      observedBytes: 0,
      eof: false,
      truncated: false,
    };
    const stderr = {
      parts: [],
      bytes: 0,
      observedBytes: 0,
      eof: false,
      truncated: false,
    };
    let error;
    const capture = (stream) => (chunk) => {
      stream.observedBytes += chunk.length;
      const retained = chunk.subarray(
        0,
        Math.max(0, 2 * 1024 * 1024 - stream.bytes),
      );
      if (retained.length) {
        stream.parts.push(retained);
        stream.bytes += retained.length;
      }
      if (stream.observedBytes > stream.bytes) {
        stream.truncated = true;
        error ??= `${label} exceeded the bounded raw output budget.`;
      }
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    child.stdout.once('end', () => {
      stdout.eof = true;
    });
    child.stderr.once('end', () => {
      stderr.eof = true;
    });
    child.stdout.once('error', (cause) => {
      error ??= `stdout raw read: ${cause.message}`;
    });
    child.stderr.once('error', (cause) => {
      error ??= `stderr raw read: ${cause.message}`;
    });
    child.once('error', (cause) => {
      error = cause.message;
    });
    const timer = setTimeout(() => {
      error = `${label} timed out.`;
      child.kill();
    }, timeout);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      done({
        pid: child.pid ?? null,
        expectedModulePath: program,
        code,
        signal,
        error,
        stdout: Buffer.concat(stdout.parts),
        stderr: Buffer.concat(stderr.parts),
        stdoutCapture: {
          observedBytes: stdout.observedBytes,
          eof: stdout.eof,
          truncated: stdout.truncated,
        },
        stderrCapture: {
          observedBytes: stderr.observedBytes,
          eof: stderr.eof,
          truncated: stderr.truncated,
        },
      });
    });
  });
}
const executions = [];
async function preserveExecution(label, execution) {
  const stdoutPath = join(work, `${label}.stdout.log`);
  const stderrPath = join(work, `${label}.stderr.log`);
  await writeFile(stdoutPath, execution.stdout, { flag: 'wx' });
  await writeFile(stderrPath, execution.stderr, { flag: 'wx' });
  const record = {
    label,
    pid: execution.pid,
    expectedModulePath: execution.expectedModulePath,
    modulePath: null,
    moduleObservedByWrapper: false,
    actualExitCode: execution.code,
    signal: execution.signal,
    error: execution.error,
    stdout: {
      path: stdoutPath,
      bytes: execution.stdout.length,
      sha256: hash(execution.stdout),
      ...execution.stdoutCapture,
    },
    stderr: {
      path: stderrPath,
      bytes: execution.stderr.length,
      sha256: hash(execution.stderr),
      ...execution.stderrCapture,
    },
    scope:
      'raw spawn observation; IPC child modules are independently queried by the C# parent and recorded in I/evidence',
  };
  const path = join(work, `${label}.process.json`);
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + '\n');
  await writeFile(path, bytes, { flag: 'wx' });
  executions.push({
    path,
    bytes: bytes.length,
    sha256: hash(bytes),
    process: record,
  });
  return path;
}
let report;
try {
  const compile = await execute(
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
      '/main:UpdateActivationHarness',
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
      metadata,
      ...sources
        .filter((path) => path.endsWith('.cs'))
        .map((path) => join(workspace, path)),
    ],
    'Compile update activation component',
    180000,
  );
  const compileObservation = await preserveExecution('compile', compile);
  assert(
    compile.code === 0 && !compile.error,
    `Activation component compilation failed (actual exit=${compile.code}); raw diagnostics: ${compileObservation}`,
  );
  const run = await execute(
    executable,
    [
      `--root=${root}`,
      `--fixture=${fixture}`,
      `--only=${selectedCases.join(',')}`,
      `--prior-failures=${priorFailures}`,
    ],
    'Run update activation component',
    180000,
  );
  const runObservation = await preserveExecution('run', run);
  assert(
    !run.error && run.stdoutCapture.eof && run.stderrCapture.eof,
    `${run.error ?? 'Raw stream EOF was not observed'}; actual exit=${run.code}; diagnostics: ${runObservation}`,
  );
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const stdout = decoder.decode(run.stdout);
    decoder.decode(run.stderr);
    report = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Activation component returned invalid UTF-8/JSON (actual exit=${run.code}); original raw diagnostics: ${runObservation}`,
      { cause: error },
    );
  }
  assert.equal(report.kind, 'update-activation-component');
  assert.equal(report.priorFailures, priorFailures);
  assert.equal(report.failureLimit, limit);
  assert.equal(report.totalFailures, priorFailures + report.failures);
  assert.deepEqual(report.selectedCases, selectedCases);
  assert.equal(run.code, report.failures === 0 ? 0 : 1);
  assert(
    report.results.length <= selectedCases.length &&
      new Set(report.results.map((item) => item.name)).size ===
        report.results.length,
  );
  if (report.failures === 0) {
    assert.deepEqual(
      report.results.map((item) => item.name),
      selectedCases,
    );
    assert(report.results.every((item) => item.passed === true));
  }
  assert.deepEqual(
    await sourceHashes(),
    before,
    'Source changed during component execution.',
  );
  report = {
    ...report,
    work,
    sourceHashes: before,
    executions,
    buildMetadataSha256: hash(await readFile(metadata)),
    executableSha256: hash(await readFile(executable)),
    scope:
      'actual-owner-only-named-pipe-and-signed-managed-controller; no desktop/service/installer/account/registry/real-network acceptance',
  };
} catch (error) {
  report = {
    ...(report ?? {}),
    schemaVersion: 1,
    kind: 'update-activation-component',
    work,
    priorFailures,
    failureLimit: limit,
    failures: (report?.failures ?? 0) + 1,
    totalFailures: priorFailures + (report?.failures ?? 0) + 1,
    selectedCases,
    sourceHashes: before,
    executions,
    error: error.stack,
    scope:
      'component preparation or harness failure; no product acceptance claim',
  };
}
const output = join(work, 'report.json');
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    report: output,
    failures: report.failures,
    totalFailures: report.totalFailures,
    scope: report.scope,
  }),
);
if (report.failures) process.exitCode = 1;
