import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createUpdateTransactionScenarios } from './update-transaction.mjs';
import { isLink } from '../prepare/transaction-fixture.mjs';

async function fixture(t) {
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/transaction-scenario-unit-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  return work;
}

test('collision scenario observes helper refusal and preserves the original unknown bytes', async (t) => {
  const work = await fixture(t);
  const calls = [];
  const scenarios = createUpdateTransactionScenarios({
    work,
    cases: [],
    commit: async (...args) => {
      calls.push(args);
    },
  });
  const result = await scenarios['managed-collision']();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1), [[], 10, 'managed-collision']);
  assert.equal(
    await readFile(join(result.root, 'TableMax.exe'), 'utf8'),
    'Unknown original executable bytes\n',
  );
});

test('collision scenario still fails if an injected operation modifies the protected unknown file', async (t) => {
  const work = await fixture(t);
  const scenarios = createUpdateTransactionScenarios({
    work,
    cases: [],
    commit: async (root) =>
      writeFile(join(root, 'TableMax.exe'), 'Unexpected mutation'),
  });
  await assert.rejects(scenarios['managed-collision'](), assert.AssertionError);
});

test('baseline scenario updates caller-owned lifecycle state for the existing runner and finalizer', async (t) => {
  const work = await fixture(t);
  const box = join(work, 'data');
  await mkdir(box);
  await writeFile(join(box, 'TableMax.config.json'), '{}');
  await writeFile(
    join(box, 'room.sqlite'),
    'Synthetic preserved bytes; not opened as SQLite.',
  );
  await writeFile(join(box, 'desktop-check.json'), '{"fixture":"unit"}');
  const scenarioState = {
    baselineReady: false,
    protectedRecords: [],
    sqlFixtureCreated: false,
  };
  const protectedFiles = [];
  const scenarios = createUpdateTransactionScenarios({
    work,
    box,
    installRoot: work,
    cases: [],
    scenarioState,
    protectedFiles,
    sid: 'fixture-unit-sid',
    commit: async () => {},
    programUnchanged: async () => {},
    protectedUnchanged: async () => {},
    identity: async () => ({
      ownerSid: 'fixture-unit-sid',
      installationId: 'fixture-unit-id',
    }),
  });
  const result = await scenarios.baseline();
  assert.equal(scenarioState.baselineReady, true);
  assert.equal(result.installationId, 'fixture-unit-id');
  assert.deepEqual(protectedFiles, [join(box, 'TableMax.config.json')]);
  assert.deepEqual(result.protected, scenarioState.protectedRecords);
  assert.equal(scenarioState.protectedRecords.length, 1);
});

for (const id of ['root-junction', 'candidate-junction']) {
  test(
    `${id} scenario observes refusal and removes only its exact fixture junction`,
    { skip: process.platform !== 'win32' },
    async (t) => {
      const work = await fixture(t);
      const candidate = join(work, 'original-candidate');
      await mkdir(candidate);
      await writeFile(
        join(candidate, 'original.txt'),
        'Original synthetic candidate\n',
      );
      const before = await readFile(join(candidate, 'original.txt'));
      const calls = [];
      const scenarios = createUpdateTransactionScenarios({
        work,
        candidate,
        installerSource: join(work, 'not-executed.exe'),
        manifestRecord: { sha256: 'fixture-record' },
        cases: [],
        inventory: async (directory) =>
          await Promise.all(
            (await readdir(directory)).map(async (name) => ({
              name,
              text: await readFile(join(directory, name), 'utf8'),
            })),
          ),
        invoke: async (...args) => {
          calls.push(args);
          assert.equal(args[3], 10);
        },
      });
      const result = await scenarios[id]();
      assert.equal(calls.length, 1);
      assert.equal(
        await isLink(
          join(
            work,
            id === 'root-junction' ? 'linked-install' : 'linked-candidate',
          ),
        ),
        false,
      );
      assert.deepEqual(await readFile(join(candidate, 'original.txt')), before);
      if (id === 'root-junction')
        assert.equal(
          await readFile(join(result.target, 'original.txt'), 'utf8'),
          'untouched junction target\n',
        );
    },
  );
}

test(
  'junction scenario preserves the original error when exact cleanup also rejects a changed entry',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const work = await fixture(t);
    const primary = new Error('Original helper observation failure');
    const link = join(work, 'linked-install');
    const scenarios = createUpdateTransactionScenarios({
      work,
      cases: [],
      inventory: async (directory) =>
        await Promise.all(
          (await readdir(directory)).map(async (name) => ({
            name,
            text: await readFile(join(directory, name), 'utf8'),
          })),
        ),
      invoke: async () => {
        await rmdir(link);
        await writeFile(
          link,
          'Replacement must not be deleted by junction cleanup',
        );
        throw primary;
      },
    });
    await assert.rejects(scenarios['root-junction'](), (error) => {
      assert(error instanceof AggregateError);
      assert.equal(error.errors[0], primary);
      assert(error.errors[1] instanceof assert.AssertionError);
      return true;
    });
    assert.equal(
      await readFile(link, 'utf8'),
      'Replacement must not be deleted by junction cleanup',
    );
    assert.equal(
      await readFile(join(work, 'junction-victim', 'original.txt'), 'utf8'),
      'untouched junction target\n',
    );
  },
);
