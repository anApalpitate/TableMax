import { createHash, createPublicKey, verify, type KeyLike } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import type {
  GameRelease,
  PackageBlob,
  PackageCatalog,
  SignedCatalog,
} from './types';

export const GAME_SIZE_LIMIT = 64_000_000;
export function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function blobIdentity(
  blob: Pick<PackageBlob, 'kind' | 'files'>,
): string {
  return sha256(
    canonical({
      kind: blob.kind,
      files: [...blob.files].sort((a, b) => a.path.localeCompare(b.path, 'en')),
    }),
  );
}
export function releaseIdentity(release: GameRelease): string {
  const { releaseId: _id, ...identity } = release;
  void _id;
  return sha256(canonical(identity));
}
export function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length < 512 &&
    !path.includes('\\') &&
    !path.includes(':') &&
    !path.includes('\0') &&
    path
      .split('/')
      .every(
        (part) =>
          part.length > 0 &&
          part !== '.' &&
          part !== '..' &&
          !/[. ]$/.test(part) &&
          !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part),
      )
  );
}
export function verifyCatalog(
  envelope: SignedCatalog,
  publicKey: KeyLike,
): PackageCatalog {
  const key =
    typeof publicKey === 'string' || Buffer.isBuffer(publicKey)
      ? createPublicKey(publicKey)
      : publicKey;
  if (
    key.asymmetricKeyType !== 'ed25519' ||
    !verify(
      null,
      Buffer.from(canonical(envelope.payload)),
      key,
      Buffer.from(envelope.signature, 'base64'),
    )
  )
    throw new Error('invalid-catalog-signature');
  validateCatalog(envelope.payload);
  if (envelope.payload.releases.some((release) => release.legacy))
    throw new Error('remote-legacy-release-rejected');
  return envelope.payload;
}
export function validateCatalog(catalog: PackageCatalog): void {
  validateCatalogContents(catalog);
}
/** Installed local runtimes are not archives transferred or installed as packages. */
export function validateInstalledCatalog(
  catalog: PackageCatalog,
  verifyLocalRuntime: (release: GameRelease, code: PackageBlob) => boolean,
): void {
  validateCatalogContents(catalog, verifyLocalRuntime);
}
function validateCatalogContents(
  catalog: PackageCatalog,
  verifyLocalRuntime?: (release: GameRelease, code: PackageBlob) => boolean,
): void {
  if (
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.blobs) ||
    !Array.isArray(catalog.releases)
  )
    throw new Error('invalid-catalog');
  const blobs = new Map<string, PackageBlob>();
  for (const blob of catalog.blobs) {
    if (
      !/^[a-f0-9]{64}$/.test(blob.id) ||
      blobIdentity(blob) !== blob.id ||
      blobs.has(blob.id) ||
      !/^[a-f0-9]{64}$/.test(blob.archiveSha256) ||
      !Number.isSafeInteger(blob.archiveBytes) ||
      blob.archiveBytes <= 0 ||
      !Number.isSafeInteger(blob.installedBytes) ||
      blob.installedBytes < 0 ||
      !safePath(blob.assetName) ||
      blob.assetName.includes('/') ||
      !/^[a-zA-Z0-9._-]+$/.test(blob.releaseTag)
    )
      throw new Error('invalid-blob');
    const paths = new Set<string>();
    for (const file of blob.files) {
      if (
        !safePath(file.path) ||
        paths.has(file.path.toLowerCase()) ||
        !Number.isSafeInteger(file.size) ||
        file.size < 0 ||
        !/^[a-f0-9]{64}$/.test(file.sha256)
      )
        throw new Error('invalid-package-file');
      paths.add(file.path.toLowerCase());
    }
    if (blob.files.reduce((n, f) => n + f.size, 0) !== blob.installedBytes)
      throw new Error('invalid-installed-size');
    blobs.set(blob.id, blob);
  }
  const refs = new Set<string>();
  for (const release of catalog.releases) {
    if (
      releaseIdentity(release) !== release.releaseId ||
      refs.has(release.releaseId) ||
      !/^[a-z][a-z0-9-]*$/.test(release.gameId) ||
      release.module.id !== release.gameId ||
      (release.variantId !== undefined &&
        !/^[a-z][a-z0-9-]*$/.test(release.variantId))
    )
      throw new Error('invalid-release');
    refs.add(release.releaseId);
    const closure = [...new Set([release.code, ...release.resources])].map(
      (id) => blobs.get(id),
    );
    if (
      closure.some((b) => !b) ||
      blobs.get(release.code)?.kind !== 'code' ||
      release.resources.some((id) => blobs.get(id)?.kind !== 'resources')
    )
      throw new Error('missing-package-dependency');
    const code = blobs.get(release.code)!;
    if (
      (['archiveBytes', 'installedBytes'] as const).some(
        (metric) =>
          closure.reduce((n, b) => n + (b?.[metric] ?? 0), 0) >=
          GAME_SIZE_LIMIT,
      ) &&
      !verifyLocalRuntime?.(release, code)
    )
      throw new Error('game-package-size-limit');
    if (
      !release.module.entries.web.startsWith('web/') ||
      release.module.entries.rules.startsWith('web/') ||
      release.module.entries.bot.startsWith('web/') ||
      (release.module.styles ?? []).some(
        (path) => !path.startsWith('web/') || !path.endsWith('.css'),
      )
    )
      throw new Error('invalid-module-entry');
    for (const entry of [
      ...Object.values(release.module.entries),
      ...(release.module.styles ?? []),
    ])
      if (!safePath(entry) || !code.files.some((f) => f.path === entry))
        throw new Error('invalid-module-entry');
    if (
      release.module.details !== undefined &&
      (!safePath(release.module.details) ||
        !release.module.details.startsWith('web/') ||
        !release.module.details.endsWith('.json') ||
        release.resourceMap[release.module.details] !== undefined ||
        !code.files.some((file) => file.path === release.module.details))
    )
      throw new Error('invalid-module-details');
    for (const [logical, target] of Object.entries(release.resourceMap))
      if (
        !safePath(logical) ||
        !release.resources.includes(target.blobId) ||
        !blobs.get(target.blobId)?.files.some((f) => f.path === target.path)
      )
        throw new Error('invalid-resource-map');
  }
}

/** Central-directory ZIP reader: reject encrypted, ZIP64, symlink, duplicate and escaping members before inflation. */
export function readZip(
  bytes: Buffer,
  maxBytes = GAME_SIZE_LIMIT,
): Map<string, Buffer> {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      bytes.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + bytes.readUInt16LE(i + 20) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0) throw new Error('invalid-zip');
  const count = bytes.readUInt16LE(end + 10),
    central = bytes.readUInt32LE(end + 16),
    centralSize = bytes.readUInt32LE(end + 12);
  if (
    bytes.readUInt16LE(end + 4) !== 0 ||
    bytes.readUInt16LE(end + 6) !== 0 ||
    count !== bytes.readUInt16LE(end + 8) ||
    count === 65535 ||
    central + centralSize !== end
  )
    throw new Error('unsupported-zip');
  const records: {
    path: string;
    offset: number;
    method: number;
    compressed: number;
    size: number;
    crc: number;
  }[] = [];
  const names = new Set<string>();
  let cursor = central,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('invalid-zip-directory');
    const flags = bytes.readUInt16LE(cursor + 8),
      method = bytes.readUInt16LE(cursor + 10),
      compressed = bytes.readUInt32LE(cursor + 20),
      size = bytes.readUInt32LE(cursor + 24),
      nl = bytes.readUInt16LE(cursor + 28),
      xl = bytes.readUInt16LE(cursor + 30),
      cl = bytes.readUInt16LE(cursor + 32),
      mode = bytes.readUInt32LE(cursor + 38) >>> 16;
    if (cursor + 46 + nl + xl + cl > end)
      throw new Error('invalid-zip-directory');
    const path = bytes.subarray(cursor + 46, cursor + 46 + nl).toString('utf8');
    if (
      !safePath(path) ||
      names.has(path.toLowerCase()) ||
      ![0, 0x8000].includes(mode & 0xf000) ||
      (flags & ~0x0800) !== 0 ||
      ![0, 8].includes(method) ||
      compressed === 0xffffffff ||
      size === 0xffffffff
    )
      throw new Error('unsafe-zip-member');
    names.add(path.toLowerCase());
    total += size;
    if (total >= maxBytes) throw new Error('zip-size-limit');
    records.push({
      path,
      offset: bytes.readUInt32LE(cursor + 42),
      method,
      compressed,
      size,
      crc: bytes.readUInt32LE(cursor + 16),
    });
    cursor += 46 + nl + xl + cl;
  }
  if (cursor !== end) throw new Error('invalid-zip-directory');
  const output = new Map<string, Buffer>();
  let previousEnd = 0;
  for (const r of records.sort((a, b) => a.offset - b.offset)) {
    if (
      r.offset !== previousEnd ||
      r.offset + 30 > central ||
      bytes.readUInt32LE(r.offset) !== 0x04034b50
    )
      throw new Error('invalid-zip-local');
    const nl = bytes.readUInt16LE(r.offset + 26),
      xl = bytes.readUInt16LE(r.offset + 28),
      start = r.offset + 30 + nl + xl;
    if (
      start + r.compressed > central ||
      bytes.readUInt16LE(r.offset + 8) !== r.method ||
      bytes.subarray(r.offset + 30, r.offset + 30 + nl).toString('utf8') !==
        r.path
    )
      throw new Error('invalid-zip-local');
    const data = bytes.subarray(start, start + r.compressed),
      decoded =
        r.method === 0
          ? Buffer.from(data)
          : inflateRawSync(data, { maxOutputLength: Math.max(1, r.size) });
    if (decoded.length !== r.size || crc32(decoded) !== r.crc)
      throw new Error('invalid-zip-content');
    output.set(r.path, decoded);
    previousEnd = start + r.compressed;
  }
  return output;
}
export function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
