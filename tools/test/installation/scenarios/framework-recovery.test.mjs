import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { runFrameworkRecoveryScenario } from './framework-recovery.mjs';

test('a successful install remains owned for final cleanup when its first registration assertion fails', async (t) => {
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/framework-scenario-unit-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  const root = join(work, 'installation');
  await mkdir(root);
  const fixture = (sha256) => ({
    manifest: { files: [{ path: 'UpdateHelper.exe', bytes: 1, sha256 }] },
    delivery: {
      executable: {
        installation: {
          recipe: {
            compiler: {
              embeddedUninstallHelper: { encoding: 'base64', bytes: 1, sha256 },
            },
          },
        },
      },
    },
  });
  const report = { old: fixture('a'.repeat(64)), new: fixture('b'.repeat(64)) };
  const lifecycle = { installed: false };
  let registrations = 0;
  const steps = [];
  await assert.rejects(
    runFrameworkRecoveryScenario({
      root,
      work,
      report,
      lifecycle,
      fixtureId: '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
      oldBuild: '1.0.6.60000',
      newBuild: '1.0.6.60001',
      evidence: work,
      actualExecutionInputs: { old: { path: 'never-executed.exe' } },
      registration: async () =>
        ++registrations === 1
          ? null
          : { InstallLocation: join(work, 'wrong-root') },
      execute: async () => ({
        code: 0,
        log: 'synthetic unit result; no PE ran',
      }),
      step: async (id, action) => {
        steps.push(id);
        return action();
      },
    }),
    assert.AssertionError,
  );
  assert.equal(lifecycle.installed, true);
  assert.deepEqual(steps, ['framework-old-inno-install']);
  assert.equal(
    await readFile(join(root, '朋友资料.txt'), 'utf8'),
    'Preserved by actual old-framework recovery\n',
  );
});
