import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Keep the CommonJS entry path; restore its exact build bytes only in memory. */
export async function packService(file) {
  const source = await readFile(file);
  const payload = brotliCompressSync(source, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  });
  if (!brotliDecompressSync(payload).equals(source))
    throw new Error('Service compression roundtrip failed');
  const sourceSha256 = hash(source);
  const payloadSha256 = hash(payload);
  const loader = Buffer.from(`'use strict';
(() => {
  const fs = require('node:fs');
  const crypto = require('node:crypto');
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const payload = fs.readFileSync(__filename + '.br');
  if (digest(payload) !== '${payloadSha256}') throw new Error('Service payload integrity failed');
  const source = require('node:zlib').brotliDecompressSync(payload, { maxOutputLength: ${source.length} });
  if (source.length !== ${source.length} || digest(source) !== '${sourceSha256}') throw new Error('Service source integrity failed');
  module._compile(source.toString('utf8'), __filename);
})();
`);
  const savingBytes = source.length - payload.length - loader.length;
  if (savingBytes <= 0)
    throw new Error('Service compression does not save bytes');
  await writeFile(file + '.br', payload);
  await writeFile(file, loader);
  return {
    sourceBytes: source.length,
    sourceSha256,
    payloadBytes: payload.length,
    payloadSha256,
    loaderBytes: loader.length,
    savingBytes,
  };
}
