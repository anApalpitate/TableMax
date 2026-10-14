import { existsSync, readFileSync, statSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname, sep, isAbsolute } from 'node:path';
import { windowsExecutableName } from '../release/windows-executable-name.mjs';

const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
export function currentDeliveries(root, version) {
  root = resolve(root);
  const pointer = resolve(
    root,
    `artifacts/package-payloads/v${version}/current.json`,
  );
  if (!existsSync(pointer)) return [];
  const index = JSON.parse(readFileSync(pointer, 'utf8'));
  if (index.version !== version || !index.deliveries?.length)
    throw new Error('Invalid delivery index');
  const seen = new Set();
  return index.deliveries.map((delivery) => {
    if (
      !['full', 'box'].includes(delivery.edition) ||
      seen.has(delivery.edition)
    )
      throw new Error('Invalid delivery edition');
    seen.add(delivery.edition);
    for (const path of [
      pointer,
      delivery.archivePath,
      delivery.manifestPath,
      delivery.executable?.path,
    ]) {
      const local = relative(root, resolve(path));
      if (
        !local ||
        isAbsolute(local) ||
        local.startsWith('..' + sep) ||
        local === '..' ||
        resolve(path) === root
      )
        throw new Error('Delivery escapes workspace');
      for (
        let cursor = resolve(path);
        cursor !== root;
        cursor = dirname(cursor)
      ) {
        if (lstatSync(cursor).isSymbolicLink())
          throw new Error('Delivery contains a link');
      }
    }
    const prefix = `artifacts/package-payloads/v${version}/`;
    for (const path of [delivery.archivePath, delivery.manifestPath]) {
      if (!relative(root, path).split(sep).join('/').startsWith(prefix))
        throw new Error('Payload outside version directory');
    }
    if (
      resolve(delivery.executable.path) !==
      resolve(
        root,
        'artifacts/releases',
        windowsExecutableName(index.buildVersion ?? version, delivery.edition),
      )
    )
      throw new Error('Unexpected EXE path');
    const manifest = JSON.parse(readFileSync(delivery.manifestPath, 'utf8'));
    if (
      manifest.version !== version ||
      manifest.buildVersion !== index.buildVersion ||
      manifest.edition !== delivery.edition ||
      manifest.archive.sha256 !== hash(delivery.archivePath) ||
      manifest.archive.bytes !== statSync(delivery.archivePath).size ||
      delivery.executable.payloadSha256 !== manifest.archive.sha256 ||
      delivery.executable.sha256 !== hash(delivery.executable.path) ||
      delivery.executable.bytes !== statSync(delivery.executable.path).size
    )
      throw new Error('Delivery hash mismatch');
    if (
      delivery.deliveryType === 'installer' ||
      delivery.executable.type === 'installer'
    ) {
      const installation = delivery.executable.installation;
      if (
        delivery.edition !== 'full' ||
        installation?.productId !== '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}'
      )
        throw new Error('Invalid production installer identity');
      const path = resolve(installation.manifestPath);
      if (!relative(root, path).split(sep).join('/').startsWith(prefix))
        throw new Error('Installation manifest outside payload directory');
      for (let cursor = path; cursor !== root; cursor = dirname(cursor))
        if (lstatSync(cursor).isSymbolicLink())
          throw new Error('Installation manifest contains a link');
      if (hash(path) !== installation.manifestSha256)
        throw new Error('Installation manifest hash mismatch');
      const installed = JSON.parse(readFileSync(path, 'utf8'));
      if (
        installed.productId !== installation.productId ||
        installed.buildVersion !== index.buildVersion ||
        installed.releaseVersion !== version ||
        installed.payloadManifestSha256 !== hash(delivery.manifestPath)
      )
        throw new Error('Installation manifest identity mismatch');
    }
    return { ...delivery, manifest, pointer };
  });
}
