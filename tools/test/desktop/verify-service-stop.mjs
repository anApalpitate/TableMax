import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import {
  createInstallationFixture,
  protectedFixtureHashes,
} from '../support/installation-fixture.mjs';
import { extractCurrentDelivery } from '../support/shipping-input.mjs';
import { digest } from '../runner/evidence.mjs';
import { verificationOutput } from '../support/verification-output.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { packService } from '../../build/service-brotli.mjs';

assertWorkspaceRoot();
assert.equal(process.platform, 'win32');
const run = promisify(execFile);
const fixture = createInstallationFixture();
const startedAt = new Date().toISOString();
const output = resolve(
  process.env.TABLEMAX_TEST_OUTPUT_DIR ??
    verificationOutput(
      'installation-phase1',
      'service-stop-' + fixture.identity,
    ),
);
await mkdir(output, { recursive: true });
const before = fixture.snapshot();
const protectedBefore = protectedFixtureHashes(fixture);
const sources = [
  'tools/test/support/service-stop-harness.cs',
  'apps/desktop/native/ServiceProcess.cs',
  'apps/desktop/native/NativeMethods.cs',
  'apps/desktop/native/Json.cs',
];
const checks = [];
let failure;
let delivery;
let candidate;
let toolchain;
try {
  const sdks = (await run('dotnet', ['--list-sdks'], { windowsHide: true }))
    .stdout;
  const match = /^9\.0\.102 \[(.+)\]\r?$/m.exec(sdks);
  assert.ok(match, 'Locked SDK 9.0.102 is required');
  const compiler = join(match[1], '9.0.102', 'Roslyn', 'bincore', 'csc.dll');
  const references = resolve(
    '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
  );
  toolchain = {
    sdk: '9.0.102',
    compilerSha256: digest(await readFile(compiler)),
    node: '22.14.0',
    nodeSha256: digest(
      await readFile(resolve('.cache/node/22.14.0/runtime/node.exe')),
    ),
    net48ReferenceVersion: '1.0.3',
  };
  const harness = fixture.path('ServiceStopHarness.exe');
  await run(
    'dotnet',
    [
      compiler,
      '/nologo',
      '/target:exe',
      '/platform:x64',
      '/langversion:12',
      '/nostdlib+',
      '/out:' + harness,
      ...['mscorlib', 'System', 'System.Core', 'System.Web.Extensions'].map(
        (name) => '/reference:' + join(references, name + '.dll'),
      ),
      ...sources.map((path) => resolve(path)),
    ],
    { windowsHide: true, timeout: 60000 },
  );
  await copyFile(
    resolve('.cache/node/22.14.0/runtime/node.exe'),
    join(fixture.app, 'node.exe'),
  );
  await build({
    entryPoints: ['tools/test/support/service-stop-child.mjs'],
    outfile: join(fixture.app, 'server.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'warning',
  });
  for (const [mode, expected, confirmed] of [
    ['not-started', 'not-started', false],
    ['drained', 'drained', true],
    ['no-confirmation', 'failed', false],
    ['save-failed', 'save-failed', false],
    ['invalid-confirmation', 'failed', false],
    ['nonzero-exit', 'failed', false],
    ['hang', 'forced', false],
  ]) {
    const { stdout } = await run(
      harness,
      [mode, fixture.app, fixture.box, fixture.externalData],
      { windowsHide: true, timeout: 15000 },
    );
    assert.ok(!stdout.includes('fixture-private'));
    const result = JSON.parse(stdout.trim());
    assert.equal(result.status, expected, mode);
    assert.equal(result.confirmed, confirmed, mode);
    assert.equal(result.repeatedStopShared, true);
    if (mode === 'not-started') assert.equal(result.restartRejected, true);
    if (result.pid)
      assert.throws(
        () => process.kill(result.pid, 0),
        (error) => error.code === 'ESRCH',
      );
    assert.deepEqual(protectedFixtureHashes(fixture), protectedBefore);
    checks.push(result);
  }
  delivery = await extractCurrentDelivery({ work: fixture.work });
  const source = join(delivery.extracted, 'server.cjs');
  await build({
    entryPoints: ['apps/server/src/entry.ts'],
    outfile: source,
    bundle: true,
    minify: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'warning',
  });
  await packService(source);
  candidate = {
    source: 'current workspace server candidate; not a new release',
    files: await Promise.all(
      ['server.cjs', 'server.cjs.br'].map(async (name) => ({
        name,
        sha256: digest(await readFile(join(delivery.extracted, name))),
      })),
    ),
  };
  const actual = await run(
    harness,
    ['real-entry', delivery.extracted, fixture.box, fixture.externalData],
    { windowsHide: true, timeout: 45000 },
  );
  const result = JSON.parse(actual.stdout.trim());
  assert.equal(result.status, 'drained');
  assert.equal(result.confirmed, true);
  assert.throws(
    () => process.kill(result.pid, 0),
    (error) => error.code === 'ESRCH',
  );
  const database = new DatabaseSync(join(fixture.externalData, 'room.sqlite'), {
    readOnly: true,
  });
  try {
    assert.equal(
      database.prepare('PRAGMA quick_check').get().quick_check,
      'ok',
    );
    const stored = JSON.parse(
      database.prepare('SELECT data FROM saves WHERE id=1').get().data,
    );
    assert.equal((stored.value ?? stored).seats[0].name, '关闭测试');
  } finally {
    database.close();
  }
  assert.deepEqual(protectedFixtureHashes(fixture), protectedBefore);
  await delivery.assertUnchanged();
  checks.push({ ...result, sqliteReopened: true, committedJoinRetained: true });
} catch (error) {
  failure = error.stack;
  process.exitCode = 1;
} finally {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(
      {
        result: failure ? 'failed' : 'passed',
        startedAt,
        finishedAt: new Date().toISOString(),
        fixture: {
          kind: 'filesystem-only',
          identity: fixture.identity,
          work: fixture.work,
          before,
          after: fixture.snapshot(),
          protectedBefore,
          protectedAfter: protectedFixtureHashes(fixture),
        },
        cacheable: false,
        systemInstallationTested: false,
        toolchain,
        delivery: delivery?.binding,
        candidate,
        methodFiles: await Promise.all(
          sources.map(async (path) => ({
            path,
            sha256: digest(await readFile(path)),
          })),
        ),
        checks,
        failure,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: failure ? 'failed' : 'passed',
      checks: checks.length,
      output,
    }),
  );
  if (failure) console.error(failure);
}
