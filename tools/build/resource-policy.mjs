import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';

export function imageDimensions(bytes) {
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (
    bytes.length >= 30 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const type = bytes.toString('ascii', 12, 16);
    if (type === 'VP8X')
      return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (type === 'VP8L' && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (
      type === 'VP8 ' &&
      bytes[23] === 0x9d &&
      bytes[24] === 1 &&
      bytes[25] === 0x2a
    )
      return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  throw new Error(
    'Unsupported image header in declared runtime resource policy',
  );
}

/** Policies are opt-in in existing provenance manifests; no external source files are required at build time. */
export async function validateResourcePolicies(
  files,
  namespace,
  root = process.cwd(),
) {
  const manifests = new Map();
  const referenced = new Set(files.map((f) => resolve(root, f)));
  for (const file of referenced) {
    for (
      let folder = dirname(file);
      folder === namespace || folder.startsWith(namespace + sep);
      folder = dirname(folder)
    ) {
      const manifest = resolve(folder, 'manifest.json');
      if (manifests.has(manifest)) continue;
      try {
        const value = JSON.parse(await readFile(manifest, 'utf8'));
        manifests.set(manifest, value.runtimePolicy ? value : null);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        manifests.set(manifest, null);
      }
    }
  }
  const inputs = [];
  for (const [manifest, value] of manifests) {
    if (!value) continue;
    const policy = value.runtimePolicy;
    for (const key of [
      'maxWidth',
      'maxHeight',
      'maxFileBytes',
      'maxTotalBytes',
    ])
      if (!Number.isSafeInteger(policy[key]) || policy[key] <= 0)
        throw Error('Invalid resource policy: ' + manifest + ' ' + key);
    if (!Array.isArray(value.assets))
      throw Error('Resource policy needs provenance assets: ' + manifest);
    const names = new Set();
    let total = 0;
    for (const asset of value.assets) {
      if (
        typeof asset.file !== 'string' ||
        !/^[a-zA-Z0-9._-]+$/.test(asset.file) ||
        names.has(asset.file)
      )
        throw Error('Invalid or duplicate resource file: ' + manifest);
      names.add(asset.file);
      const path = resolve(dirname(manifest), asset.file);
      if (!referenced.has(path)) continue; // Unreferenced originals never become runtime inputs.
      if (!asset.source || !/^[a-f0-9]{64}$/.test(asset.source_sha256 ?? ''))
        throw Error('Missing source provenance: ' + path);
      const bytes = await readFile(path),
        sha = createHash('sha256').update(bytes).digest('hex');
      const [width, height] = imageDimensions(bytes);
      if (
        sha !== asset.sha256 ||
        bytes.length !== asset.bytes ||
        width !== asset.width ||
        height !== asset.height
      )
        throw Error('Runtime asset differs from provenance: ' + path);
      if (
        bytes.length > policy.maxFileBytes ||
        width > policy.maxWidth ||
        height > policy.maxHeight
      )
        throw Error('Runtime asset exceeds declared budget: ' + path);
      total += bytes.length;
    }
    for (const path of referenced)
      if (
        dirname(path) === dirname(manifest) &&
        !names.has(relative(dirname(manifest), path))
      )
        throw Error('Runtime asset missing from provenance whitelist: ' + path);
    if (total > policy.maxTotalBytes)
      throw Error(
        'Runtime resource group exceeds declared budget: ' + manifest,
      );
    inputs.push(relative(root, manifest).replaceAll('\\', '/'));
  }
  return inputs.sort();
}
