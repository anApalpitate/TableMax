import assert from 'node:assert/strict';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { installationInventory } from './installation-package.mjs';
import { hash } from './installation-toolchain.mjs';
import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from './package-limits.mjs';

export const databaseMembers = [
  'foundation.sqlite',
  'foundation.sqlite-wal',
  'foundation.sqlite-shm',
  'foundation.sqlite-journal',
  'room.sqlite',
  'room.sqlite-wal',
  'room.sqlite-shm',
  'room.sqlite-journal',
  'room.sqlite.migration.json',
  'room.sqlite.migration.lock',
];

export async function verifyPreservedRuntime({
  copy,
  delivery,
  payloadBytes,
  sourceRuntimeRoot,
  installationId,
}) {
  const payload = JSON.parse(payloadBytes.toString('utf8'));
  const members = [
    ...payload.files,
    {
      path: '.tablemax-release.json',
      bytes: payloadBytes.length,
      sha256: hash(payloadBytes),
    },
  ].sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(copy.sourceRuntimeRoot, sourceRuntimeRoot);
  assert.equal(copy.installationId, installationId);
  assert.equal(copy.executableSha256, delivery.executable.sha256);
  assert.equal(copy.payloadSha256, delivery.executable.payloadSha256);
  assert.equal(copy.payloadManifestSha256, hash(payloadBytes));
  assert.equal(copy.fileCount, members.length);
  assert.deepEqual(copy.files, members);
  assert.deepEqual(
    await installationInventory(copy.path),
    members,
    'Retained runtime must remain the exact frozen payload plus marker after uninstall',
  );
}

export async function noLinks(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    try {
      assert.ok(
        !(await lstat(cursor)).isSymbolicLink(),
        'Evidence contains a link',
      );
    } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
    }
    if (dirname(cursor) === cursor) break;
  }
}

export async function archiveInstallationLog({ source, directory, name }) {
  assert.match(
    name,
    /^(install|reinstall|uninstall|restore-install|restore-uninstall)\.log$/,
  );
  let entry;
  try {
    entry = await lstat(source);
  } catch (cause) {
    if (cause.code === 'ENOENT')
      return { sourcePath: resolve(source), missing: true };
    throw cause;
  }
  assert.ok(
    entry.isFile() && !entry.isSymbolicLink(),
    'Installer log is not a regular file',
  );
  await noLinks(source);
  await noLinks(directory);
  const bytes = await readFile(source);
  const path = join(directory, name);
  await writeFile(path, bytes, { flag: 'wx' });
  assert.equal(hash(await readFile(path)), hash(bytes));
  return {
    sourcePath: resolve(source),
    path,
    bytes: bytes.length,
    sha256: hash(bytes),
  };
}

export async function preserveVerifiedRuntime({
  root,
  delivery,
  evidencePath,
  installationId,
}) {
  const payloadBytes = await readFile(delivery.manifestPath),
    payload = JSON.parse(payloadBytes.toString('utf8'));
  const source = join(root, 'data/app');
  const destination = resolve(dirname(evidencePath), 'verified-runtime');
  assert.ok(destination.startsWith(resolve(dirname(evidencePath)) + sep));
  await mkdir(destination, { recursive: false });
  const records = [];
  for (const file of [
    ...payload.files,
    {
      path: '.tablemax-release.json',
      bytes: payloadBytes.length,
      sha256: hash(payloadBytes),
    },
  ]) {
    const input = join(source, file.path),
      output = join(destination, file.path);
    assert.equal((await stat(input)).size, file.bytes);
    assert.equal(hash(await readFile(input)), file.sha256);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(input, output);
    assert.equal(hash(await readFile(output)), file.sha256);
    records.push(file);
  }
  assert.deepEqual(
    await installationInventory(destination),
    records.sort((a, b) => a.path.localeCompare(b.path)),
  );
  return {
    path: destination,
    files: records,
    fileCount: records.length,
    executableSha256: delivery.executable.sha256,
    payloadSha256: payload.archive.sha256,
    payloadManifestSha256: hash(await readFile(delivery.manifestPath)),
    installationId,
    sourceRuntimeRoot: source,
    boundary:
      'Exact payload members and ownership marker copied from the real verified installation before uninstall; component input only, does not repeat installer/registry/updater acceptance.',
  };
}

export async function installedProgramFootprint(root, manifest) {
  const declared = [];
  for (const file of manifest.files) {
    const path = join(root, file.path);
    assert.equal((await stat(path)).size, file.bytes);
    assert.equal(hash(await readFile(path)), file.sha256, file.path);
    declared.push(file);
  }
  assert.deepEqual(
    await installationInventory(join(root, 'data/app')),
    manifest.files
      .filter((file) => file.path.startsWith('data/app/'))
      .map((file) => ({
        ...file,
        path: file.path.slice('data/app/'.length),
      })),
    'Fresh app must contain exactly the managed payload and marker',
  );
  const framework = [];
  for (const name of await readdir(root))
    if (/^unins\d+\.(exe|dat|msg)$/i.test(name)) {
      const path = join(root, name);
      framework.push({
        path: name,
        bytes: (await stat(path)).size,
        sha256: hash(await readFile(path)),
      });
    }
  assert.ok(
    framework.some((file) => file.path.endsWith('.exe')) &&
      framework.some((file) => file.path.endsWith('.dat')),
    'Framework uninstaller and registration log required',
  );
  const metadata = await Promise.all(
    [
      'data/.install.json',
      'data/.installer-receipt.json',
      'data/TableMax.config.json',
    ].map(async (path) => ({
      path,
      bytes: (await stat(join(root, path))).size,
      sha256: hash(await readFile(join(root, path))),
    })),
  );
  const identityBytes = metadata.reduce((sum, file) => sum + file.bytes, 0);
  const games = await installationInventory(join(root, 'data/games'));
  const programBytes = declared.reduce((sum, file) => sum + file.bytes, 0),
    frameworkBytes = framework.reduce((sum, file) => sum + file.bytes, 0),
    currentGamesBytes = games.reduce((sum, file) => sum + file.bytes, 0);
  const total =
    programBytes + frameworkBytes + identityBytes + currentGamesBytes;
  assert.ok(
    total < MAXIMUM_PACKAGE_BYTES,
    'First startup complete program must be strictly below 120,000,000 bytes',
  );
  return {
    programBytes,
    frameworkBytes,
    identityBytes,
    metadata,
    currentGamesBytes,
    total,
    engineeringBudgetBytes: PACKAGE_BUDGET_BYTES,
    engineeringWarning: total >= PACKAGE_BUDGET_BYTES,
    framework,
    games,
    measurement:
      'Fresh installation: exact managed app/entry/helper, framework uninstaller/log, identity/receipt/config, all current materialized games. User saves/browser caches/transaction copies are excluded from the program footprint; preservation is checked separately.',
  };
}

export async function sizeInventory(root) {
  await noLinks(root);
  const files = [];
  const walk = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), 'Storage measurement contains a link');
      const path = join(directory, entry.name),
        name = prefix + entry.name;
      if (entry.isDirectory()) await walk(path, name + '/');
      else {
        assert.ok(entry.isFile(), 'Unexpected storage measurement member');
        files.push({ path: name, bytes: (await stat(path)).size });
      }
    }
  };
  await walk(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function storageObservation({
  root,
  temporary,
  executablePath,
  manifest,
  currentGames,
  phase,
}) {
  const managed = new Set(manifest.files.map((file) => file.path));
  const games = new Set(currentGames.map((file) => 'data/games/' + file.path));
  const categories = Object.fromEntries(
    [
      'program',
      'framework',
      'metadata',
      'currentGames',
      'historicalGames',
      'savedData',
      'browserCache',
      'logs',
      'updates',
      'transactions',
      'otherRetainedData',
      'unknownUserFiles',
    ].map((name) => [name, { bytes: 0, files: [] }]),
  );
  const files = await sizeInventory(root);
  for (const file of files) {
    const path = file.path;
    const category = managed.has(path)
      ? 'program'
      : /^unins\d+\.(exe|dat|msg)$/i.test(path)
        ? 'framework'
        : /^data\/(\.install\.json|\.installer-receipt\.json|\.uninstalled\.json|TableMax\.config\.json)$/.test(
              path,
            )
          ? 'metadata'
          : games.has(path)
            ? 'currentGames'
            : path.startsWith('data/games/')
              ? 'historicalGames'
              : path.startsWith('data/.installation-transactions/')
                ? 'transactions'
                : path.startsWith('data/updates/')
                  ? 'updates'
                  : path.startsWith('data/desktop/')
                    ? 'browserCache'
                    : path.startsWith('data/logs/')
                      ? 'logs'
                      : databaseMembers.some((name) => path === 'data/' + name)
                        ? 'savedData'
                        : path.startsWith('data/')
                          ? 'otherRetainedData'
                          : 'unknownUserFiles';
    categories[category].files.push(file);
    categories[category].bytes += file.bytes;
  }
  const temporaryFiles = await sizeInventory(temporary);
  const rootBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const temporaryBytes = temporaryFiles.reduce(
    (sum, file) => sum + file.bytes,
    0,
  );
  const executionCopyBytes = (await stat(executablePath)).size;
  return {
    phase,
    observedAtUtc: new Date().toISOString(),
    rootBytes,
    categories,
    installerTemporary: {
      path: temporary,
      bytes: temporaryBytes,
      files: temporaryFiles,
    },
    executionCopyBytes,
    totalObservedBytes: rootBytes + temporaryBytes + executionCopyBytes,
  };
}

// Read the helper's immutable per-uninstall receipt before a later reinstall can
// replace the stable receipt. Every original game file must be accounted for.
export async function verifyResourceCleanup({
  root,
  identity,
  before,
  directory,
  name,
}) {
  assert.match(name, /^(first|final)-uninstall-resources\.json$/);
  const source = join(root, 'data/.uninstall-resources.json');
  await noLinks(source);
  const raw = await readFile(source);
  const receipt = JSON.parse(raw.toString('utf8'));
  assert.equal(receipt.schemaVersion, 1);
  for (const key of ['productId', 'installationId', 'ownerSid', 'buildVersion'])
    assert.equal(receipt[key], identity[key]);
  assert.equal(resolve(receipt.root), resolve(root));
  assert.equal(resolve(receipt.boxRoot), resolve(root, 'data'));
  assert.ok(['completed', 'retained'].includes(receipt.result));
  assert.ok(Array.isArray(receipt.deleted) && Array.isArray(receipt.retained));
  assert.equal(receipt.deferred?.length ?? 0, 0);
  const seen = new Map();
  for (const [action, entries] of [
    ['delete', receipt.deleted],
    ['retain', receipt.retained],
  ]) {
    for (const entry of entries) {
      assert.match(entry.path, /^games\/[^\\:]+$/);
      assert.ok(
        !entry.path
          .split('/')
          .some((part) => !part || part === '.' || part === '..'),
      );
      assert.ok(
        !seen.has(entry.path),
        'Resource receipt contains duplicate decisions',
      );
      assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
      assert.match(entry.sha256, /^[a-f0-9]{64}$/);
      assert.ok(
        typeof entry.reason === 'string' &&
          /[\u3400-\u9fff]/.test(entry.reason),
      );
      seen.set(entry.path, entry);
      const path = join(root, 'data', entry.path);
      if (action === 'delete')
        await assert.rejects(lstat(path), { code: 'ENOENT' });
      else {
        await noLinks(path);
        const bytes = await readFile(path);
        assert.equal(bytes.length, entry.bytes);
        assert.equal(hash(bytes), entry.sha256);
      }
    }
  }
  for (const file of before) {
    const entry = seen.get('games/' + file.path);
    assert.ok(
      entry,
      'Current resource missing from uninstall receipt: ' + file.path,
    );
    assert.equal(entry.bytes, file.bytes);
    assert.equal(entry.sha256, file.sha256);
  }
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  await writeFile(path, raw, { flag: 'wx' });
  return {
    path: resolve(path),
    bytes: raw.length,
    sha256: hash(raw),
    raw: raw.toString('utf8'),
    receipt,
  };
}
