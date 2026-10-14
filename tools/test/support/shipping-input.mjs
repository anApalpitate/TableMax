import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  readFile,
  readdir,
  stat,
  mkdir,
  writeFile,
  copyFile,
} from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { digest, localFile } from '../runner/evidence.mjs';

/** Bind every portable verifier to the currently frozen full EXE and payload. */
export async function extractCurrentDelivery({
  work,
  root = resolve('.'),
  expectedSha256,
}) {
  const { version } = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  const pointer = localFile(
    root,
    `artifacts/package-payloads/v${version}/current.json`,
  );
  const pointerBytes = await readFile(pointer);
  const index = JSON.parse(pointerBytes);
  const delivery = index.deliveries.find((item) => item.edition === 'full');
  assert.ok(delivery, 'Current verified full EXE is required');
  const executable = localFile(root, delivery.executable.path);
  const payload = localFile(root, delivery.archivePath);
  const manifestPath = localFile(root, delivery.manifestPath);
  const executableBytes = await readFile(executable);
  const payloadBytes = await readFile(payload);
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  const snapshotPath = localFile(
    root,
    `build/snapshots/${index.snapshot}.json`,
  );
  const snapshotBytes = await readFile(snapshotPath);
  const snapshot = JSON.parse(snapshotBytes);
  assert.equal(snapshot.id, index.snapshot);
  assert.equal(manifest.snapshot, index.snapshot);
  assert.equal(manifest.version, version);
  assert.equal(manifest.buildVersion, index.buildVersion);
  const exeSha = digest(executableBytes);
  assert.equal(exeSha, delivery.executable.sha256);
  if (expectedSha256)
    assert.equal(
      exeSha,
      expectedSha256.toLowerCase(),
      'Frozen EXE hash required',
    );
  assert.equal(digest(payloadBytes), delivery.executable.payloadSha256);
  assert.equal(manifest.archive.sha256, digest(payloadBytes));
  assert.equal(manifest.edition, 'full');
  assert.ok(
    executableBytes.length < 120000000 && payloadBytes.length < 120000000,
  );
  // Let the launcher create a fresh direct temporary directory atomically.
  const proofPath = localFile(
    root,
    `artifacts/maintenance/v${version}/windows-editions/${index.snapshot}/shipping-executable-checks-full.json`,
  );
  let proofBytes;
  try {
    proofBytes = await readFile(proofPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let extracted;
  if (proofBytes) {
    const proof = JSON.parse(proofBytes);
    assert.equal(proof.result, 'passed');
    assert.equal(proof.snapshot, index.snapshot);
    assert.equal(proof.executableSha256, exeSha);
    let verifiedPath = proof.extracted;
    if (
      delivery.deliveryType === 'installer' ||
      delivery.executable.type === 'installer'
    ) {
      assert.equal(
        proof.deliveryType,
        'installer',
        'An actual installation proof is required',
      );
      assert.equal(proof.payloadSha256, digest(payloadBytes));
      assert.equal(proof.runtimeRoot, proof.extracted);
      assert.equal(
        proof.installationManifestSha256,
        delivery.executable.installation.manifestSha256,
      );
      assert.equal(
        digest(
          await readFile(
            localFile(root, delivery.executable.installation.manifestPath),
          ),
        ),
        proof.installationManifestSha256,
      );
      assert.ok(proof.installRoot && proof.boxRoot);
      if (proof.uninstalled) {
        const copy = proof.verifiedRuntime;
        assert.ok(copy && proof.verifiedRuntimeRoot);
        assert.equal(copy.path, proof.verifiedRuntimeRoot);
        assert.equal(copy.sourceRuntimeRoot, proof.runtimeRoot);
        assert.equal(copy.installationId, proof.installationId);
        assert.equal(copy.executableSha256, exeSha);
        assert.equal(copy.payloadSha256, digest(payloadBytes));
        assert.equal(copy.payloadManifestSha256, digest(manifestBytes));
        const members = [
          ...manifest.files,
          {
            path: '.tablemax-release.json',
            bytes: manifestBytes.length,
            sha256: digest(manifestBytes),
          },
        ].sort((a, b) => a.path.localeCompare(b.path));
        assert.equal(copy.fileCount, members.length);
        assert.deepEqual(copy.files, members);
        verifiedPath = copy.path;
      }
    }
    const verified = localFile(root, verifiedPath);
    extracted = join(work, 'portable');
    await mkdir(extracted, { recursive: true });
    // Native safety creates managed runtime files after the exact-file audit.
    // Copy only the frozen payload and marker to isolate each subsequent run.
    for (const file of [
      ...manifest.files,
      {
        path: '.tablemax-release.json',
        bytes: manifestBytes.length,
        sha256: digest(manifestBytes),
      },
    ]) {
      const input = localFile(verified, file.path);
      const inputBytes = await readFile(input);
      assert.equal(inputBytes.length, file.bytes, file.path);
      assert.equal(digest(inputBytes), file.sha256, file.path);
      const target = localFile(extracted, file.path);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(input, target);
    }
  } else {
    assert.ok(
      delivery.deliveryType !== 'installer' &&
        delivery.executable.type !== 'installer',
      'Run the actual installer verifier first; an installer cannot use portable extraction',
    );
    extracted = work + '-portable';
    await promisify(execFile)(executable, [`--extract-only=${extracted}`], {
      windowsHide: true,
      timeout: 120000,
    });
  }
  let bytes = 0,
    count = 0;
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink());
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await inventory(path);
      else {
        bytes += (await stat(path)).size;
        count++;
      }
    }
  }
  await inventory(extracted);
  assert.equal(count, manifest.files.length + 1);
  assert.ok(bytes < 120000000);
  for (const file of manifest.files) {
    const path = localFile(extracted, file.path),
      data = await readFile(path);
    assert.equal(data.length, file.bytes, file.path);
    assert.equal(digest(data), file.sha256, file.path);
  }
  const binding = {
    version,
    edition: 'full',
    deliveryType:
      delivery.deliveryType ?? delivery.executable.type ?? 'portable',
    componentScope:
      'verified app payload copy; installer system changes require their own proof',
    snapshot: index.snapshot,
    snapshotPath,
    snapshotSha256: digest(snapshotBytes),
    executable,
    executableSha256: exeSha,
    executableBytes: executableBytes.length,
    payload,
    payloadSha256: digest(payloadBytes),
    payloadBytes: payloadBytes.length,
    manifestPath,
    manifestSha256: digest(manifestBytes),
    pointerSha256: digest(pointerBytes),
    extractedBytes: bytes,
    extractedFiles: count,
    extractionProof: proofBytes ? proofPath : null,
    extractionProofSha256: proofBytes ? digest(proofBytes) : null,
  };
  return {
    executablePath: join(extracted, 'TableMax.exe'),
    extracted,
    manifest,
    binding,
    assertUnchanged: async () => {
      if (proofBytes)
        assert.equal(digest(await readFile(proofPath)), digest(proofBytes));
      assert.equal(
        digest(await readFile(snapshotPath)),
        binding.snapshotSha256,
      );
      assert.equal(digest(await readFile(pointer)), binding.pointerSha256);
      assert.equal(
        digest(await readFile(executable)),
        binding.executableSha256,
      );
      assert.equal(digest(await readFile(payload)), binding.payloadSha256);
      assert.equal(
        digest(await readFile(manifestPath)),
        binding.manifestSha256,
      );
    },
  };
}

/** Materialize only the actual EXE's preinstalled Pokémon code/resource closure. */
export async function materializePokemonClients(shipping, work, destination) {
  const helper = join(work, 'zip-verifier.cjs');
  await build({
    entryPoints: [resolve('apps/server/src/game-packages/verification.ts')],
    outfile: helper,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const { readZip, validateCatalog } = createRequire(import.meta.url)(helper);
  const catalog = JSON.parse(
    await readFile(
      join(shipping.extracted, 'preinstalled-games/catalog.json'),
      'utf8',
    ),
  ).payload;
  validateCatalog(catalog);
  const bootstrap = JSON.parse(
    await readFile(
      join(shipping.extracted, 'preinstalled-games/bootstrap.json'),
      'utf8',
    ),
  );
  const releases = catalog.releases.filter(
    (r) =>
      r.gameId === 'pokemon-encounters' &&
      bootstrap.releaseIds.includes(r.releaseId),
  );
  assert.equal(releases.length, 2);
  const blobs = new Map(),
    written = new Map();
  const moduleDir = join(destination, 'games/pokemon-encounters');
  await mkdir(moduleDir, { recursive: true });
  const write = async (path, bytes) => {
    const target = localFile(moduleDir, path);
    if (written.has(path)) assert.equal(written.get(path), digest(bytes));
    else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      written.set(path, digest(bytes));
    }
  };
  for (const release of releases) {
    for (const id of [release.code, ...release.resources])
      if (!blobs.has(id)) {
        const descriptor = catalog.blobs.find((b) => b.id === id),
          data = await readFile(
            join(shipping.extracted, 'preinstalled-games/blobs', id + '.zip'),
          );
        assert.equal(data.length, descriptor.archiveBytes);
        assert.equal(digest(data), descriptor.archiveSha256);
        const files = readZip(data, 120000000);
        assert.equal(files.size, descriptor.files.length);
        for (const f of descriptor.files) {
          const bytes = files.get(f.path);
          assert.ok(bytes);
          assert.equal(bytes.length, f.size);
          assert.equal(digest(bytes), f.sha256);
        }
        blobs.set(id, files);
      }
    for (const [path, bytes] of blobs.get(release.code))
      await write(path, bytes);
    for (const [logical, ref] of Object.entries(release.resourceMap))
      await write('resources/' + logical, blobs.get(ref.blobId).get(ref.path));
  }
  const expansion = releases.find((r) => r.variantId === 'expansion');
  return {
    moduleDir,
    rulesPath: localFile(moduleDir, expansion.module.entries.rules),
    botPath: localFile(moduleDir, expansion.module.entries.bot),
    styles: expansion.module.styles.map(
      (path) => '/games/pokemon-encounters/' + path,
    ),
    releaseIds: releases.map((r) => r.releaseId),
  };
}
