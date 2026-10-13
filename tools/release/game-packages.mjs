import { loadTrustedBlobReuse } from './blob-reuse.mjs';
import { createReadPhase } from '../build/read-phase.mjs';
import { mergeCatalogHistory, legacyCatalog } from './catalog-history.mjs';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  projectGameDetails,
  projectGameRuntime,
  projectGameWeb,
} from '../../packages/game-sdk/src/metadata.mjs';
import {
  discover,
  unitsFor,
  buildUnit,
  validateInputs,
  inventory,
  json,
} from '../build/module-build.mjs';
import { isDirectExecution } from '../shared/workspace-root.mjs';
export {
  sha256,
  canonical,
  zipFiles,
  packageCodeDirectory,
  createSignedCatalog,
} from './game-package-format.mjs';
import {
  sha256,
  canonical,
  createBlob,
  createSignedCatalog,
} from './game-package-format.mjs';
export async function packageGames({
  gameId,
  out,
  keyPath = process.env.TABLEMAX_GAME_SIGNING_KEY,
  releaseTag,
  history = [],
  snapshot,
} = {}) {
  if (!keyPath)
    throw new Error(
      'Signing key path required (--key or TABLEMAX_GAME_SIGNING_KEY)',
    );
  releaseTag ??= 'v' + (await json('package.json')).version;
  if (!/^v1\.\d+\.\d+$/.test(releaseTag))
    throw new Error('Invalid public game release tag');
  out = resolve(out ?? `artifacts/game-packages/${releaseTag}/current`);
  await mkdir(out, { recursive: true });
  const publicKeySource = await readFile(
    'apps/server/src/game-packages/project-public-key.ts',
    'utf8',
  );
  const publicKey = publicKeySource
    .match(/'([^']+)'/)[1]
    .replaceAll('\\n', '\n');
  const reuse = await loadTrustedBlobReuse(history, { publicKey });
  const modules = (snapshot?.modules ?? (await discover(gameId))).filter(
    (item) => !item.internal && (!gameId || item.id === gameId),
  );
  if (!modules.length) throw new Error('Unknown game');
  const units = snapshot
      ? []
      : (await unitsFor(modules)).filter((unit) => unit.module),
    results = snapshot
      ? snapshot.units.filter((unit) => unit.id.startsWith('game-'))
      : [];
  for (const unit of units) {
    const result = await buildUnit(unit);
    results.push(result);
    console.log(
      result.id +
        ': ' +
        (result.cached ? 'cache hit' : result.durationMs + 'ms'),
    );
  }
  const inputVerification = createReadPhase(
    'internal-package-input-verification',
  );
  for (const result of results) await validateInputs(result, inputVerification);
  const blobs = [],
    releases = [];
  for (const module of modules) {
    const codeRecords = [];
    const builtModule = projectGameRuntime(module, {
      entries: {
        rules: `rules/${module.id}.cjs`,
        bot: `bots/${module.id}.cjs`,
        web: 'web/entry.js',
      },
      details: 'web/details.json',
    });
    for (const part of ['rules', 'bot', 'web']) {
      const result = results.find(
        (item) => item.id === `game-${module.id}-${part}`,
      );
      for (const file of result.files)
        codeRecords.push({
          path: `${part === 'bot' ? 'bots' : part}/${file.path}`,
          data: await readFile(join(result.directory, 'files', file.path)),
        });
    }
    builtModule.styles = codeRecords
      .filter((file) => file.path.endsWith('.css'))
      .map((file) => file.path);
    codeRecords.push(
      {
        path: 'web/details.json',
        data: Buffer.from(JSON.stringify(projectGameDetails(module))),
      },
      {
        path: 'web/module.json',
        data: Buffer.from(JSON.stringify(projectGameWeb(builtModule))),
      },
    );
    const code = await createBlob('code', codeRecords, out, releaseTag, {
      reuse,
    });
    blobs.push(code);
    const resourceUnits = {};
    for (const part of ['common', 'variant']) {
      const result = results.find(
        (item) => item.id === `game-${module.id}-resources-${part}`,
      );
      if (!result) continue;
      const records = await Promise.all(
        result.files.map(async (file) => ({
          path: file.path,
          data: await readFile(join(result.directory, 'files', file.path)),
        })),
      );
      resourceUnits[part] = await createBlob(
        'resources',
        records,
        out,
        releaseTag,
        { reuse },
      );
      blobs.push(resourceUnits[part]);
    }
    for (const variant of module.variants?.length
      ? module.variants
      : [{ id: undefined }]) {
      const resources = [
        resourceUnits.common,
        ...(variant.id === 'expansion' && resourceUnits.variant
          ? [resourceUnits.variant]
          : []),
      ].filter(Boolean);
      const resourceMap = Object.fromEntries(
        resources.flatMap((blob) =>
          blob.files.map((file) => [
            `${module.id}/${file.path}`,
            { blobId: blob.id, path: file.path },
          ]),
        ),
      );
      const body = {
        gameId: module.id,
        variantId: variant.id,
        module: builtModule,
        code: code.id,
        resources: resources.map((blob) => blob.id),
        resourceMap,
        releaseTag,
      };
      const release = { releaseId: sha256(canonical(body)), ...body };
      const closure = [code, ...resources],
        download = closure.reduce((n, blob) => n + blob.archiveBytes, 0),
        installed = closure.reduce((n, blob) => n + blob.installedBytes, 0);
      if (download >= 64_000_000 || installed >= 64_000_000)
        throw new Error(
          `Gameplay package exceeds 64 MB: ${module.id}/${variant.id ?? ''}`,
        );
      releases.push(release);
      console.log(
        `${module.id}/${variant.id ?? ''}: download ${download}, installed ${installed} bytes${Math.max(download, installed) >= 48_000_000 ? ' [budget warning]' : ''}`,
      );
    }
  }
  const currentPayload = {
    schemaVersion: 1,
    releases,
    blobs: [...new Map(blobs.map((blob) => [blob.id, blob])).values()],
  };
  const histories = [];
  const historicalIds = new Set();
  const historicalOffline = new Map();
  const duplicateOfflineEvidence = [];
  for (const { catalog: old, assets } of reuse.histories) {
    histories.push(old);
    for (const release of old.releases) historicalIds.add(release.releaseId);
    for (const asset of assets) {
      const offlineRelease = old.releases.find(
        (r) => r.offlineAsset === asset.name,
      );
      const prior = historicalOffline.get(asset.name);
      if (prior) {
        if (canonical(prior.release) !== canonical(offlineRelease))
          throw new Error('Historical offline release conflict');
        if (prior.sha256 !== asset.sha256)
          duplicateOfflineEvidence.push({
            name: asset.name,
            selected: prior.path,
            selectedSha256: prior.sha256,
            alternate: asset.path,
            alternateSha256: asset.sha256,
            reason:
              'Existing historical offline ZIPs embed different signed catalogs for the identical immutable release; retain first explicitly ordered history source.',
          });
        continue;
      }
      if (offlineRelease)
        historicalOffline.set(asset.name, {
          release: offlineRelease,
          path: asset.path,
          sha256: asset.sha256,
        });
      if (asset.name.startsWith('TableMax-game-catalog-')) continue;
      const target = join(out, asset.name);
      try {
        if (sha256(await readFile(target)) !== asset.sha256)
          throw new Error('Immutable history asset conflict: ' + asset.name);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await copyFile(asset.path, target);
      }
    }
  }
  const payload = mergeCatalogHistory(currentPayload, histories);
  const signingKey = await readFile(keyPath);
  const envelope = createSignedCatalog(payload, signingKey);
  for (const legacyTag of new Set([
    releaseTag,
    ...payload.blobs.map((blob) => blob.releaseTag),
  ]))
    await writeFile(
      join(out, `TableMax-game-catalog-${legacyTag}-legacy.json`),
      JSON.stringify(
        createSignedCatalog(legacyCatalog(payload), signingKey),
        null,
        2,
      ) + '\n',
    );
  await writeFile(
    join(out, `TableMax-game-catalog-${releaseTag}.json`),
    JSON.stringify(envelope, null, 2) + '\n',
  );
  await writeFile(
    join(out, 'build-record.json'),
    JSON.stringify(
      {
        version: (await json('package.json')).version,
        releaseTag,
        history,
        duplicateOfflineEvidence,
        blobReuse: {
          ...reuse.metrics,
          recipe: reuse.recipe,
          trustKeySha256: reuse.trustKeySha256,
          evidence: reuse.evidence,
        },
        readPhases: [inputVerification.stats],
        units: results.map(({ id, fingerprint, directory }) => ({
          id,
          fingerprint,
          directory,
        })),
        files: await inventory(out),
      },
      null,
      2,
    ) + '\n',
  );
  return envelope;
}
if (isDirectExecution(import.meta.url))
  throw new Error(
    'Standalone game export is retired; build games as internal inputs of package:win',
  );
