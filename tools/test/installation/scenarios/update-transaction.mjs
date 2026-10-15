/** Real helper scenarios; the entry point owns process lifetime, case ordering and the shared failure budget. */
import { join, dirname, relative, sep, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  copyFile,
  writeFile,
  rename,
  unlink,
  readdir,
  rmdir,
  symlink,
  stat,
  open,
} from 'node:fs/promises';
import {
  writeJson,
  member,
  fileRecord,
  json,
  exists,
  isLink,
} from '../prepare/transaction-fixture.mjs';
import assert from 'node:assert/strict';
import { verifyResourceCleanup } from '../../../release/installation-evidence.mjs';

export function createUpdateTransactionScenarios(context) {
  const {
    work,
    evidence,
    box,
    copyTree,
    inventory,
    candidate,
    manifest,
    small,
    invoke,
    installRoot,
    commitArguments,
    helperRecord,
    transactions,
    commit,
    latestTransaction,
    execute,
    fingerprint,
    databaseNames,
    protectedUnchanged,
    programUnchanged,
    installerSource,
    manifestRecord,
    makeJournal,
    retainJournal,
    identity,
    sid,
    protectedFiles,
    scenarioState,
    missing,
    manifestPath,
    globalMutex,
    withHeldResource,
    sql,
    digest,
    cases,
  } = context;
  async function removeFixtureJunction(link, primaryError) {
    try {
      assert.ok(await isLink(link), 'Owned fixture junction changed: ' + link);
      await rmdir(link);
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          'Scenario and exact junction cleanup both failed',
          { cause: cleanupError },
        );
      throw cleanupError;
    }
  }
  async function uninstallResources(previousIdentity, before, label) {
    return verifyResourceCleanup({
      root: installRoot,
      identity: previousIdentity,
      before,
      directory: join(evidence, 'resource-cleanup', label),
      name: 'final-uninstall-resources.json',
    });
  }
  async function portableSource(external) {
    const source = join(
      work,
      `旧便携 ${external ? '外部' : '默认'}-${randomUUID()}`,
    );
    const data = external ? join(work, '外置 数据-' + randomUUID()) : source;
    await mkdir(data, { recursive: true });
    await mkdir(source, { recursive: true });
    await copyFile(join(box, 'room.sqlite'), join(data, 'room.sqlite'));
    await writeFile(
      join(data, '朋友存档.txt'),
      'Original external/default saved data\n',
    );
    await writeFile(
      join(source, '用户偏好.json'),
      '{"fixture":"old-portable-settings"}\n',
    );
    await copyTree(join(box, 'games'), join(source, 'games'));
    await mkdir(join(source, 'app', 'games'), { recursive: true });
    await writeFile(join(source, 'app', 'modules.json'), '[]\n');
    await writeFile(
      join(source, 'app', 'games', 'legacy-fixture.cjs'),
      'module.exports={fixture:true};\n',
    );
    await writeJson(join(source, 'TableMax.config.json'), {
      dataDirectory: external ? data : '.',
    });
    return {
      source,
      data,
      before: await inventory(source),
      externalBefore: external ? await inventory(data) : null,
    };
  }
  async function pendingCoordinator(repair) {
    const results = [];
    const altered = join(work, 'coordinator-other-target');
    if (repair) {
      await copyTree(candidate, altered);
      const wrong = structuredClone(manifest);
      const changed = wrong.files.find((file) => file.path === small.path);
      await writeFile(
        member(altered, small.path),
        'Own same-build same-helper different payload bytes\n',
      );
      Object.assign(changed, await fileRecord(member(altered, small.path)));
      await writeJson(join(altered, 'installation-manifest.json'), wrong);
    }
    const commitWith = (extra, expected, label) => {
      const names = new Set(extra.map((arg) => arg.slice(0, arg.indexOf('='))));
      return invoke(
        'commit',
        installRoot,
        [
          ...commitArguments.filter(
            (arg) => !names.has(arg.slice(0, arg.indexOf('='))),
          ),
          ...extra,
        ],
        expected,
        label,
      );
    };
    const coordinator = member(installRoot, 'UpdateHelper.exe');
    const expectedHelper = {
      bytes: helperRecord.bytes,
      sha256: helperRecord.sha256,
    };
    for (const fault of ['missing', 'damaged']) {
      const desktop = join(box, 'desktop');
      const preservedDesktop = join(work, `coordinator-${fault}-desktop`);
      await rename(desktop, preservedDesktop);
      await writeFile(desktop, `Own coordinator ${fault} health blocker\n`);
      const blocker = await fileRecord(desktop);
      let desktopRestored = false;
      try {
        const before = await transactions();
        await commit(
          installRoot,
          [],
          40,
          `coordinator-${fault}-health-failure`,
        );
        const directory = await latestTransaction(before);
        const statePath = join(directory, 'state.json');
        assert.equal((await json(statePath)).phase, 'health-failed');
        const changed = await execute(
          member(candidate, 'data/app/node.exe'),
          [
            '-e',
            "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); db.exec('CREATE TABLE IF NOT EXISTS coordinator_recovery_fixture(value TEXT NOT NULL)'); db.prepare('INSERT INTO coordinator_recovery_fixture VALUES (?)').run(process.argv[2]); db.close(); console.log('valid-coordinator-database-changed');",
            join(box, 'room.sqlite'),
            fault,
          ],
          `coordinator-${fault}-database-change`,
        );
        assert.equal(changed.code, 0, changed.log);
        assert.notEqual(
          await fingerprint(box),
          (await json(statePath)).databaseFingerprint,
        );
        const databaseRecords = [];
        for (const name of databaseNames) {
          const path = join(box, name);
          if (await exists(path))
            databaseRecords.push({ path, ...(await fileRecord(path)) });
        }
        const history = await inventory(join(box, 'games'));
        const pending = await inventory(directory);
        const identityRecord = await fileRecord(join(box, '.install.json'));
        const receiptRecord = await fileRecord(
          join(box, '.installer-receipt.json'),
        );
        const unchanged = async (pendingExact = true) => {
          for (const { path, ...record } of databaseRecords)
            assert.deepEqual(await fileRecord(path), record);
          assert.deepEqual(await inventory(join(box, 'games')), history);
          await protectedUnchanged();
          assert.deepEqual(
            await fileRecord(join(box, '.install.json')),
            identityRecord,
          );
          assert.deepEqual(
            await fileRecord(join(box, '.installer-receipt.json')),
            receiptRecord,
          );
          for (const file of pending)
            assert.deepEqual(await fileRecord(member(directory, file.path)), {
              bytes: file.bytes,
              sha256: file.sha256,
            });
          if (pendingExact)
            assert.deepEqual(await inventory(directory), pending);
        };
        if (fault === 'missing') await unlink(coordinator);
        else
          await writeFile(
            coordinator,
            'Own known installed coordinator damaged bytes\n',
          );
        const observed =
          fault === 'missing' ? null : await fileRecord(coordinator);
        const assertFault = async () => {
          if (observed)
            assert.deepEqual(await fileRecord(coordinator), observed);
          else assert.ok(!(await exists(coordinator)));
        };
        if (!repair) {
          for (const mode of ['recover', 'commit']) {
            const output =
              mode === 'commit'
                ? await commit(
                    installRoot,
                    [],
                    40,
                    `coordinator-${fault}-expected-commit-refusal`,
                  )
                : await invoke(
                    'recover',
                    installRoot,
                    [],
                    40,
                    `coordinator-${fault}-expected-recover-refusal`,
                  );
            assert.match(output.output, /默认卸载/);
            await unchanged();
            await assertFault();
          }
          const frameworkHashGate =
            (await exists(coordinator)) &&
            (await fileRecord(coordinator)).sha256 === helperRecord.sha256;
          assert.equal(frameworkHashGate, false);
          results.push({
            fault,
            observed,
            frameworkHashGate,
            expectedCommitExit: 40,
            expectedRecoverExit: 40,
            directory,
            databaseRecords,
            pendingPreserved: true,
          });
          // Restore only this driver's exact injected fault, not a product recovery.
          await copyFile(member(candidate, 'UpdateHelper.exe'), coordinator);
          assert.deepEqual(await fileRecord(coordinator), expectedHelper);
        } else {
          const payload = member(installRoot, small.path);
          await writeFile(
            payload,
            'Own other payload damage must still prevent health\n',
          );
          const damagedPayload = await fileRecord(payload);
          const alteredManifest = join(altered, 'installation-manifest.json');
          const mismatch = await commitWith(
            [`--candidate=${altered}`, `--manifest=${alteredManifest}`],
            10,
            `coordinator-${fault}-mismatched-candidate-refused`,
          );
          assert.match(mismatch.output, /不完全相同/);
          await unchanged();
          await assertFault();
          const wrongSource = join(
            work,
            `coordinator-${fault}-wrong-source.exe`,
          );
          await writeFile(wrongSource, 'Own wrong full installer bytes\n');
          const wrongBytes = await commitWith(
            [`--installer-source=${wrongSource}`],
            10,
            `coordinator-${fault}-mismatched-source-refused`,
          );
          assert.match(wrongBytes.output, /字节身份不匹配/);
          await unchanged();
          await assertFault();
          const invalidTarget = join(
            work,
            `coordinator-${fault}-invalid-target.json`,
          );
          const publicRoots = await json(
            'apps/desktop/native/ApplicationUpdateKeys.json',
          );
          await writeJson(invalidTarget, {
            schemaVersion: 1,
            algorithm: 'RSA3072-SHA256-PKCS1v15',
            keyId: Object.keys(publicRoots.keys)[0],
            payload: Buffer.from('{}').toString('base64'),
            signature: Buffer.alloc(384).toString('base64'),
          });
          const invalidSignature = await commitWith(
            [`--target=${invalidTarget}`],
            10,
            `coordinator-${fault}-invalid-signature-refused`,
          );
          assert.match(invalidSignature.output, /更新签名验证失败/);
          await unchanged();
          await assertFault();
          await commit(
            installRoot,
            [],
            40,
            `coordinator-${fault}-exact-coordinator-restored`,
          );
          assert.deepEqual(await fileRecord(coordinator), expectedHelper);
          assert.deepEqual(await fileRecord(payload), damagedPayload);
          await unchanged(false);
          const repairEntries = (await readdir(directory)).filter((name) =>
            name.startsWith('coordinator-repair-'),
          );
          assert.equal(repairEntries.length, 1);
          const repairDirectory = join(directory, repairEntries[0]);
          const record = await json(join(repairDirectory, 'record.json'));
          assert.equal(record.status, 'restored');
          assert.equal(record.previousMissing, fault === 'missing');
          if (observed)
            assert.deepEqual(
              await fileRecord(join(repairDirectory, 'original-helper')),
              observed,
            );
          else
            assert.ok(
              !(await exists(join(repairDirectory, 'original-helper'))),
            );
          const restoredHelper = join(work, `restored-${fault}-helper.exe`);
          await copyFile(coordinator, restoredHelper);
          assert.deepEqual(await fileRecord(restoredHelper), expectedHelper);
          const uninstallIdentity = await identity();
          const uninstalled = await execute(
            restoredHelper,
            ['--uninstall', `--root=${installRoot}`],
            `coordinator-${fault}-restored-helper-uninstall`,
          );
          assert.equal(uninstalled.code, 0, uninstalled.log);
          for (const { path, ...record } of databaseRecords)
            assert.deepEqual(await fileRecord(path), record);
          const resourceCleanup = await uninstallResources(
            uninstallIdentity,
            history,
            'coordinator-' + fault,
          );
          await protectedUnchanged();
          assert.ok(!(await exists(join(box, '.install.json'))));
          await unlink(desktop);
          await rename(preservedDesktop, desktop);
          desktopRestored = true;
          await commit(
            installRoot,
            [],
            0,
            `coordinator-${fault}-retained-data-reinstall`,
          );
          await programUnchanged();
          await protectedUnchanged();
          const savedRows = await execute(
            member(candidate, 'data/app/node.exe'),
            [
              '-e',
              "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1],{readOnly:true}); const row=db.prepare('SELECT count(*) AS count FROM coordinator_recovery_fixture WHERE value=?').get(process.argv[2]); db.close(); if(!row.count)process.exit(1); console.log('coordinator-saved-row-preserved');",
              join(box, 'room.sqlite'),
              fault,
            ],
            `coordinator-${fault}-saved-row-after-reinstall`,
          );
          assert.equal(savedRows.code, 0, savedRows.log);
          results.push({
            fault,
            observed,
            directory,
            repairDirectory,
            otherPayloadPreserved: damagedPayload,
            actualRestoredHelperUninstall: true,
            rejectedWithoutRepairWrites: [
              'same-build-same-helper-other-payload',
              'different-installer-source',
              'invalid-signed-target',
            ],
            actualReinstallHealth: await json(join(box, 'desktop-check.json')),
            databaseRecords,
            resourceCleanup,
          });
        }
      } finally {
        if (!desktopRestored) {
          assert.deepEqual(await fileRecord(desktop), blocker);
          await unlink(desktop);
          await rename(preservedDesktop, desktop);
        }
      }
      if (!repair) {
        await invoke(
          'recover',
          installRoot,
          ['--health-timeout=90000'],
          0,
          `coordinator-${fault}-driver-fault-restored-reconfirm`,
        );
        await programUnchanged();
      }
    }
    return {
      faults: results,
      boundary: repair
        ? 'Actual temporary fixture helper restores matching coordinator; restored verified bytes execute data-preserving helper uninstall with other payload still damaged. No Inno/framework/registration acceptance.'
        : 'Expected old-helper rejections and the exact framework hash precondition are asserted. Driver restores only its own helper/cache faults afterward; no Inno/framework operation or product self-repair claim.',
    };
  }
  const implementations = {
    'pending-coordinator-repro': () => pendingCoordinator(false),
    'pending-coordinator-recovery': () => pendingCoordinator(true),
    async 'root-junction'() {
      const target = join(work, 'junction-victim');
      await mkdir(target);
      await writeFile(
        join(target, 'original.txt'),
        'untouched junction target\n',
      );
      const before = await inventory(target),
        link = join(work, 'linked-install');
      await symlink(target, link, 'junction');
      let primaryError;
      try {
        await invoke('recover', link, [], 10, 'root-junction');
        assert.deepEqual(await inventory(target), before);
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        await removeFixtureJunction(link, primaryError);
      }
      return { target, preserved: before };
    },
    async 'candidate-junction'() {
      const root = join(work, 'candidate-link-root'),
        link = join(work, 'linked-candidate');
      await mkdir(root);
      await symlink(candidate, link, 'junction');
      let primaryError;
      try {
        await invoke(
          'commit',
          root,
          [
            `--candidate=${link}`,
            `--manifest=${join(link, 'installation-manifest.json')}`,
            `--installer-source=${installerSource}`,
          ],
          10,
          'candidate-junction',
        );
        assert.deepEqual(await inventory(root), []);
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        await removeFixtureJunction(link, primaryError);
      }
      return { root, originalCandidateSha256: manifestRecord.sha256 };
    },
    async 'managed-collision'() {
      const root = join(work, 'collision-root');
      await mkdir(root);
      const file = join(root, 'TableMax.exe');
      await writeFile(file, 'Unknown original executable bytes\n');
      const before = await fileRecord(file);
      await commit(root, [], 10, 'managed-collision');
      assert.deepEqual(await fileRecord(file), before);
      assert.ok(!(await exists(join(root, 'data', '.install.json'))));
      return { root, preserved: before };
    },
    async 'manifest-path-escape'() {
      const altered = join(work, 'unsafe-manifest-candidate');
      await mkdir(altered);
      const root = join(work, 'unsafe-manifest-root');
      await mkdir(root);
      const protectedPath = join(root, 'data', '用户资料.txt');
      await mkdir(dirname(protectedPath));
      await writeFile(protectedPath, 'Never a managed program member\n');
      const before = await fileRecord(protectedPath),
        testManifest = structuredClone(manifest);
      testManifest.files.push({ path: 'data/用户资料.txt', ...before });
      const path = join(altered, 'installation-manifest.json');
      await writeJson(path, testManifest);
      await invoke(
        'commit',
        root,
        [
          `--candidate=${altered}`,
          `--manifest=${path}`,
          `--installer-source=${installerSource}`,
        ],
        10,
        'manifest-path-escape',
      );
      assert.deepEqual(await fileRecord(protectedPath), before);
      return {
        root,
        protectedPath,
        preserved: before,
        boundary:
          'Allowed managed-program subtree guard; does not treat caller JSON as arbitrary B/D deletion authority.',
      };
    },
    async 'journal-partial-preparation'() {
      const root = join(work, 'pp');
      await mkdir(root);
      const directory = await makeJournal(root, 'preparing');
      const path = member(join(directory, 'next-files'), small.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, 'Partial or changed copy must be retained\n');
      const before = await fileRecord(path),
        state = await fileRecord(join(directory, 'state.json'));
      await invoke('recover', root, [], 30, 'partial-preparation');
      assert.deepEqual(await fileRecord(path), before);
      assert.deepEqual(await fileRecord(join(directory, 'state.json')), state);
      return {
        retainedJournal: await retainJournal(directory),
        preserved: before,
        syntheticJournal: true,
      };
    },
    async 'journal-unknown-phase'() {
      const root = join(work, 'unknown-phase-root');
      await mkdir(root);
      const directory = await makeJournal(root, 'unknown-future-stage'),
        before = await inventory(directory);
      await invoke('recover', root, [], 10, 'unknown-phase');
      assert.deepEqual(await inventory(directory), before);
      return {
        retainedJournal: await retainJournal(directory),
        preserved: before,
        syntheticJournal: true,
      };
    },
    async baseline() {
      await commit();
      await programUnchanged();
      await protectedUnchanged();
      const installed = await identity();
      assert.equal(installed.ownerSid, sid);
      protectedFiles.push(join(box, 'TableMax.config.json'));
      scenarioState.protectedRecords = await Promise.all(
        protectedFiles.map(async (path) => ({
          path,
          ...(await fileRecord(path)),
        })),
      );
      await stat(join(box, 'room.sqlite'));
      scenarioState.baselineReady = true;
      return {
        installRoot,
        installationId: installed.installationId,
        phase: 'completed',
        health: await json(join(box, 'desktop-check.json')),
        protected: scenarioState.protectedRecords,
      };
    },
    async 'unknown-app'() {
      const path = join(box, 'app', '朋友未知文件.txt');
      await writeFile(path, 'Unknown app bytes must remain\n');
      const before = await fileRecord(path);
      try {
        await commit(installRoot, [], 10, 'unknown-app-commit');
        await invoke('uninstall', installRoot, [], 10, 'unknown-app-uninstall');
        await programUnchanged();
        assert.deepEqual(await fileRecord(path), before);
        await protectedUnchanged();
      } finally {
        if (await exists(path)) {
          assert.deepEqual(await fileRecord(path), before);
          await unlink(path);
        }
      }
      return { preserved: before, bothCommitAndUninstallRejected: true };
    },
    async 'unknown-app-junction'() {
      const target = join(work, 'app-link-victim');
      await mkdir(target);
      await writeFile(
        join(target, 'original.txt'),
        'Original linked directory bytes\n',
      );
      const before = await inventory(target),
        link = join(box, 'app', 'foreign-link');
      await symlink(target, link, 'junction');
      let primaryError;
      try {
        await commit(installRoot, [], 10, 'app-junction-commit');
        await invoke(
          'uninstall',
          installRoot,
          [],
          10,
          'app-junction-uninstall',
        );
        assert.deepEqual(await inventory(target), before);
        await programUnchanged();
        await protectedUnchanged();
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        await removeFixtureJunction(link, primaryError);
      }
      return {
        target,
        preserved: before,
        bothCommitAndUninstallRejected: true,
      };
    },
    async 'damaged-repair'() {
      const installed = await identity(),
        before = await transactions();
      const path = member(installRoot, small.path);
      await writeFile(path, 'Damaged but owned original bytes\n');
      const damaged = await fileRecord(path);
      await unlink(member(installRoot, missing.path));
      await commit(installRoot, [], 0, 'damaged-repair');
      await programUnchanged();
      await protectedUnchanged();
      assert.equal((await identity()).installationId, installed.installationId);
      const directory = await latestTransaction(before);
      assert.deepEqual(
        await fileRecord(member(join(directory, 'previous-files'), small.path)),
        damaged,
      );
      assert.equal(
        (await json(join(directory, 'previous-snapshot.json'))).files.find(
          (file) => file.path === missing.path,
        ).missing,
        true,
      );
      return {
        directory,
        repaired: [small.path, missing.path],
        retainedDamaged: damaged,
      };
    },
    async 'bad-candidate'() {
      const altered = join(work, 'changed-candidate');
      await mkdir(altered);
      await copyTree(candidate, altered);
      await writeFile(
        member(altered, small.path),
        'Changed candidate member\n',
      );
      await invoke(
        'commit',
        installRoot,
        [
          `--candidate=${altered}`,
          `--manifest=${member(altered, relative(candidate, manifestPath).split(sep).join('/'))}`,
          `--installer-source=${installerSource}`,
        ],
        10,
        'bad-candidate',
      );
      await programUnchanged();
      await protectedUnchanged();
      return { altered, changedMember: small.path };
    },
    async 'operation-lock'() {
      const name = globalMutex('Operation', installRoot);
      const result = await withHeldResource('mutex', name, () =>
        invoke('recover', installRoot, [], 20, 'operation-lock'),
      );
      await programUnchanged();
      await protectedUnchanged();
      return { mutex: name, durationMs: result.durationMs };
    },
    async 'run-lock'() {
      const name = globalMutex('Run', installRoot);
      await withHeldResource('mutex', name, () =>
        commit(installRoot, [], 20, 'run-lock'),
      );
      await programUnchanged();
      await protectedUnchanged();
      return { mutex: name, controlPipeAbsent: true };
    },
    async 'database-lock'() {
      const path = join(box, 'room.sqlite'),
        before = await fileRecord(path);
      await withHeldResource('file', path, () =>
        commit(installRoot, [], 20, 'database-lock'),
      );
      assert.deepEqual(await fileRecord(path), before);
      await programUnchanged();
      await protectedUnchanged();
      return { path, preserved: before };
    },
    async 'journal-preparing'() {
      const directory = await makeJournal(installRoot, 'preparing');
      const path = member(join(directory, 'next-files'), small.path);
      await mkdir(dirname(path), { recursive: true });
      await copyFile(member(candidate, small.path), path);
      await invoke('recover', installRoot, [], 0, 'journal-preparing');
      assert.equal(
        (await json(join(directory, 'state.json'))).phase,
        'preparation-aborted',
      );
      assert.ok(!(await exists(path)));
      await programUnchanged();
      await protectedUnchanged();
      return {
        directory,
        syntheticJournal: true,
        phase: 'preparation-aborted',
      };
    },
    async 'health-changed-database'() {
      const desktop = join(box, 'desktop'),
        preservedDesktop = join(work, 'health-desktop-original');
      assert.ok(await exists(desktop));
      await rename(desktop, preservedDesktop);
      await writeFile(
        desktop,
        'Owned fault: a file blocks the actual WebView2 cache directory\n',
      );
      const blocker = await fileRecord(desktop),
        before = await transactions();
      let restored = false;
      try {
        await commit(installRoot, [], 40, 'actual-health-failure');
        const directory = await latestTransaction(before),
          statePath = join(directory, 'state.json');
        const state = await json(statePath);
        assert.equal(state.phase, 'health-failed');
        const firstHealthDatabaseFingerprint = await fingerprint(box);
        await sql(installRoot, true);
        assert.notEqual(await fingerprint(box), state.databaseFingerprint);
        const beforeRetry = await fileRecord(statePath),
          database = await fileRecord(join(box, 'room.sqlite'));
        await invoke(
          'recover',
          installRoot,
          ['--health-timeout=90000'],
          40,
          'changed-database-health-failure',
        );
        assert.deepEqual(await fileRecord(statePath), beforeRetry);
        await programUnchanged();
        await protectedUnchanged();
        await sql(installRoot, false);
        assert.deepEqual(await fileRecord(desktop), blocker);
        await unlink(desktop);
        await rename(preservedDesktop, desktop);
        restored = true;
        await invoke(
          'recover',
          installRoot,
          ['--health-timeout=90000'],
          0,
          'changed-database-reconfirmation',
        );
        assert.equal((await json(statePath)).phase, 'completed');
        await sql(installRoot, false);
        await programUnchanged();
        await protectedUnchanged();
        return {
          directory,
          actualHealthFailure: true,
          firstHealthDatabaseFingerprint,
          fingerprintBeforeHealth: state.databaseFingerprint,
          changedDatabase: database,
          phase: 'completed',
          health: await json(join(box, 'desktop-check.json')),
          boundary:
            'A real native startup fails with blocked WebView2 cache; a valid SQLite fixture table then changes the fingerprint. Same-build target reconfirmation is real; this does not claim an actual application schema migration or different-PE rollback test.',
        };
      } finally {
        if (!restored && (await exists(desktop))) {
          assert.deepEqual(await fileRecord(desktop), blocker);
          await unlink(desktop);
          await rename(preservedDesktop, desktop);
        }
      }
    },
    async 'pending-damaged-uninstall'() {
      const desktop = join(box, 'desktop'),
        preservedDesktop = join(work, 'pending-damage-desktop-original');
      assert.ok(await exists(desktop));
      await rename(desktop, preservedDesktop);
      const blockerText =
        'Owned pending-health fault blocks the actual WebView2 cache\n';
      await writeFile(desktop, blockerText);
      const blocker = await fileRecord(desktop),
        before = await transactions();
      let restored = false;
      try {
        await commit(
          installRoot,
          [],
          40,
          'pending-damage-actual-health-failure',
        );
        const directory = await latestTransaction(before),
          statePath = join(directory, 'state.json');
        const state = await json(statePath);
        assert.equal(state.phase, 'health-failed');
        const changed = await execute(
          member(candidate, 'data/app/node.exe'),
          [
            '-e',
            "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); db.exec('CREATE TABLE IF NOT EXISTS pending_damage_fixture (value TEXT NOT NULL)'); db.prepare('INSERT INTO pending_damage_fixture VALUES (?)').run('retained-pending-database'); db.close(); console.log('changed-valid-pending-database');",
            join(box, 'room.sqlite'),
          ],
          'pending-damage-sqlite-change',
        );
        assert.equal(changed.code, 0, changed.log);
        assert.notEqual(await fingerprint(box), state.databaseFingerprint);
        const databaseRecords = [];
        for (const name of databaseNames) {
          const path = join(box, name);
          if (await exists(path))
            databaseRecords.push({ path, ...(await fileRecord(path)) });
        }
        const history = await inventory(join(box, 'games')),
          identityBefore = await fileRecord(join(box, '.install.json')),
          receiptBefore = await fileRecord(
            join(box, '.installer-receipt.json'),
          ),
          stateBefore = await fileRecord(statePath),
          damagedPath = member(installRoot, small.path),
          missingPath = member(installRoot, missing.path),
          damageText =
            'Known owned pending-update damaged bytes must be quarantined\n';
        await writeFile(damagedPath, damageText);
        const damaged = await fileRecord(damagedPath);
        const unchangedData = async (includeGames = true) => {
          for (const file of databaseRecords)
            assert.deepEqual(await fileRecord(file.path), {
              bytes: file.bytes,
              sha256: file.sha256,
            });
          if (includeGames)
            assert.deepEqual(await inventory(join(box, 'games')), history);
          await protectedUnchanged();
        };
        const unchangedPending = async () => {
          await unchangedData();
          assert.deepEqual(await fileRecord(statePath), stateBefore);
          assert.deepEqual(
            await fileRecord(join(box, '.install.json')),
            identityBefore,
          );
          assert.deepEqual(
            await fileRecord(join(box, '.installer-receipt.json')),
            receiptBefore,
          );
        };
        const rejected = [];
        for (const fault of ['damaged-only', 'missing-only']) {
          if (fault === 'missing-only') {
            await copyFile(member(candidate, small.path), damagedPath);
            assert.deepEqual(await fileRecord(damagedPath), {
              bytes: small.bytes,
              sha256: small.sha256,
            });
            await unlink(missingPath);
          }
          for (const mode of ['recover', 'commit']) {
            const result =
              mode === 'commit'
                ? await commit(
                    installRoot,
                    [],
                    40,
                    'pending-' + fault + '-commit',
                  )
                : await invoke(
                    'recover',
                    installRoot,
                    [],
                    40,
                    'pending-' + fault + '-recover',
                  );
            assert.match(result.output, /卸载/);
            assert.match(result.output, /保留/);
            await unchangedPending();
            if (fault === 'damaged-only')
              assert.deepEqual(await fileRecord(damagedPath), damaged);
            else assert.ok(!(await exists(missingPath)));
            rejected.push({ fault, mode, exitCode: result.code });
          }
        }
        await writeFile(damagedPath, damageText);
        assert.deepEqual(await fileRecord(damagedPath), damaged);
        const foreign = join(box, 'app', 'pending-user-unknown.txt');
        await writeFile(
          foreign,
          'Owned test fixture representing unknown user app bytes\n',
        );
        const foreignBefore = await fileRecord(foreign);
        try {
          await invoke(
            'uninstall',
            installRoot,
            [],
            10,
            'pending-unknown-uninstall-refused',
          );
          await unchangedPending();
          assert.deepEqual(await fileRecord(foreign), foreignBefore);
          assert.deepEqual(await fileRecord(damagedPath), damaged);
          assert.ok(!(await exists(missingPath)));
        } finally {
          assert.deepEqual(await fileRecord(foreign), foreignBefore);
          await unlink(foreign);
        }
        const oversized = await open(damagedPath, 'r+');
        try {
          await oversized.truncate(120000000);
        } finally {
          await oversized.close();
        }
        const uninstallIdentity = await identity();
        await invoke(
          'uninstall',
          installRoot,
          [],
          10,
          'pending-oversized-uninstall-refused',
        );
        assert.equal((await stat(damagedPath)).size, 120000000);
        await unchangedPending();
        await writeFile(damagedPath, damageText);
        assert.deepEqual(await fileRecord(damagedPath), damaged);
        const priorQuarantines = new Set(
          ((await exists(join(box, 'updates')))
            ? await readdir(join(box, 'updates'))
            : []
          ).filter((name) => name.startsWith('uninstall-quarantine-')),
        );
        await invoke(
          'uninstall',
          installRoot,
          [],
          0,
          'pending-damaged-default-uninstall',
        );
        const resourceCleanup = await uninstallResources(
          uninstallIdentity,
          history,
          'pending-damaged',
        );
        await unchangedData(false);
        assert.ok(!(await exists(join(box, '.install.json'))));
        for (const file of manifest.files)
          assert.ok(!(await exists(member(installRoot, file.path))), file.path);
        const added = (await readdir(join(box, 'updates'))).filter(
          (name) =>
            name.startsWith('uninstall-quarantine-') &&
            !priorQuarantines.has(name),
        );
        assert.equal(added.length, 1);
        const quarantine = join(box, 'updates', added[0]);
        assert.deepEqual(
          await fileRecord(member(quarantine, small.path)),
          damaged,
        );
        assert.ok(!(await exists(member(quarantine, missing.path))));
        assert.deepEqual(await fileRecord(desktop), blocker);
        await unlink(desktop);
        await rename(preservedDesktop, desktop);
        restored = true;
        await commit(
          installRoot,
          [],
          0,
          'pending-damaged-retained-data-reinstall',
        );
        await programUnchanged();
        await protectedUnchanged();
        const checked = await execute(
          member(candidate, 'data/app/node.exe'),
          [
            '-e',
            "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1],{readOnly:true}); const rows=db.prepare('SELECT value FROM pending_damage_fixture').all(); db.close(); if(!rows.some(row=>row.value==='retained-pending-database'))process.exit(1); console.log('pending-database-content-preserved');",
            join(box, 'room.sqlite'),
          ],
          'pending-damage-reinstalled-sqlite-check',
        );
        assert.equal(checked.code, 0, checked.log);
        for (const file of history)
          assert.deepEqual(
            await fileRecord(member(join(box, 'games'), file.path)),
            { bytes: file.bytes, sha256: file.sha256 },
          );
        return {
          directory,
          actualHealthFailure: true,
          rejected,
          unknownAppRejected: true,
          oversizedOwnedRejected: true,
          quarantine,
          damaged,
          databaseRecords,
          health: await json(join(box, 'desktop-check.json')),
          resourceCleanup,
          boundary:
            'Real native health failure plus changed valid SQLite and independently damaged-only/missing-only owned files. Driver restores only its fault bytes between independent branches. Recover/commit preserve diagnostics; default helper uninstall quarantines owned damage and keeps D/G/config before same full fixture reinstall health. No Inno/framework uninstall, different-PE upgrade or actual schema migration claim.',
        };
      } finally {
        if (!restored && (await exists(desktop))) {
          assert.deepEqual(await fileRecord(desktop), blocker);
          await unlink(desktop);
          await rename(preservedDesktop, desktop);
        }
      }
    },
    async 'portable-lock'() {
      const original = await portableSource(false),
        root = join(work, 'portable-locked-install');
      await mkdir(root);
      const name =
        'Local\\TableMax-' +
        digest(Buffer.from(resolve(original.data).toUpperCase()))
          .slice(0, 32)
          .toUpperCase();
      await withHeldResource('mutex', name, () =>
        commit(
          root,
          [`--migration-root=${original.source}`],
          20,
          'portable-lock',
        ),
      );
      assert.deepEqual(await inventory(original.source), original.before);
      assert.ok(!(await exists(join(root, 'data', '.install.json'))));
      return {
        root,
        original: original.source,
        mutex: name,
        preserved: original.before,
      };
    },
    async 'portable-default'() {
      return await migrate(false);
    },
    async 'portable-external'() {
      return await migrate(true);
    },
    async 'uninstall-reinstall'() {
      const before = await identity();
      const unknownGamePath = join(box, 'games', '朋友保留资料.txt');
      await writeFile(
        unknownGamePath,
        'Unknown game-directory data must survive helper uninstall.\n',
        { flag: 'wx' },
      );
      const unknownGameBefore = await fileRecord(unknownGamePath);
      const history = await inventory(join(box, 'games')),
        database = await fileRecord(join(box, 'room.sqlite'));
      const damagedPath = member(installRoot, small.path);
      await writeFile(
        damagedPath,
        'Owned damaged bytes must be quarantined before uninstall\n',
      );
      const damaged = await fileRecord(damagedPath);
      await invoke('uninstall', installRoot, [], 0, 'default-uninstall');
      for (const file of manifest.files)
        assert.ok(!(await exists(member(installRoot, file.path))), file.path);
      assert.ok(!(await exists(join(box, '.install.json'))));
      assert.equal(
        (await json(join(box, '.uninstalled.json'))).installationId,
        before.installationId,
      );
      await protectedUnchanged();
      const resourceCleanup = await uninstallResources(
        before,
        history,
        'uninstall-reinstall',
      );
      assert.deepEqual(
        await fileRecord(unknownGamePath),
        unknownGameBefore,
        'Unknown game-directory file must be retained',
      );
      assert.deepEqual(await fileRecord(join(box, 'room.sqlite')), database);
      const quarantines = (await readdir(join(box, 'updates'))).filter((name) =>
        name.startsWith('uninstall-quarantine-'),
      );
      assert.equal(quarantines.length, 1);
      assert.deepEqual(
        await fileRecord(
          member(join(box, 'updates', quarantines[0]), small.path),
        ),
        damaged,
      );
      await commit(installRoot, [], 0, 'reinstall-retained-data');
      await programUnchanged();
      await protectedUnchanged();
      if (scenarioState.sqlFixtureCreated) await sql(installRoot, false);
      return {
        retainedDatabase: database,
        history,
        resourceCleanup,
        unknownGameBefore,
        damagedQuarantine: join(box, 'updates', quarantines[0]),
        boundary:
          'Helper-owned program files only; Inno framework uninstaller, shortcut and registration effects are separate.',
      };
    },
  };
  async function migrate(external) {
    const original = await portableSource(external),
      root = join(work, `迁移 安装-${randomUUID()}`);
    await mkdir(root);
    await commit(
      root,
      [`--migration-root=${original.source}`],
      0,
      external ? 'portable-external' : 'portable-default',
    );
    await programUnchanged(root);
    assert.deepEqual(await inventory(original.source), original.before);
    if (external)
      for (const file of original.externalBefore)
        assert.deepEqual(await fileRecord(member(original.data, file.path)), {
          bytes: file.bytes,
          sha256: file.sha256,
        });
    const newBox = join(root, 'data'),
      config = await json(join(newBox, 'TableMax.config.json'));
    assert.equal(config.dataDirectory, external ? original.data : '.');
    for (const file of original.before.filter((file) =>
      file.path.startsWith('games/'),
    ))
      assert.deepEqual(await fileRecord(member(newBox, file.path)), {
        bytes: file.bytes,
        sha256: file.sha256,
      });
    const legacy = await inventory(join(newBox, 'games', '.legacy'));
    assert.ok(
      legacy.some((file) => file.path.endsWith('/games/legacy-fixture.cjs')),
    );
    if (!external)
      assert.deepEqual(
        await fileRecord(join(newBox, '朋友存档.txt')),
        await fileRecord(join(original.source, '朋友存档.txt')),
      );
    else assert.ok(!(await exists(join(newBox, '朋友存档.txt'))));
    return {
      root,
      original: original.source,
      dataDirectory: config.dataDirectory,
      originalFiles: original.before,
      externalFiles: original.externalBefore,
      legacy,
      legacyFixture:
        'Valid empty module list; preservation-only arbitrary legacy bytes',
      boundary:
        'Real helper migration and native startup using current-valid synthetic SQLite/settings/G and a valid empty legacy module list. Legacy bytes are preserved without claiming a playable historical release. No old service is running during these copy cases. Continuous snapshot lease, cross-session exclusion and actual old-version saved-game/credential compatibility remain separate gates.',
    };
  }
  for (const [id, baseline] of cases.filter(
    ([id]) => id.startsWith('journal-') && !implementations[id],
  )) {
    implementations[id] = async () => {
      const phase = {
        'journal-prepared': 'prepared',
        'journal-switching': 'switching',
        'journal-installed': 'installed',
        'journal-health-unchanged': 'health-failed',
      }[id];
      const directory = await makeJournal(installRoot, phase, true);
      if (phase === 'switching') await unlink(member(installRoot, small.path));
      await invoke('recover', installRoot, [], 0, id);
      assert.equal(
        (await json(join(directory, 'state.json'))).phase,
        'rolled-back',
      );
      await programUnchanged();
      await protectedUnchanged();
      await invoke('recover', installRoot, [], 0, id + '-cleanup');
      assert.ok(!(await exists(join(directory, 'previous-files'))));
      return {
        directory,
        phase: 'rolled-back',
        syntheticJournal: true,
        exactSnapshot: true,
        boundary:
          'Constructed persistent interruption boundary with exact same-build previous snapshot; does not claim OS power loss or different-build end-to-end update.',
      };
    };
    assert.equal(baseline, true);
  }
  return implementations;
}
