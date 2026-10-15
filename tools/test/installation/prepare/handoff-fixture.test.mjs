import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { prepareHandoffFixture, record } from './handoff-fixture.mjs';

async function fixture(t) {
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/handoff-prepare-unit-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  const nativeTemplate = join(work, 'template');
  await mkdir(nativeTemplate);
  for (const name of [
    'TableMax.exe.config',
    'Microsoft.Web.WebView2.Core.dll',
    'Microsoft.Web.WebView2.WinForms.dll',
    'WebView2Loader.dll',
  ])
    await writeFile(
      join(nativeTemplate, name),
      'Synthetic compile input; never loaded.',
    );
  return {
    repository: resolve('.'),
    work,
    report: {},
    nativeTemplate,
    serverDirectory: work,
    webDirectory: work,
  };
}

test('failed fixture compilation retains the original failure and never invokes packaging', async (t) => {
  const input = await fixture(t);
  const commands = [];
  let packages = 0;
  const prepared = await prepareHandoffFixture({
    ...input,
    execute: async (executable, args, label) => {
      commands.push({ executable, args, label });
      return { code: 23, log: 'retained-compile-log' };
    },
    createPackage: async () => {
      packages++;
      throw new Error('Packaging must not start');
    },
  });
  assert.equal(
    commands.length,
    0,
    'Factory initialization must not compile or run a PE',
  );
  await assert.rejects(
    prepared.fixture(prepared.oldBuild, false),
    /retained-compile-log/,
  );
  assert.equal(commands.length, 1);
  assert.equal(commands[0].executable, 'dotnet');
  assert.ok(commands[0].args.includes('/define:TABLEMAX_INSTALLATION_TEST'));
  assert.equal(packages, 0);
  const trust = JSON.parse(await readFile(prepared.trust, 'utf8'));
  assert.equal(trust.schemaVersion, 1);
  assert.ok(!JSON.stringify(trust).includes('PRIVATE'));
});

test('prepared public trust bytes must match before any compiler or package operation', async (t) => {
  const input = await fixture(t);
  const publicFile = join(input.work, 'original-public.json');
  await writeFile(publicFile, '{"schemaVersion":1,"keys":{}}');
  const original = await record(publicFile);
  await assert.rejects(
    prepareHandoffFixture({
      ...input,
      prepared: { fixturePublicKey: { ...original, sha256: '0'.repeat(64) } },
      execute: () => {
        throw new Error('Must not execute');
      },
    }),
    assert.AssertionError,
  );
  assert.deepEqual(await record(publicFile), original);
});

test('prepared verification rejects an incomplete method dependency closure', async (t) => {
  const input = await fixture(t);
  const publicFile = join(input.work, 'original-public.json');
  await writeFile(publicFile, '{"schemaVersion":1,"keys":{}}');
  const prepared = await prepareHandoffFixture({
    ...input,
    prepared: { fixturePublicKey: await record(publicFile), sourceHashes: {} },
    execute: () => {
      throw new Error('Must not execute');
    },
  });
  assert.ok(
    Object.hasOwn(
      input.report.sourceHashes,
      'tools/test/installation/scenarios/application-handoff.mjs',
    ),
  );
  await assert.rejects(
    prepared.verifyPrepared(),
    /Prepared method dependency declaration changed/,
  );
});
