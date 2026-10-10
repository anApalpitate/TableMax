import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  copyFile,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  ScreenshotPolicy,
  writeScreenshot,
  registerArtifacts,
  retirementPlan,
} from './verification-artifacts.mjs';
import { nodeRuntimeInputs } from '../build/node-runtime-inputs.mjs';

test('representative screenshots keep role and 4K boundaries; all retains representatives and failure evidence', () => {
  const selected = new ScreenshotPolicy('representative');
  assert.equal(
    selected.path('host-a.png', { label: 'host-1280x720', layout: true }),
    'host-a.png',
  );
  assert.equal(
    selected.path('host-b.png', { label: 'host-1920x1080', layout: true }),
    null,
  );
  assert.equal(
    selected.path('host-4k.png', { label: 'host-3840x2160', layout: true }),
    'host-4k.png',
  );
  assert.equal(
    selected.path('player.png', { label: 'player-320x568', layout: true }),
    'player.png',
  );
  assert.equal(selected.path('failure.png'), 'failure.png');
  assert.equal(
    selected.path('vote.png', { label: 'team-vote-player', layout: true }),
    'vote.png',
  );
  const all = new ScreenshotPolicy('all');
  assert.equal(
    all.path('host-a.png', { label: 'host', layout: true }),
    'host-a.png',
  );
  assert.equal(
    all.path('host-b.png', { label: 'host', layout: true }),
    'process/host-b.png',
  );
  assert.throws(() => new ScreenshotPolicy('invalid'));
});

test('Node cache fingerprints follow pinned runtime, not game or protocol inputs', async () => {
  const content = new Map([
    ['tools/build/setup-desktop.mjs', 'prepare'],
    ['tools/shared/workspace-root.mjs', 'root helper'],
    ['tools/build/node-runtime-inputs.mjs', 'inputs'],
  ]);
  const read = async (path) => content.get(path);
  const options = { version: '22.14.0', archiveSha256: 'a'.repeat(64), read };
  const first = await nodeRuntimeInputs(options);
  content.set('packages/protocol/src/index.ts', 'changed');
  content.set('package.json', 'changed');
  assert.deepEqual(await nodeRuntimeInputs(options), first);
  assert.notDeepEqual(
    await nodeRuntimeInputs({ ...options, archiveSha256: 'b'.repeat(64) }),
    first,
  );
  content.set('tools/build/setup-desktop.mjs', 'changed preparer');
  assert.notDeepEqual(await nodeRuntimeInputs(options), first);
});

test('artifact registry preserves failures, report references and unknown directories; hashes exact screenshot aliases', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tablemax-maintenance-test-'));
  try {
    const output = join(root, 'artifacts/uno/validation/test');
    const work = join(root, 'tmp/game-review-Ab1234');
    await mkdir(output, { recursive: true });
    await mkdir(work, { recursive: true });
    await mkdir(join(root, 'docs'), { recursive: true });
    await mkdir(join(root, 'artifacts/releases'), { recursive: true });
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'tablemax', version: '1.0.6' }),
    );
    await writeFile(join(root, 'README.md'), 'readme');
    await writeFile(
      join(root, 'artifacts/releases/TableMax-1.0.6-win-x64.zip'),
      'archive',
    );
    await writeFile(join(work, 'node.exe'), 'runtime');
    const aliases = [];
    assert.equal(
      await writeScreenshot(output, 'a.png', Buffer.from('image'), aliases),
      'a.png',
    );
    assert.equal(
      await writeScreenshot(output, 'b.png', Buffer.from('image'), aliases),
      'a.png',
    );
    assert.equal(aliases.length, 1);
    await assert.rejects(
      writeScreenshot(output, '../unsafe.png', Buffer.from('image'), aliases),
      /Unsafe/,
    );
    // Registry testing does not invoke an encoder: the real codec has its own
    // regression test, while this fixture freezes a pre-existing process image.
    await mkdir(join(output, 'process'), { recursive: true });
    await writeFile(join(output, 'process/extra.webp'), 'extra');
    const reportPath = join(output, 'results.json');
    await writeFile(reportPath, JSON.stringify({ result: 'failed' }));
    await registerArtifacts({ root, output, reportPath, work, passed: false });
    assert.equal((await retirementPlan(root)).entries.length, 0);
    await assert.rejects(
      registerArtifacts({ root, output, reportPath, work, passed: true }),
      /unsuccessful/,
    );
    await writeFile(reportPath, JSON.stringify({ result: 'passed' }));
    await registerArtifacts({ root, output, reportPath, work, passed: true });
    assert.equal((await retirementPlan(root)).entries.length, 0);
    let plan = await retirementPlan(root, { minimumAgeMinutes: 0 });
    assert.equal(plan.entries.length, 2);
    assert.equal(
      plan.currentArchiveSha256,
      createHash('sha256').update('archive').digest('hex'),
    );
    assert.ok(plan.entries.every((entry) => entry.evidence.length === 2));
    await writeFile(
      join(root, 'docs/linked.md'),
      '![keep](../artifacts/uno/validation/test/process/extra.webp)',
    );
    plan = await retirementPlan(root, { minimumAgeMinutes: 0 });
    assert.equal(plan.entries.length, 1);
    assert.equal(plan.skipped.length, 1);
    await assert.rejects(
      registerArtifacts({
        root,
        output,
        reportPath,
        work: join(root, 'tmp/research'),
        passed: true,
      }),
      /Unrecognized/,
    );
    if (process.platform === 'win32') {
      await writeFile(join(root, 'docs/linked.md'), 'no reference');
      const planPath = join(root, 'artifacts/maintenance/plan.json');
      plan = await retirementPlan(root, { minimumAgeMinutes: 0 });
      await writeFile(planPath, JSON.stringify(plan));
      const cleanup = await readFile(
        resolve('tools/maintenance/cleanup-local.ps1'),
        'utf8',
      );
      const functions = cleanup.slice(
        cleanup.indexOf('function Assert-LocalPath'),
        cleanup.indexOf('function Read-VerificationProof'),
      );
      const candidate = cleanup.slice(
        cleanup.indexOf('function Add-Candidate'),
        cleanup.indexOf(". (Join-Path $PSScriptRoot 'cleanup-guard.ps1')"),
      );
      const harness = join(root, 'guard-test.ps1');
      const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
      await writeFile(
        harness,
        `$ErrorActionPreference='Stop'\n$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath\n$workspace=${quote(root)}\n$maintenance=Join-Path $workspace 'artifacts/maintenance'\n$archiveHash=${quote(plan.currentArchiveSha256)}\n$RegisteredArtifactsManifest=${quote(planPath)}\nAdd-Type -Path ${quote(resolve('tools/maintenance/WorkspaceSnapshot.cs'))}\n${functions}\n${candidate}\n. ${quote(resolve('tools/maintenance/registered-artifacts.ps1'))}\n$candidates=New-Object 'System.Collections.Generic.List[object]'\n$skipped=New-Object 'System.Collections.Generic.List[object]'\n$cutoff=[DateTime]::UtcNow.AddMinutes(-30)\nInitialize-RegisteredArtifacts\nif($candidates.Count -ne 0 -or $skipped.Count -ne 2){throw 'Recent artifacts not protected'}\n$entry=$plan=$null\n$plan=Get-Content -LiteralPath $RegisteredArtifactsManifest -Raw | ConvertFrom-Json\n$entry=$plan.entries[0]\nSet-Content -LiteralPath (Join-Path $workspace 'tmp/game-review-Ab1234/node.exe') -Value 'tampered'\n$blocked=$false\ntry{Assert-RegisteredArtifact $entry}catch{$blocked=$true}\nif(-not $blocked){throw 'Tampered artifact not blocked'}\nWrite-Output 'Recent and changed artifacts protected'\n`,
      );
      const run = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness],
        { encoding: 'utf8', windowsHide: true },
      );
      assert.equal(run.status, 0, run.stdout + run.stderr);
      // Exercise the public deletion path only against this isolated fixture.
      await writeFile(join(work, 'node.exe'), 'runtime');
      await mkdir(join(root, 'tools/maintenance'), { recursive: true });
      for (const name of [
        'cleanup-local.ps1',
        'cleanup-guard.ps1',
        'registered-artifacts.ps1',
        'WorkspaceSnapshot.cs',
      ])
        await copyFile(
          resolve('tools/maintenance', name),
          join(root, 'tools/maintenance', name),
        );
      await mkdir(join(root, 'artifacts/maintenance/delivery'), {
        recursive: true,
      });
      await writeFile(
        join(root, 'artifacts/maintenance/delivery/results.json'),
        JSON.stringify({
          portable: true,
          result: 'passed',
          archiveSha256: plan.currentArchiveSha256,
        }),
      );
      await mkdir(join(root, 'tmp/unregistered'), { recursive: true });
      await writeFile(join(root, 'tmp/unregistered/keep.txt'), 'unknown');
      const old = new Date(Date.now() - 60 * 60000);
      for (const path of [
        join(work, 'node.exe'),
        join(output, 'process/extra.webp'),
        work,
        join(output, 'process'),
      ])
        await utimes(path, old, old);
      await writeFile(
        harness,
        `$ErrorActionPreference='Stop'\n$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath\nfunction Get-CimInstance { return @() }\n& ${quote(join(root, 'tools/maintenance/cleanup-local.ps1'))} -Kind Intermediates -RegisteredArtifactsManifest ${quote(planPath)}\nif(-not (Test-Path -LiteralPath ${quote(work)})){throw 'Preview deleted files'}\n& ${quote(join(root, 'tools/maintenance/cleanup-local.ps1'))} -Kind Intermediates -RegisteredArtifactsManifest ${quote(planPath)} -Apply\nif(Test-Path -LiteralPath ${quote(work)}){throw 'Eligible work not removed'}\nif(Test-Path -LiteralPath ${quote(join(output, 'process'))}){throw 'Eligible process screenshots not removed'}\nif(-not (Test-Path -LiteralPath ${quote(join(output, 'a.png'))})){throw 'Representative evidence removed'}\nif(-not (Test-Path -LiteralPath ${quote(reportPath)})){throw 'Result removed'}\nif(-not (Test-Path -LiteralPath ${quote(join(root, 'tmp/unregistered/keep.txt'))})){throw 'Unregistered content removed'}\n`,
      );
      const applied = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness],
        { encoding: 'utf8', windowsHide: true },
      );
      assert.equal(applied.status, 0, applied.stdout + applied.stderr);
    }
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'tablemax-maintenance-test-')));
    await rm(root, { recursive: true, force: true });
  }
});
