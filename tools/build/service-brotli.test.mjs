import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { brotliCompressSync } from 'node:zlib';
import { packService } from './service-brotli.mjs';

const require = createRequire(import.meta.url);
const folder = await mkdtemp(resolve('tmp/service-brotli-test-'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = Buffer.from(`/* ${'test padding '.repeat(2000)} */
module.exports = { filename: __filename, dirname: __dirname, main: require.main === module, text: '精确原始字节', dependency: require('node:path').basename(__filename) };
if (require.main === module) console.log(JSON.stringify(module.exports));
`);

async function prepared(name) {
  const file = join(folder, name + '.cjs');
  await writeFile(file, source);
  const result = await packService(file);
  return { file, result };
}

test('exact original bytes, filename/dirname, exports and dependency resolution; no restored file', async () => {
  const { file, result } = await prepared('valid');
  assert.equal(result.sourceBytes, source.length);
  assert.equal(result.sourceSha256, hash(source));
  assert.ok(result.savingBytes > 0);
  const before = await readdir(folder);
  const loaded = require(file);
  assert.deepEqual(loaded, {
    filename: file,
    dirname: folder,
    main: false,
    text: '精确原始字节',
    dependency: 'valid.cjs',
  });
  const main = JSON.parse(
    execFileSync(process.execPath, [file], {
      encoding: 'utf8',
      windowsHide: true,
    }),
  );
  assert.equal(main.main, true);
  assert.equal(main.filename, file);
  assert.deepEqual(await readdir(folder), before);
});

test('missing payload fails closed before original code executes', async () => {
  const { file } = await prepared('missing');
  const loader = await readFile(file);
  const noPayload = join(folder, 'without-payload.cjs');
  await writeFile(noPayload, loader);
  assert.throws(() => require(noPayload), /ENOENT/);
});

test('corrupt payload fails its SHA256 before decompression or original code', async () => {
  const { file } = await prepared('corrupt');
  await writeFile(file + '.br', Buffer.from('corrupt'));
  assert.throws(() => require(file), /payload integrity/);
});

test('valid Brotli containing different original bytes fails the original SHA256', async () => {
  const { file } = await prepared('different-source');
  const different = Buffer.from(source);
  different[different.length - 2] = 32;
  const payload = brotliCompressSync(different);
  let loader = await readFile(file, 'utf8');
  const originalPayload = await readFile(file + '.br');
  loader = loader.replace(hash(originalPayload), hash(payload));
  await writeFile(file, loader);
  await writeFile(file + '.br', payload);
  assert.throws(() => require(file), /source integrity/);
});
