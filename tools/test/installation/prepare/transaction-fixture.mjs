import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { parseStrictJson } from '../../../shared/application-update.mjs';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixtureProduct = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
async function isLink(path) {
  const absolute = resolve(path),
    parent = dirname(absolute);
  let entry;
  if (parent !== absolute) {
    try {
      entry = (await readdir(parent, { withFileTypes: true })).find(
        (item) => item.name.toLowerCase() === basename(absolute).toLowerCase(),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  // Windows may expose a junction as an ordinary lstat directory while its
  // parent entry retains the reparse type. Either positive view is a link.
  if (entry?.isSymbolicLink()) return true;
  try {
    return (await lstat(absolute)).isSymbolicLink();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    assert.ok(!entry, 'Unreadable path entry or link: ' + absolute);
    return false;
  }
}
async function noLinks(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    assert.ok(!(await isLink(cursor)), 'Linked path: ' + cursor);
    if (cursor === dirname(cursor)) break;
  }
}
function within(parent, path) {
  const name = relative(resolve(parent), resolve(path));
  assert.ok(
    name && !isAbsolute(name) && !name.startsWith('..' + sep) && name !== '..',
  );
  return resolve(path);
}
function member(parent, path) {
  assert.ok(
    typeof path === 'string' &&
      !path.includes('\\') &&
      !path.includes(':') &&
      !path.startsWith('/') &&
      path.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Unsafe fixture member',
  );
  return within(parent, join(parent, ...path.split('/')));
}
async function fileRecord(path) {
  await noLinks(path);
  const data = await readFile(path);
  return { bytes: data.length, sha256: digest(data) };
}
async function json(path, canonicalIntegers = false) {
  return parseStrictJson(await readFile(path), 1024 * 1024, {
    canonicalIntegers,
  });
}
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

export { exists, isLink, noLinks, within, member, fileRecord, json, writeJson };

/** Authenticate existing isolated fixture bytes without executing a helper or mutating inputs. */
export async function prepareTransactionFixture({
  repository,
  candidate,
  manifestPath,
  helper,
  installerSource,
  evidence,
}) {
  candidate = within(repository, candidate);
  manifestPath = within(candidate, manifestPath);
  helper = within(repository, helper);
  installerSource = within(repository, installerSource);
  evidence = within(resolve('artifacts/maintenance'), evidence);
  for (const path of [
    candidate,
    manifestPath,
    helper,
    installerSource,
    evidence,
  ])
    await noLinks(path);
  assert.ok(!(await exists(evidence)), 'Use a new evidence directory');
  const manifest = await json(manifestPath, true);
  assert.equal(
    manifest.productId,
    fixtureProduct,
    'Production products are prohibited',
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.installProtocol, 1);
  assert.equal(manifest.arch, 'x64');
  assert.ok(Array.isArray(manifest.files) && manifest.files.length);
  const sourceRecords = [];
  const names = new Set();
  for (const file of manifest.files) {
    assert.ok(!names.has(file.path.toLowerCase()), 'Duplicate managed member');
    names.add(file.path.toLowerCase());
    assert.ok(
      file.path === 'TableMax.exe' ||
        file.path === 'UpdateHelper.exe' ||
        file.path === 'Updater.exe' ||
        file.path.startsWith('data/app/'),
    );
    const record = await fileRecord(member(candidate, file.path));
    assert.deepEqual(
      record,
      { bytes: file.bytes, sha256: file.sha256 },
      file.path,
    );
    sourceRecords.push({ path: file.path, ...record });
  }
  assert.ok(
    names.has('updater.exe'),
    'The complete installed candidate requires Updater.exe',
  );
  const helperRecord = await fileRecord(helper);
  assert.deepEqual(
    helperRecord,
    sourceRecords.find((file) => file.path === 'UpdateHelper.exe') && {
      bytes: manifest.files.find((file) => file.path === 'UpdateHelper.exe')
        .bytes,
      sha256: manifest.files.find((file) => file.path === 'UpdateHelper.exe')
        .sha256,
    },
  );
  assert.equal(
    (await fileRecord(member(candidate, 'data/app/.tablemax-release.json')))
      .sha256,
    manifest.payloadManifestSha256,
  );
  assert.equal(
    (
      await fileRecord(
        member(candidate, 'data/app/preinstalled-games/bootstrap.json'),
      )
    ).sha256,
    manifest.currentMappingSha256,
  );
  const manifestRecord = await fileRecord(manifestPath);
  const installerRecord = await fileRecord(installerSource);
  assert.ok(installerRecord.bytes > 0 && installerRecord.bytes < 120000000);
  return {
    candidate,
    manifestPath,
    helper,
    installerSource,
    evidence,
    manifest,
    sourceRecords,
    helperRecord,
    manifestRecord,
    installerRecord,
  };
}
