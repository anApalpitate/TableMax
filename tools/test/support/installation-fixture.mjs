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
