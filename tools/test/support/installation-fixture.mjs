import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  lstatSync,
} from 'node:fs';
import { join, resolve, relative, dirname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, keyOf } from '../runner/evidence.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

/** Filesystem-only installation-shaped fixture. Never registers or installs an app. */
export function createInstallationFixture() {
  assertWorkspaceRoot();
  const temporary = resolve('tmp');
  mkdirSync(temporary, { recursive: true });
  assertNoLinks(temporary);
  const work = mkdtempSync(join(temporary, 'installation-fixture-'));
  const install = join(work, '程序 目录');
  const box = join(install, 'TableMax');
  const app = join(box, 'app');
  const games = join(box, 'games');
  const externalData = join(work, '外置 数据');
  for (const directory of [app, games, externalData])
    mkdirSync(directory, { recursive: true });
  const identity = randomUUID();
  writeFileSync(
    join(work, '.fixture.json'),
    JSON.stringify({ fixture: 'filesystem-only', identity }),
  );
  writeFileSync(join(box, 'TableMax.config.json'), '{"dataDirectory":"."}\n');
  const protectedFiles = [
    join(install, '朋友资料.txt'),
    join(games, '原局模块.txt'),
    join(externalData, '原存档.txt'),
  ];
  for (const path of protectedFiles)
    writeFileSync(path, 'isolated fixture original\n');
  return {
    identity,
    work,
    install,
    box,
    app,
    games,
    externalData,
    protectedFiles,
    snapshot: () => snapshotFixture(work, identity),
    path: (name) => fixturePath(work, name),
  };
}

function assertNoLinks(path) {
  for (let current = resolve(path); ; current = dirname(current)) {
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error('Fixture path contains a link');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (dirname(current) === current) break;
  }
}

export function fixturePath(work, name) {
  const root = resolve(work);
  const result = resolve(root, name);
  if (result !== root && !result.startsWith(root + sep))
    throw new Error('Fixture path escapes its root');
  assertNoLinks(result);
  return result;
}

export function snapshotFixture(work, expectedIdentity) {
  const root = fixturePath(work, '.');
  const marker = JSON.parse(
    readFileSync(fixturePath(root, '.fixture.json'), 'utf8'),
  );
  if (
    marker.fixture !== 'filesystem-only' ||
    marker.identity !== expectedIdentity
  )
    throw new Error('Fixture identity mismatch');
  const entries = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = fixturePath(root, relative(root, join(directory, name)));
      const info = lstatSync(path);
      const key = relative(root, path).replaceAll('\\', '/');
      if (info.isDirectory()) {
        entries.push({ path: key, kind: 'directory' });
        visit(path);
      } else if (info.isFile()) {
        const bytes = readFileSync(path);
        entries.push({
          path: key,
          kind: 'file',
          bytes: bytes.length,
          sha256: digest(bytes),
        });
      } else throw new Error('Unexpected fixture member');
    }
  };
  visit(root);
  const state = {
    fixture: 'filesystem-only',
    identity: expectedIdentity,
    entries,
  };
  return { ...state, sha256: keyOf(state) };
}

export function protectedFixtureHashes(fixture) {
  return fixture.protectedFiles.map((path) => ({
    path: relative(
      fixture.work,
      fixturePath(fixture.work, relative(fixture.work, path)),
    ).replaceAll('\\', '/'),
    sha256: digest(readFileSync(path)),
  }));
}

/** Pure test data only; this never installs, launches, or creates any files. */
export function createInstallationLifecycleProof(proof) {
  const registration = {
    DisplayName: 'TableMax',
    DisplayVersion: proof.buildVersion,
    InstallLocation: proof.installRoot,
    UninstallString: '"' + resolve(proof.installRoot, 'unins000.exe') + '"',
  };
  const shortcuts = ['launch', 'uninstall', 'desktop'].map((name) => ({
    path: name + '.lnk',
    target: resolve(
      proof.installRoot,
      name === 'uninstall' ? 'unins000.exe' : 'TableMax.exe',
    ),
    workingDirectory: resolve(proof.installRoot),
    arguments: '',
  }));
  const native = {
    desktopPid: 1,
    servicePid: 2,
    appVersion: proof.buildVersion,
    dataDirectory: proof.boxRoot,
    exitCode: 0,
    publicState: {
      instanceId: 'saved-room',
      seatId: 'saved-seat',
      releaseRef: { gameId: 'rummikub' },
      status: 'lobby',
    },
  };
  const databases = ['foundation.sqlite', 'room.sqlite'].map((path) => ({
    path,
    bytes: 1,
    sha256: 'a'.repeat(64),
  }));
  const footprint = proof.footprint;
  const phases = [
    'after-install',
    'after-repeat-install',
    'before-first-uninstall',
    'after-first-uninstall',
    'after-restored-install',
    'before-final-uninstall',
    'after-final-uninstall',
  ];
  const samples = phases.map((phase) => {
    const removed =
      phase === 'after-first-uninstall' || phase === 'after-final-uninstall';
    const entries = {
      program: removed
        ? []
        : [{ path: 'TableMax.exe', bytes: footprint.programBytes }],
      framework: removed
        ? []
        : [{ path: 'unins000.exe', bytes: footprint.frameworkBytes }],
      metadata: [
        {
          path: 'TableMax/TableMax.config.json',
          bytes: footprint.identityBytes,
        },
      ],
      currentGames: [
        {
          path: 'TableMax/games/current.json',
          bytes: footprint.currentGamesBytes,
        },
      ],
      historicalGames: [],
      savedData: databases.map((file) => ({
        path: 'TableMax/' + file.path,
        bytes: file.bytes,
      })),
      browserCache: [],
      logs: [],
      updates: [],
      transactions: [],
      otherRetainedData: [],
      unknownUserFiles: [],
    };
    const categories = Object.fromEntries(
      Object.entries(entries).map(([name, files]) => [
        name,
        { files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) },
      ]),
    );
    const rootBytes = Object.values(categories).reduce(
      (sum, category) => sum + category.bytes,
      0,
    );
    return {
      phase,
      observedAtUtc: '2026-10-15T00:00:00.000Z',
      categories,
      rootBytes,
      installerTemporary: { path: 'T', bytes: 0, files: [] },
      executionCopyBytes: proof.executableBytes,
      totalObservedBytes: rootBytes + proof.executableBytes,
    };
  });
  return {
    registration,
    shortcuts,
    reinstall: { result: 'passed', registration, shortcuts },
    postUninstallReinstall: {
      result: 'passed',
      actualInstaller: true,
      sameRoot: true,
      sameInstaller: true,
      firstUninstalled: true,
      finalUninstalled: true,
      defaultUninstall: true,
      root: proof.installRoot,
      ownerSid: proof.ownerSid,
      installerSha256: proof.installerSha256,
      buildVersion: proof.buildVersion,
      originalInstallationId: proof.installationId,
      installationId: 'restored-install',
      initialNative: native,
      restoredNative: native,
      databases: {
        firstUninstall: { before: databases, after: databases },
        finalUninstall: { before: databases, after: databases },
      },
      registration,
      shortcuts,
      footprint,
    },
    capacityAccounting: {
      schemaVersion: 1,
      observation: 'installer-returned-after-health-startup',
      observedAtUtc: '2026-10-15T00:00:00.000Z',
      preStartupSampled: false,
      sameSample: true,
      firstInstallationProgramBytes:
        footprint.programBytes +
        footprint.frameworkBytes +
        footprint.identityBytes,
      firstStartupMaterializedGamesBytes: footprint.currentGamesBytes,
      firstStartupTotalBytes: footprint.total,
    },
    observedStorage: {
      schemaVersion: 1,
      isAbsolutePeak: false,
      samples,
      maxObservedBytes: Math.max(
        ...samples.map((sample) => sample.totalObservedBytes),
      ),
    },
  };
}
