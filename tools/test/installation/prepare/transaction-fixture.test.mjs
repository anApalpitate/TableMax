import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  stat,
  rmdir,
  symlink,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import {
  isLink,
  noLinks,
  prepareTransactionFixture,
} from './transaction-fixture.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/transaction-prepare-unit-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  const candidate = join(work, 'candidate');
  const manifestPath = join(candidate, 'installation-manifest.json');
  const definitions = {
    'TableMax.exe': 'Synthetic launcher bytes; never executed.',
    'UpdateHelper.exe': 'Synthetic helper bytes; never executed.',
    'Updater.exe': 'Synthetic updater bytes; never executed.',
    'data/app/.tablemax-release.json': '{"synthetic":"release"}\n',
    'data/app/preinstalled-games/bootstrap.json': '{"synthetic":"mapping"}\n',
    'data/app/web/index.js': 'Synthetic owned web bytes.\n',
  };
  const files = [];
  for (const [path, text] of Object.entries(definitions)) {
    const value = Buffer.from(text);
    await mkdir(dirname(join(candidate, path)), { recursive: true });
    await writeFile(join(candidate, path), value);
    files.push({ path, bytes: value.length, sha256: digest(value) });
  }
  const manifest = {
    schemaVersion: 1,
    productId: '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
    installProtocol: 1,
    arch: 'x64',
    releaseVersion: '1.0.6',
    buildVersion: '1.0.6.60000',
    payloadManifestSha256: files.find((f) =>
      f.path.endsWith('.tablemax-release.json'),
    ).sha256,
    currentMappingSha256: files.find((f) => f.path.endsWith('bootstrap.json'))
      .sha256,
    files,
  };
  const installerSource = join(work, 'fixture-installer.exe');
  await writeFile(installerSource, 'Synthetic outer bytes; never executed.');
  const saveManifest = () => writeFile(manifestPath, JSON.stringify(manifest));
  await saveManifest();
  return {
    candidate,
    manifest,
    manifestPath,
    saveManifest,
    input: {
      repository: resolve('.'),
      candidate,
      manifestPath,
      helper: join(candidate, 'UpdateHelper.exe'),
      installerSource,
      evidence: resolve(
        'artifacts/maintenance/transaction-prepare-unit-' + randomUUID(),
      ),
    },
  };
}

test('preparation authenticates fixture inputs without creating execution evidence or changing original bytes', async (t) => {
  const f = await fixture(t);
  const before = await readFile(f.manifestPath);
  const prepared = await prepareTransactionFixture(f.input);
  assert.equal(prepared.sourceRecords.length, f.manifest.files.length);
  assert.equal(prepared.helperRecord.sha256, f.manifest.files[1].sha256);
  assert.deepEqual(await readFile(f.manifestPath), before);
  await assert.rejects(stat(f.input.evidence), { code: 'ENOENT' });
});

test('preparation rejects a changed candidate member and an independently mismatched helper', async (t) => {
  const f = await fixture(t);
  const member = join(f.candidate, 'data/app/web/index.js');
  const original = await readFile(member);
  await writeFile(member, 'Changed owned bytes.');
  await assert.rejects(
    prepareTransactionFixture(f.input),
    assert.AssertionError,
  );
  await writeFile(member, original);
  const wrong = join(f.candidate, 'other-helper.exe');
  await writeFile(wrong, 'Different helper.');
  await assert.rejects(
    prepareTransactionFixture({ ...f.input, helper: wrong }),
    assert.AssertionError,
  );
});

test('preparation rejects production identity and noncanonical numeric descriptor input', async (t) => {
  const f = await fixture(t);
  f.manifest.productId = '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}';
  await f.saveManifest();
  await assert.rejects(
    prepareTransactionFixture(f.input),
    /Production products are prohibited/,
  );
  f.manifest.productId = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
  await f.saveManifest();
  await writeFile(
    f.manifestPath,
    (await readFile(f.manifestPath, 'utf8')).replace(
      '"installProtocol":1',
      '"installProtocol":1e0',
    ),
  );
  await assert.rejects(prepareTransactionFixture(f.input));
});

test('preparation rejects an escaping managed member before reading its outside target', async (t) => {
  const f = await fixture(t);
  const protectedFile = join(f.candidate, 'outside.txt');
  await writeFile(protectedFile, 'Do not read as an owned manifest member.');
  const before = await readFile(protectedFile);
  f.manifest.files.push({
    path: 'data/app/../../outside.txt',
    bytes: before.length,
    sha256: digest(before),
  });
  await f.saveManifest();
  await assert.rejects(
    prepareTransactionFixture(f.input),
    /Unsafe fixture member/,
  );
  assert.deepEqual(await readFile(protectedFile), before);
});

test(
  'preparation rejects a real junction and missing descendants through either Windows link view',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    const link = join(dirname(f.candidate), 'linked-candidate');
    const before = await readFile(f.manifestPath);
    await symlink(f.candidate, link, 'junction');
    let primary;
    try {
      assert.equal(await isLink(link), true);
      assert.equal(await isLink(f.candidate), false);
      await assert.rejects(
        noLinks(join(link, 'missing', 'member.json')),
        /Linked path/,
      );
      await assert.rejects(
        prepareTransactionFixture({
          ...f.input,
          candidate: link,
          manifestPath: join(link, 'installation-manifest.json'),
          helper: join(link, 'UpdateHelper.exe'),
        }),
        /Linked path/,
      );
      assert.deepEqual(await readFile(f.manifestPath), before);
    } catch (error) {
      primary = error;
    }
    try {
      assert.equal(await isLink(link), true);
      await rmdir(link);
    } catch (error) {
      throw primary
        ? new AggregateError(
            [primary, error],
            'Preparation assertion and exact junction cleanup both failed',
          )
        : error;
    }
    if (primary) throw primary;
    assert.deepEqual(await readFile(f.manifestPath), before);
  },
);
