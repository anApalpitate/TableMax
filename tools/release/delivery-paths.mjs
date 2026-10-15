import assert from 'node:assert/strict';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { windowsExecutableName } from './windows-executable-name.mjs';
import { isDirectExecution } from '../shared/workspace-root.mjs';

function identity(version, buildVersion, edition) {
  assert.match(version, /^1\.\d+\.\d+$/);
  assert.ok(
    buildVersion === version ||
      new RegExp('^' + version.replaceAll('.', '\\.') + '\\.\\d+$').test(
        buildVersion,
      ),
    'Build must belong to the public version',
  );
  return windowsExecutableName(buildVersion, edition);
}

/** Both layouts have exact identities; arbitrary descendants are never accepted. */
export function assertDeliveryPath({
  root = resolve('.'),
  version,
  buildVersion = version,
  edition = 'full',
  path,
}) {
  const name = identity(version, buildVersion, edition);
  const absolute = resolve(root, path);
  const legacy = resolve(root, 'artifacts/releases', name);
  const grouped = resolve(
    root,
    'artifacts/releases',
    'v' + version,
    buildVersion,
    name,
  );
  assert.ok(absolute === legacy || absolute === grouped, 'Unexpected EXE path');
  assertNoDeliveryLinks(absolute);
  return absolute;
}

export function assertNoDeliveryLinks(path) {
  const absolute = resolve(path);
  for (let cursor = absolute; ; cursor = dirname(cursor)) {
    // Windows filesystem virtualization can expose a junction as a normal
    // directory through lstat/readlink while its parent Dirent still retains
    // the reparse type. Check both views before accepting an output ancestor.
    if (dirname(cursor) !== cursor) {
      let entry;
      try {
        entry = readdirSync(dirname(cursor), { withFileTypes: true }).find(
          (item) => item.name.toLowerCase() === basename(cursor).toLowerCase(),
        );
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      assert.ok(!entry?.isSymbolicLink(), 'Delivery contains a link');
    }
    try {
      assert.ok(
        !lstatSync(cursor).isSymbolicLink(),
        'Delivery contains a link',
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Some Windows reparse targets surface ENOENT even for lstat. An
      // existing directory entry must never be treated as a missing output.
      let names;
      try {
        names = readdirSync(dirname(cursor));
      } catch (parentError) {
        if (parentError.code !== 'ENOENT') throw parentError;
      }
      assert.ok(
        !names?.some(
          (name) => name.toLowerCase() === basename(cursor).toLowerCase(),
        ),
        'Delivery contains an unreadable entry or link',
      );
    }
    if (dirname(cursor) === cursor) break;
  }
  return absolute;
}

/** New builds are grouped. Frozen rewraps explicitly pass their recorded path. */
export function deliveryPaths({
  root = resolve('.'),
  version,
  buildVersion = version,
  edition = 'full',
  existingPath,
  restoreSnapshot = false,
}) {
  const name = identity(version, buildVersion, edition);
  const legacy = resolve(root, 'artifacts/releases', name);
  const executable = assertDeliveryPath({
    root,
    version,
    buildVersion,
    edition,
    path:
      existingPath ??
      (restoreSnapshot && existsSync(legacy)
        ? legacy
        : join('artifacts/releases', 'v' + version, buildVersion, name)),
  });
  return {
    directory: dirname(executable),
    executable,
    manifest: executable.replace(/\.exe$/, '-manifest.json'),
  };
}

if (isDirectExecution(import.meta.url)) {
  const args = process.argv.slice(2);
  const keys = ['root', 'version', 'build-version', 'edition', 'path'];
  assert.ok(
    args.length === keys.length &&
      keys.every(
        (key) =>
          args.filter((arg) => arg.startsWith('--' + key + '=')).length === 1,
      ),
    'Expected explicit root/version/build-version/edition/path',
  );
  const value = (key) =>
    args.find((arg) => arg.startsWith('--' + key + '=')).slice(key.length + 3);
  console.log(
    JSON.stringify(
      assertDeliveryPath({
        root: value('root'),
        version: value('version'),
        buildVersion: value('build-version'),
        edition: value('edition'),
        path: value('path'),
      }),
    ),
  );
}
