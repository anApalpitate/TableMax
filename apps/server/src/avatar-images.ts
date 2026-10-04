import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { inflateSync } from 'node:zlib';
import { Rejection } from '@tablemax/platform-core';
import type { AvatarId } from '@tablemax/protocol';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const AVATAR_HTTP_LIMIT = 1024 * 1024;
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = crcTable[(crc ^ value) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Bounded, real decode and fresh encoding: no uploaded metadata is retained. */
export function normalizeAvatar(input: string | Uint8Array): {
  id: AvatarId;
  png: Buffer;
} {
  try {
    if (
      typeof input === 'string' &&
      (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) ||
        input.length > 700_000 ||
        input.length % 4 !== 0)
    )
      throw new Error();
    const bytes =
      typeof input === 'string'
        ? Buffer.from(input, 'base64')
        : Buffer.from(input);
    if (
      bytes.length > 512 * 1024 ||
      bytes.length < 57 ||
      !bytes.subarray(0, 8).equals(signature)
    )
      throw new Error();
    let offset = 8,
      headers = 0,
      ended = false,
      channels = 0;
    const compressed: Buffer[] = [];
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length || ended) throw new Error();
      const length = bytes.readUInt32BE(offset);
      if (length > bytes.length - offset - 12) throw new Error();
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (
        !/^[A-Za-z]{4}$/.test(type) ||
        crc32(bytes.subarray(offset + 4, offset + 8 + length)) !==
          bytes.readUInt32BE(offset + 8 + length)
      )
        throw new Error();
      if (type === 'IHDR') {
        if (
          offset !== 8 ||
          ++headers !== 1 ||
          length !== 13 ||
          bytes.readUInt32BE(offset + 8) !== 256 ||
          bytes.readUInt32BE(offset + 12) !== 256 ||
          bytes[offset + 16] !== 8 ||
          ![2, 6].includes(bytes[offset + 17]!) ||
          bytes[offset + 18] !== 0 ||
          bytes[offset + 19] !== 0 ||
          bytes[offset + 20] !== 0
        )
          throw new Error();
        channels = bytes[offset + 17] === 6 ? 4 : 3;
      } else if (type === 'IDAT')
        compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
      else if (type === 'IEND') {
        if (length !== 0) throw new Error();
        ended = true;
      } else if (type[0] === type[0]!.toUpperCase() && type !== 'PLTE')
        throw new Error();
      offset += length + 12;
    }
    if (headers !== 1 || !ended || compressed.length === 0) throw new Error();
    const expected = (256 * channels + 1) * 256;
    if (
      inflateSync(Buffer.concat(compressed), { maxOutputLength: expected })
        .length !== expected
    )
      throw new Error();
    const decoded = PNG.sync.read(bytes, { checkCRC: true });
    if (
      decoded.width !== 256 ||
      decoded.height !== 256 ||
      decoded.data.length !== 256 * 256 * 4
    )
      throw new Error();
    const png = PNG.sync.write(decoded);
    return {
      id: `custom-${createHash('sha256').update(png).digest('hex')}`,
      png,
    };
  } catch {
    throw new Rejection('invalid-avatar-image');
  }
}
