// Embedded as one bundled ESM resource. This module never deletes, migrates or
// opens an original save database; the helper supplies private byte copies.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  openSync,
  closeSync,
  readSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { decodeSave } from '../../server/src/save-codec.mjs';
import {
  safePath,
  validateCatalog,
  verifyCatalog,
} from '../../server/src/game-packages/verification';
import { PROJECT_GAME_PUBLIC_KEY } from '../../server/src/game-packages/project-public-key';

const hex = /^[a-f0-9]{64}$/;
const id = /^[a-z][a-z0-9-]*$/;
function check(condition) {
  if (!condition) throw new Error('unreliable-uninstall-analysis');
}
function noLinks(path) {
  for (let at = resolve(path); ; at = dirname(at)) {
    if (existsSync(at)) check(!lstatSync(at).isSymbolicLink());
    const parent = dirname(at);
    if (parent === at) break;
    // Windows may virtualize lstat of a junction as a directory. Its parent
    // directory entry must independently agree before following it.
    if (existsSync(parent)) {
      const entry = readdirSync(parent, { withFileTypes: true }).find(
        (entry) => entry.name.toLowerCase() === relative(parent, at).toLowerCase(),
      );
      if (entry) check(!entry.isSymbolicLink());
    }
  }
}
function hashFile(path) {
  noLinks(path);
  check(lstatSync(path).isFile());
  const descriptor = openSync(path, 'r');
  try {
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytes = 0;
    for (;;) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (!count) break;
      bytes += count;
      hash.update(buffer.subarray(0, count));
    }
    return { bytes, sha256: hash.digest('hex') };
  } finally {
    closeSync(descriptor);
  }
}
function readBound(record) {
  check(record && typeof record.path === 'string' && hex.test(record.sha256));
  const actual = hashFile(record.path);
  check(actual.bytes === record.bytes && actual.sha256 === record.sha256);
  check(actual.bytes <= 8 * 1024 * 1024);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(record.path)));
}
function inventory(box, index) {
  const root = join(box, 'games');
  if (!existsSync(root)) return [];
  noLinks(root);
  check(lstatSync(root).isDirectory());
  const files = [];
  function visit(directory) {
    noLinks(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      check(files.length < 20000);
      const path = join(directory, entry.name);
      const name = relative(box, path).split(sep).join('/');
      check(safePath(name));
      const info = lstatSync(path);
      if (entry.isSymbolicLink() || info.isSymbolicLink()) {
        files.push({ path: name, kind: 'link', bytes: null, sha256: null });
      } else if (entry.isDirectory() && info.isDirectory()) {
        visit(path);
      } else if (entry.isFile() && info.isFile()) {
        // The helper holds the original index exclusively. Its verified copy
        // supplies that one inventory tuple while the original stays leased.
        const input = index && resolve(index.sourcePath).toLowerCase() === resolve(path).toLowerCase()
          ? index.path
          : path;
        files.push({ path: name, kind: 'file', ...hashFile(input) });
      } else {
        files.push({ path: name, kind: 'unknown', bytes: null, sha256: null });
      }
    }
  }
  visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
function savedReferences(databaseRecord, refs) {
  const copy = resolve(databaseRecord.path);
  noLinks(copy);
  const before = hashFile(copy);
  check(before.bytes === databaseRecord.bytes && before.sha256 === databaseRecord.sha256);
  const database = new DatabaseSync(copy, { readOnly: true });
  try {
    check([1, 2].includes(Number(database.prepare('PRAGMA user_version').get()?.user_version)));
    check(database.prepare('PRAGMA quick_check').get()?.quick_check === 'ok');
    let count = 0;
    for (const query of ['SELECT data FROM saves', 'SELECT data FROM journal']) {
      // Keep StatementSync alive while iterating Node 22.14 rows.
      const statement = database.prepare(query);
      for (const row of statement.iterate()) {
        check(++count <= 100000);
        const save = decodeSave(database, row.data);
        check(save && save.formatVersion === 1 && Array.isArray(save.history));
        // Checkpoints share the enclosing Save's immutable release. Decoding
        // every current/journal Save verifies its complete checkpoint chain.
        if (save.releaseRef !== undefined) {
          check(typeof save.releaseRef === 'string' && hex.test(save.releaseRef));
          refs.add(save.releaseRef);
        } else check(save.manifest === null && save.history.length === 0);
      }
    }
  } finally {
    database.close();
  }
}

export function planUninstallResources(input) {
  const result = {
    schemaVersion: 1,
    productId: input?.productId,
    installationId: input?.installationId,
    root: input?.root,
    boxRoot: input?.boxRoot,
    dataDirectory: input?.dataDirectory,
    databaseFingerprint: input?.databaseFingerprint,
    status: 'retained',
    reasons: [],
    referencedReleaseIds: [],
    retainedBlobIds: [],
    files: [],
  };
  try {
    check(input?.schemaVersion === 1 && hex.test(input.databaseFingerprint));
    check(resolve(input.boxRoot) === join(resolve(input.root), 'data'));
    result.files = inventory(input.boxRoot, input.index).map((file) => ({
      ...file,
      action: 'retain',
      reason: '未知或历史内容，默认保留。',
    }));
    check(input.recoveryUncertain === false);
    const catalog = verifyCatalog(readBound(input.catalog), PROJECT_GAME_PUBLIC_KEY);
    const mapping = readBound(input.mapping);
    check(mapping.schemaVersion === 1 && Array.isArray(mapping.releaseIds) && mapping.releaseIds.length > 0);
    check(new Set(mapping.releaseIds).size === mapping.releaseIds.length && mapping.releaseIds.every((ref) => hex.test(ref)));
    const active = mapping.releaseIds.map((ref) => catalog.releases.find((release) => release.releaseId === ref));
    check(active.every(Boolean));
    const index = input.index === null
      ? { schemaVersion: 1, releases: {}, blobs: {}, selected: {} }
      : readBound(input.index);
    check(index.schemaVersion === 1 && index.releases && index.blobs && index.selected);
    validateCatalog({ schemaVersion: 1, releases: Object.values(index.releases), blobs: Object.values(index.blobs) });
    for (const [key, release] of Object.entries(index.releases)) check(key === release.releaseId);
    for (const [key, blob] of Object.entries(index.blobs)) check(key === blob.id);
    const refs = new Set();
    check(Array.isArray(input.databases));
    for (const database of input.databases) savedReferences(database, refs);
    result.referencedReleaseIds = [...refs].sort();
    for (const ref of refs) check(index.releases[ref]);
    const current = new Set(mapping.releaseIds);
    const protectedBlobs = new Set();
    for (const release of Object.values(index.releases)) {
      // History and legacy material never receives deletion authority merely
      // because an editable local index lists it as installed.
      if (refs.has(release.releaseId) || !current.has(release.releaseId) || release.legacy)
        for (const blob of [release.code, ...release.resources]) protectedBlobs.add(blob);
    }
    result.retainedBlobIds = [...protectedBlobs].sort();
    const records = new Map(result.files.map((file) => [file.path, file]));
    const eligible = new Map();
    const blobs = new Map(catalog.blobs.map((blob) => [blob.id, blob]));
    for (const release of active) {
      check(id.test(release.gameId));
      for (const blobId of [release.code, ...release.resources]) {
        const blob = blobs.get(blobId);
        check(blob);
        if (protectedBlobs.has(blobId)) continue;
        const prefix = `games/${release.gameId}/blobs/${blobId}/`;
        const members = result.files.filter((file) => file.path.startsWith(prefix));
        // One unknown, extra or changed member preserves the entire blob.
        if (members.length !== blob.files.length || blob.files.some((file) => {
          const actual = records.get(prefix + file.path);
          return !actual || actual.kind !== 'file' || actual.bytes !== file.size || actual.sha256 !== file.sha256;
        })) continue;
        for (const file of members) eligible.set(file.path, file);
      }
    }
    for (const file of eligible.values()) {
      file.action = 'delete';
      file.reason = '已核验当前资源，无存档或保留发行的共享引用，可由完整安装器重建。';
    }
    // Recheck immutable analysis sources after all reads. Original database
    // streams and metadata are held by the helper until deletion completes.
    readBound(input.catalog);
    readBound(input.mapping);
    if (input.index !== null) readBound(input.index);
    result.status = 'complete';
    result.reasons.push('仅计划删除已签当前资源的精确成员；存档、外置数据、历史与未知资料均保留。');
  } catch {
    result.status = 'retained';
    result.reasons = ['无法可靠确认全部存档、检查点或发行依赖，已保留游戏资源；程序仍可按保留数据方式卸载。'];
    for (const file of result.files) {
      file.action = 'retain';
      file.reason = result.reasons[0];
    }
  }
  return result;
}

if (globalThis.TABLEMAX_UNINSTALL_ANALYSIS_INPUT !== undefined) {
  process.stdout.write(JSON.stringify(planUninstallResources(globalThis.TABLEMAX_UNINSTALL_ANALYSIS_INPUT)) + '\n');
}
