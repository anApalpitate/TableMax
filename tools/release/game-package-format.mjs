import { createHash, createPrivateKey, sign } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { readFile, writeFile, mkdir, readdir, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
async function inventory(directory) {
  const records = [];
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name),
        stats = await lstat(file);
      if (stats.isSymbolicLink())
        throw new Error('Linked package source rejected');
      if (stats.isDirectory()) await visit(file);
      else if (stats.isFile())
        records.push({
          path: relative(directory, file).replaceAll('\\', '/'),
          bytes: stats.size,
        });
      else throw new Error('Non-regular package source rejected');
    }
  }
  await visit(directory);
  return records.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
/** Deterministic ZIP, UTF-8 names, regular files only, no metadata or directories. */
export function zipFiles(records) {
  const local = [],
    central = [];
  let offset = 0;
  for (const { path, data } of [...records].sort((a, b) =>
    a.path.localeCompare(b.path, 'en'),
  )) {
    if (
      !path ||
      path.includes('\\') ||
      path.split('/').some((part) => part === '..' || !part) ||
      path.startsWith('/') ||
      path.includes(':')
    )
      throw new Error('Unsafe ZIP member');
    const name = Buffer.from(path),
      compressed = deflateRawSync(data, { level: 9 }),
      crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x800, 8);
    index.writeUInt16LE(8, 10);
    index.writeUInt16LE(33, 14);
    index.writeUInt32LE(crc, 16);
    index.writeUInt32LE(compressed.length, 20);
    index.writeUInt32LE(data.length, 24);
    index.writeUInt16LE(name.length, 28);
    index.writeUInt32LE(offset, 42);
    central.push(index, name);
    offset += header.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(records.length, 8);
  end.writeUInt16LE(records.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}
export async function createBlob(kind, records, out, releaseTag) {
  const files = records
    .map(({ path, data }) => ({
      path,
      size: data.length,
      sha256: sha256(data),
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const id = sha256(canonical({ kind, files })),
    archive = zipFiles(records),
    assetName = `TableMax-${kind}-${id}.zip`;
  await writeFile(join(out, assetName), archive);
  return {
    id,
    kind,
    files,
    archiveBytes: archive.length,
    archiveSha256: sha256(archive),
    installedBytes: files.reduce((n, file) => n + file.size, 0),
    assetName,
    releaseTag,
  };
}
export async function packageCodeDirectory(
  module,
  directory,
  out,
  { releaseTag = 'v1.0.6' } = {},
) {
  await mkdir(out, { recursive: true });
  const files = await inventory(directory);
  return createBlob(
    'code',
    await Promise.all(
      files.map(async (file) => ({
        path: file.path,
        data: await readFile(join(directory, file.path)),
      })),
    ),
    out,
    releaseTag,
  );
}
export function createSignedCatalog(payload, key) {
  const privateKey = createPrivateKey(key);
  if (privateKey.asymmetricKeyType !== 'ed25519')
    throw new Error('Ed25519 signing key required');
  return {
    payload,
    signature: sign(null, Buffer.from(canonical(payload)), privateKey).toString(
      'base64',
    ),
  };
}
