import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  parseUstar,
  hashFile,
  verifyPreservedTar,
  SYSTEM_TAR,
} from './verify-preserved-tar.mjs';

function header(name, bytes, type = '0') {
  const block = Buffer.alloc(512);
  block.write(name);
  for (const [offset, width, value] of [
    [100, 8, 420],
    [108, 8, 0],
    [116, 8, 0],
    [124, 12, bytes],
    [136, 12, 0],
    [329, 8, 0],
    [337, 8, 0],
  ])
    block.write(value.toString(8).padStart(width - 1, '0') + '\0', offset);
  block.fill(32, 148, 156);
  block.write(type, 156);
  if (type === '2') block.write('tmp/link-target', 157);
  Buffer.from([117, 115, 116, 97, 114, 0, 48, 48]).copy(block, 257);
  const checksum = block.reduce((sum, value) => sum + value, 0);
  block.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
  return block;
}
function tar(members) {
  return Buffer.concat([
    ...members.flatMap(({ name, body = Buffer.from('payload'), type }) => [
      header(name, body.length, type),
      body,
      Buffer.alloc((512 - (body.length % 512)) % 512),
    ]),
    Buffer.alloc(1024),
  ]);
}
const parse = (data) =>
  parseUstar(
    Readable.from([
      data.subarray(0, 123),
      data.subarray(123, 1047),
      data.subarray(1047),
    ]),
  );
test('streamed members preserve full bytes and zero-byte members', async () => {
  const result = await parse(
    tar([
      { name: 'tmp/历史/a.txt' },
      { name: 'tmp/empty', body: Buffer.alloc(0) },
    ]),
  );
  assert.equal(result['tmp/历史/a.txt'].bytes, 7);
  assert.equal(
    result['tmp/历史/a.txt'].sha256,
    '239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5',
  );
  assert.equal(result['tmp/empty'].bytes, 0);
});
test('unsafe, duplicate and nonregular members are rejected', async () => {
  for (const name of [
    '/absolute',
    '../escape',
    'tmp/../escape',
    'C:/escape',
    'tmp\\escape',
    'tmp/.git/config',
    './tmp/a',
    'tmp/a.',
    'tmp/a ',
    'tmp/CON.txt',
    'tmp/LPT1',
    'tmp/a?b',
  ])
    await assert.rejects(parse(tar([{ name }])));
  await assert.rejects(
    parse(tar([{ name: 'tmp/a' }, { name: 'tmp/a' }])),
    /Duplicate/,
  );
  await assert.rejects(
    parse(tar([{ name: 'tmp/a' }, { name: 'tmp/A' }])),
    /Duplicate/,
  );
  for (const type of ['1', '2', '5', 'x', 'g'])
    await assert.rejects(parse(tar([{ name: 'tmp/a', type }])), /regular/);
});
test('corrupt checksums, padding, lengths and termination are rejected', async () => {
  const valid = tar([{ name: 'tmp/a' }]);
  const checksum = Buffer.from(valid);
  checksum[0] ^= 1;
  await assert.rejects(parse(checksum), /checksum/);
  const padding = Buffer.from(valid);
  padding[520] = 1;
  await assert.rejects(parse(padding), /padding/);
  await assert.rejects(parse(valid.subarray(0, 1023)), /Truncated/);
  await assert.rejects(
    parse(valid.subarray(0, valid.length - 513)),
    /Truncated/,
  );
  await assert.rejects(
    parse(Buffer.concat([valid, header('tmp/after', 0)])),
    /termination/,
  );
});
test(
  'fixed system tar decodes xz without extracting and rejects changed bindings or decoder failure',
  { skip: process.platform !== 'win32' },
  async () => {
    const root = await mkdtemp(path.resolve('tmp/preserved-tar-test-'));
    const source = path.join(root, 'input.tar');
    const archivePath = path.join(root, 'preserved.tar.xz');
    await writeFile(source, tar([{ name: 'tmp/原路径/a.txt' }]));
    const made = spawnSync(
      SYSTEM_TAR,
      ['-cPJf', archivePath, '--format=ustar', '@' + source],
      { windowsHide: true },
    );
    assert.equal(made.status, 0, made.stderr?.toString());
    const args = {
      format: 'ustar-xz-v1',
      archivePath,
      archiveSha256: await hashFile(archivePath),
      tarSha256: await hashFile(SYSTEM_TAR),
    };
    const verified = await verifyPreservedTar(args);
    assert.equal(verified.members['tmp/原路径/a.txt'].bytes, 7);
    assert.equal(Object.keys(verified.members).length, 1);
    await assert.rejects(
      verifyPreservedTar({ ...args, format: 'unknown' }),
      /Unknown/,
    );
    await assert.rejects(
      verifyPreservedTar({ ...args, archiveSha256: '0'.repeat(64) }),
      /archive changed/,
    );
    await assert.rejects(
      verifyPreservedTar({ ...args, tarSha256: '0'.repeat(64) }),
      /method changed/,
    );
    const original = await readFile(archivePath);
    await writeFile(archivePath, original.subarray(0, original.length - 20));
    await assert.rejects(
      verifyPreservedTar({
        ...args,
        archiveSha256: await hashFile(archivePath),
      }),
    );
    await writeFile(archivePath, Buffer.from('not an archive'));
    await assert.rejects(
      verifyPreservedTar({
        ...args,
        archiveSha256: await hashFile(archivePath),
      }),
    );
    assert.equal((await readFile(source)).length, 2048);
    for (const members of [
      [{ name: '../escape' }],
      [{ name: '/absolute' }],
      [{ name: 'tmp/a' }, { name: 'tmp/a' }],
      [{ name: 'tmp/a', type: '2', body: Buffer.alloc(0) }],
    ]) {
      await writeFile(source, tar(members));
      const packed = spawnSync(
        SYSTEM_TAR,
        ['-cPJf', archivePath, '--format=ustar', '@' + source],
        { windowsHide: true },
      );
      assert.equal(packed.status, 0, packed.stderr?.toString());
      await assert.rejects(
        verifyPreservedTar({
          ...args,
          archiveSha256: await hashFile(archivePath),
        }),
      );
    }
  },
);
