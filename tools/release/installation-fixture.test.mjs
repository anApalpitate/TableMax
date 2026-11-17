import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { brotliCompressSync } from 'node:zlib';
import { frozenBoxMembers } from './installation-fixture.mjs';

const record = (path, bytes) => ({
  path,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
});
const source = Buffer.from('export const value = 42;\n'.repeat(100));
const box = [record('assets/box.js', source)];
const packed = brotliCompressSync(source);
const member = record('web/assets/box.js.br', packed);

test('packed box ownership preserves the unrelated packed runtime', async () => {
  const runtime = record('web/runtime/v1/runtime.js.br', packed);
  assert.deepEqual(
    await frozenBoxMembers(box, [member, runtime], async () => packed),
    [member],
  );
});

test('plain box payloads remain supported', async () => {
  const plain = record('web/assets/box.js', source);
  assert.deepEqual(await frozenBoxMembers(box, [plain]), [plain]);
});

test('packed content must restore the exact frozen box source', async () => {
  const changed = brotliCompressSync(Buffer.alloc(source.length, 65));
  await assert.rejects(
    frozenBoxMembers(box, [record(member.path, changed)], async () => changed),
  );
  await assert.rejects(frozenBoxMembers(box, [member], async () => changed));
});

test('missing, ambiguous and foreign ownership is rejected', async () => {
  await assert.rejects(frozenBoxMembers(box, []));
  await assert.rejects(
    frozenBoxMembers(box, [member, record('web/assets/box.js', source)]),
  );
  await assert.rejects(
    frozenBoxMembers([record('runtime/v1/runtime.js', source)], [member]),
  );
});
