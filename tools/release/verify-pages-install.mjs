import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { PackageStore } from '../../apps/server/src/game-packages/store.ts';
import { PROJECT_GAME_PUBLIC_KEY } from '../../apps/server/src/game-packages/project-public-key.ts';
import { verifyCatalog } from '../../apps/server/src/game-packages/verification.ts';
import {
  GAME_PAGES_ROOT,
  gameCatalogUrl,
  gameAssetUrl,
} from '../../apps/server/src/game-packages/distribution.ts';
import { createGameRegistry } from '../../apps/server/src/game-registry.ts';
import { RoomCoordinator } from '../../packages/platform-core/src/room.ts';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';

assertWorkspaceRoot();
const output = resolve(
  'artifacts/maintenance/v1.0.6/pages-release-20261011/online-install',
);
const oldClassicRef =
  '926c381b53a7e72a1e8c5eba3b5e07305b360453a9367d8767320e1450e4bab5';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const repository = {
  value: null,
  load() {
    return structuredClone(this.value);
  },
  save(value) {
    this.value = structuredClone(value);
  },
};

async function verify() {
  await mkdir(output, { recursive: true });
  const directory = join(output, 'run-' + randomUUID());
  await mkdir(directory);
  const root = join(directory, 'games');
  const report = {
    startedAt: new Date().toISOString(),
    root,
    catalogUrl: gameCatalogUrl(),
    requests: [],
    progress: [],
    checks: [],
    scope:
      'Real public GitHub Pages HTTPS and production PackageStore/signature/hash/registry/RoomCoordinator. Isolated empty store and in-memory save; no mock transport, Release fallback, HTTP service, browser, Worker, physical phone or complete-match claim.',
  };
  const save = () =>
    writeFile(
      join(directory, 'results.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  const actualFetch = globalThis.fetch;
  const recordedFetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith(GAME_PAGES_ROOT), 'non-Pages request');
    const record = { url, startedAt: new Date().toISOString() };
    report.requests.push(record);
    let response;
    try {
      const deadline = AbortSignal.timeout(600000);
      const signal = init?.signal
        ? AbortSignal.any([init.signal, deadline])
        : deadline;
      response = await actualFetch(input, { ...init, signal });
    } catch (error) {
      record.error = {
        message: error.message,
        cause: error.cause?.message,
        code: error.cause?.code,
      };
      throw error;
    }
    record.status = response.status;
    record.responseUrl = response.url;
    assert.ok(response.url.startsWith(GAME_PAGES_ROOT), 'redirect left Pages');
    return response;
  };
  const recordVerifiedArchives = async (store, catalog, release) => {
    await inventory(store, release);
    for (const id of [release.code, ...release.resources]) {
      const blob = catalog.blobs.find((blob) => blob.id === id);
      assert.ok(store.snapshot().index.blobs[id]);
      for (const request of report.requests.filter(
        (request) => request.url === gameAssetUrl(blob),
      )) {
        assert.equal(request.status, 200);
        request.bytes = blob.archiveBytes;
        request.sha256 = blob.archiveSha256;
        request.digestSource = 'production PackageStore verified archive';
        request.byteCountSource =
          'production PackageStore verified archive length';
        request.installedFilesVerified = true;
        request.finishedAt = new Date().toISOString();
      }
    }
  };
  const options = {
    root,
    publicKey: PROJECT_GAME_PUBLIC_KEY,
    protectedReleaseIds: () =>
      repository.value?.releaseRef ? [repository.value.releaseRef] : [],
    assetUrl: gameAssetUrl,
    fetch: recordedFetch,
  };
  let unsubscribe = () => {};
  try {
    const response = await recordedFetch(gameCatalogUrl(), {
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.ok, true);
    const catalogBytes = Buffer.from(await response.arrayBuffer());
    Object.assign(report.requests[0], {
      bytes: catalogBytes.length,
      sha256: digest(catalogBytes),
      digestSource: 'direct catalog response bytes',
      finishedAt: new Date().toISOString(),
    });
    const envelope = JSON.parse(catalogBytes.toString('utf8'));
    await writeFile(join(directory, 'catalog.json'), catalogBytes);
    const catalog = verifyCatalog(envelope, PROJECT_GAME_PUBLIC_KEY);
    assert.equal(
      catalog.releases.length,
      10,
      'expected eight current plus two previous Avalon releases',
    );
    assert.equal(
      new Set(
        catalog.releases.map(
          (release) => `${release.gameId}:${release.variantId ?? ''}`,
        ),
      ).size,
      8,
    );
    assert.equal(
      catalog.releases.filter((release) => release.gameId === 'avalon').length,
      4,
    );
    const oldRelease = catalog.releases.find(
      (release) => release.releaseId === oldClassicRef,
    );
    assert.equal(oldRelease?.gameId, 'avalon');
    assert.equal(oldRelease.variantId, 'classic');
    const latest = catalog.releases.find(
      (release) =>
        release.gameId === 'avalon' && release.variantId === 'classic',
    );
    assert.notEqual(
      latest.releaseId,
      oldClassicRef,
      'catalog first choice is old Avalon',
    );
    report.oldReleaseRef = oldClassicRef;
    report.latestReleaseRef = latest.releaseId;
    report.catalogReleaseRefs = catalog.releases.map(
      (release) => release.releaseId,
    );
    const store = new PackageStore(options);
    assert.equal(Object.keys(store.snapshot().index.releases).length, 0);
    store.setCatalog(envelope);
    unsubscribe = store.subscribe(() => {
      const tasks = store.snapshot().tasks;
      report.progress.push({ at: new Date().toISOString(), tasks });
    });
    await store.install(oldClassicRef);
    await recordVerifiedArchives(store, catalog, oldRelease);
    const registry = createGameRegistry(false, store);
    const oldGame = await registry.load('avalon', 'classic', oldClassicRef);
    const room = new RoomCoordinator(
      oldGame.rules,
      oldGame.bot,
      repository,
      undefined,
      'play',
      registry,
      undefined,
      'classic',
      oldClassicRef,
    );
    const command = async (command) => {
      const view = room.view(room.hostToken);
      const reply = await room.command(room.hostToken, {
        actionId: randomUUID(),
        instanceId: view.instanceId,
        branch: view.branch,
        revision: view.revision,
        command,
      });
      assert.equal(reply.ok, true);
    };
    for (let i = 0; i < 5; i++)
      await command({
        type: 'add-bot',
        name: `旧局${i + 1}`,
        difficulty: 'default',
      });
    await command({ type: 'start' });
    assert.equal(room.view().game.releaseRef, oldClassicRef);
    const pinned = await inventory(store, oldRelease);
    const savedBefore = structuredClone(repository.value);
    report.pinnedFiles = pinned;
    report.checks.push(
      'exact original classic downloaded from real Pages and started with a pinned live save; old file inventory verified',
    );
    await save();
    await store.install(latest.releaseId);
    await recordVerifiedArchives(store, catalog, latest);
    assert.deepEqual(
      repository.value,
      savedBefore,
      'installation rewrote the live save',
    );
    assert.equal(room.view().game.releaseRef, oldClassicRef);
    assert.equal(room.rules, oldGame.rules, 'live rules object replaced');
    assert.equal(room.strategy, oldGame.bot, 'live strategy object replaced');
    assert.deepEqual(
      await inventory(store, oldRelease),
      pinned,
      'old code/resource identity changed',
    );
    assert.throws(() => store.uninstall(oldClassicRef), /release-in-use/);
    const freshRegistry = createGameRegistry(false, store);
    const newGame = await freshRegistry.load('avalon');
    assert.equal(
      newGame.releaseRef,
      latest.releaseId,
      'ordinary default selection did not use current first release',
    );
    assert.equal(
      store.selected('avalon', 'classic').releaseId,
      latest.releaseId,
    );
    assert.ok(newGame.bot.immediateActions?.includes('finish-discussion'));
    assert.ok(!oldGame.bot.immediateActions?.includes('finish-discussion'));
    report.pinnedFiles = pinned;
    report.checks.push(
      'production signed ten-release catalog, exact old reference installs from Pages, live old rules/strategy/save/resources unchanged after update, referenced uninstall refused, ordinary default load selects latest',
    );
    await save();
    unsubscribe();
    const restarted = new PackageStore(options);
    assert.equal(
      restarted.selected('avalon', 'classic').releaseId,
      latest.releaseId,
    );
    assert.deepEqual(await inventory(restarted, oldRelease), pinned);
    assert.throws(() => restarted.uninstall(oldClassicRef), /release-in-use/);
    const restoredRegistry = createGameRegistry(false, restarted);
    const restoredOld = await restoredRegistry.load(
      'avalon',
      'classic',
      oldClassicRef,
    );
    const restoredRoom = new RoomCoordinator(
      restoredOld.rules,
      restoredOld.bot,
      repository,
      undefined,
      'play',
      restoredRegistry,
      undefined,
      'classic',
      oldClassicRef,
    );
    assert.equal(restoredRoom.view().game.releaseRef, oldClassicRef);
    assert.equal(restoredRoom.view().paused, true);
    report.checks.push(
      'fresh store reload retains selected index and pinned paths/hashes; actual old save reopens paused on old release',
    );
    await save();
    const pokemon = catalog.releases.filter(
      (release) => release.gameId === 'pokemon-encounters',
    );
    assert.equal(pokemon.length, 2);
    const beforeRequests = report.requests.length;
    await Promise.all(
      pokemon.flatMap((release) => [
        restarted.install(release.releaseId),
        restarted.install(release.releaseId),
      ]),
    );
    const closure = new Set(
      pokemon.flatMap((release) => [release.code, ...release.resources]),
    );
    const downloaded = report.requests.slice(beforeRequests);
    assert.equal(
      downloaded.length,
      closure.size,
      'shared or repeated target was fetched twice',
    );
    for (const id of closure) {
      const blob = catalog.blobs.find((blob) => blob.id === id);
      assert.equal(
        downloaded.filter((request) => request.url === gameAssetUrl(blob))
          .length,
        1,
      );
    }
    assert.equal(
      restarted.snapshot().tasks.length,
      2,
      'same target duplicated install tasks',
    );
    const physical = (
      await readdir(join(root, 'pokemon-encounters', 'blobs'))
    ).sort();
    assert.deepEqual(physical, [...closure].sort());
    for (const release of pokemon)
      await recordVerifiedArchives(restarted, catalog, release);
    report.checks.push(
      'both Pokemon variants and repeated targets download each unique shared closure blob exactly once over real Pages HTTPS',
    );
    for (const request of report.requests) {
      assert.equal(request.status, 200);
      const blob = catalog.blobs.find(
        (blob) => gameAssetUrl(blob) === request.url,
      );
      if (blob) {
        assert.equal(request.bytes, blob.archiveBytes);
        assert.equal(request.sha256, blob.archiveSha256);
      }
    }
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed';
    report.error = error.stack;
    process.exitCode = 1;
  } finally {
    unsubscribe();
    report.finishedAt = new Date().toISOString();
    await save();
    await writeFile(
      join(output, 'latest.json'),
      JSON.stringify(
        { result: report.result, evidence: join(directory, 'results.json') },
        null,
        2,
      ) + '\n',
    );
    console.log(
      JSON.stringify({
        result: report.result,
        requests: report.requests.length,
        checks: report.checks.length,
        evidence: join(directory, 'results.json'),
      }),
    );
  }
}

async function inventory(store, release) {
  const resolved = store.resolveModule(release.releaseId);
  assert.ok(resolved);
  const files = [];
  for (const id of [release.code, ...release.resources]) {
    const blob = store.snapshot().index.blobs[id];
    for (const file of blob.files) {
      const path = join(store.root, release.gameId, 'blobs', id, file.path);
      const bytes = await readFile(path);
      assert.equal(bytes.length, file.size);
      assert.equal(digest(bytes), file.sha256);
      files.push({ path, bytes: bytes.length, sha256: digest(bytes) });
    }
  }
  for (const logicalId of Object.keys(release.resourceMap))
    assert.ok(store.resolvePublicFile(release.releaseId, logicalId));
  return { root: resolved.root, files };
}

if (process.argv.includes('--run')) await verify();
else
  console.log(
    JSON.stringify({
      result: 'prepared-only',
      catalogUrl: gameCatalogUrl(),
      output,
      oldClassicRef,
      run: 'node --import tsx tools/release/verify-pages-install.mjs --run',
      networkRequests: 0,
    }),
  );
