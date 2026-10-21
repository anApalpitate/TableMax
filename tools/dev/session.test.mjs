import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  symlink,
  rename,
  copyFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { createDevelopmentSession } from './session.mjs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { discoverGameMedia } from '../build/game-resources.mjs';
import {
  gameResourceUnits,
  buildUnit,
  validateInputs,
  inputsFor,
} from '../build/module-build.mjs';

async function fixture(t, prefix = 'dev-session-test-') {
  await mkdir(resolve('tmp'), { recursive: true });
  const root = await mkdtemp(resolve('tmp', prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('each startup isolates old room, browser and configured external data', async (t) => {
  const root = await fixture(t);
  const box = join(root, 'box');
  const external = join(root, 'formal-data');
  await mkdir(box);
  await mkdir(external);
  const historical = {
    'TableMax.config.json': JSON.stringify({ dataDirectory: external }),
    'tablemax.sqlite': 'old room and identities',
    'profile.json': 'old browser state',
  };
  for (const [name, value] of Object.entries(historical))
    await writeFile(join(box, name), value);
  await writeFile(join(external, 'save'), 'formal save');
  const env = {
    TABLEMAX_BOX_DIRECTORY: box,
    TABLEMAX_DATA_DIR: external,
    TABLEMAX_HOST: '127.0.0.1',
  };
  const first = await createDevelopmentSession(env);
  assert.notEqual(first.directory, box);
  assert.notEqual(first.directory, external);
  assert.equal(first.env.TABLEMAX_BOX_DIRECTORY, first.directory);
  assert.equal(first.env.TABLEMAX_DATA_DIR, first.directory);
  assert.equal(first.env.TABLEMAX_HOST, '127.0.0.1');
  await writeFile(
    join(first.directory, 'tablemax.sqlite'),
    'previous development game',
  );
  await mkdir(join(first.directory, 'desktop/webview2'), { recursive: true });
  await writeFile(
    join(first.directory, 'desktop/webview2/Local State'),
    'previous browser',
  );
  // Even a still-existing/crashed session is never selected on the next launch.
  const second = await createDevelopmentSession(env);
  assert.notEqual(second.directory, first.directory);
  assert.deepEqual(await readdir(second.directory), [
    '.tablemax-dev-session.json',
  ]);
  await first.dispose();
  assert.ok(
    (await readdir(join(box, 'sessions'))).includes(
      second.directory.split(/[\\/]/).at(-1),
    ),
  );
  await second.dispose();
  await second.dispose();
  assert.deepEqual(await readdir(join(box, 'sessions')), []);
  for (const [name, value] of Object.entries(historical))
    assert.equal(await readFile(join(box, name), 'utf8'), value);
  assert.equal(await readFile(join(external, 'save'), 'utf8'), 'formal save');
  assert.equal(env.TABLEMAX_DATA_DIR, external);
});

test('cleanup refuses a session whose ownership marker has changed', async (t) => {
  const root = await fixture(t);
  const session = await createDevelopmentSession({
    TABLEMAX_BOX_DIRECTORY: root,
  });
  await writeFile(
    join(session.directory, '.tablemax-dev-session.json'),
    'someone else',
  );
  await writeFile(join(session.directory, 'save'), 'preserve');
  await assert.rejects(session.dispose(), /ownership changed/);
  assert.equal(
    await readFile(join(session.directory, 'save'), 'utf8'),
    'preserve',
  );
});

test('cleanup refuses a directory replaced by a junction to other saves', async (t) => {
  const root = await fixture(t);
  const session = await createDevelopmentSession({
    TABLEMAX_BOX_DIRECTORY: root,
  });
  const original = join(root, 'original');
  const other = join(root, 'other');
  await mkdir(other);
  await writeFile(join(other, 'save'), 'preserve');
  await rename(session.directory, original);
  await symlink(
    other,
    session.directory,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(session.dispose(), /ownership changed/);
  assert.equal(await readFile(join(other, 'save'), 'utf8'), 'preserve');
});

test('default sessions live below the dedicated development cache', async () => {
  const session = await createDevelopmentSession({});
  try {
    assert.equal(
      dirname(session.directory),
      resolve('.cache/development/sessions'),
    );
  } finally {
    await session.dispose();
  }
});

test(
  'a future no-glob module serves discovered media from immutable current and restored development releases',
  { timeout: 60000 },
  async (t) => {
    const root = await fixture(t, 'efficiency-build-');
    const workspace = join(root, 'expansion/workspace');
    const id = 'future-table';
    const assets = join(workspace, 'assets/games', id);
    await mkdir(join(assets, 'expansion'), { recursive: true });
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>',
    );
    await writeFile(join(assets, 'card.svg'), svg);
    await writeFile(join(assets, 'expansion/extra.svg'), svg);
    await writeFile(
      join(assets, 'rules-original.pdf'),
      'original, never a runtime resource',
    );
    await writeFile(join(assets, 'sources.json'), '{"source":"retained"}');
    const wav = Buffer.alloc(48);
    wav.write('RIFF');
    wav.writeUInt32LE(40, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(4, 40);
    await writeFile(join(assets, 'tap.wav'), wav);
    assert.deepEqual(await discoverGameMedia({ id }, workspace), [
      `assets/games/${id}/card.svg`,
      `assets/games/${id}/expansion/extra.svg`,
      `assets/games/${id}/tap.wav`,
    ]);
    const module = JSON.parse(
      await readFile('games/template/game-module.json', 'utf8'),
    );
    Object.assign(module, { id, internal: false, cover: null });
    Object.assign(module.catalog, { id, name: 'Future fixture' });
    const cacheRoot = join(root, 'cache');
    const client = join(root, 'client.ts');
    await writeFile(
      client,
      `import {resourceUrl} from '@tablemax/web-host'; export const card=resourceUrl('${id}/card.svg',import.meta.url);`,
    );
    const importClosure = await inputsFor({
      id: 'future-no-glob-web',
      kind: 'web',
      module,
      inputs: [client],
    });
    // The previous import/glob-only pipeline observes no media for this valid
    // dynamic client. Directory discovery must supply the missing resource unit.
    assert.deepEqual(importClosure.mediaPaths, []);
    const resourceUnits = () =>
      gameResourceUnits(module, importClosure.mediaPaths, workspace);
    const initialUnits = await resourceUnits();
    assert.equal(initialUnits.length, 2);
    assert.equal(new Set(initialUnits.flatMap((unit) => unit.inputs)).size, 3);
    const first = await buildUnit(
      initialUnits.find((unit) => unit.id.endsWith('-common')),
      false,
      { cacheRoot },
    );
    const variant = await buildUnit(
      initialUnits.find((unit) => unit.id.endsWith('-variant')),
      false,
      { cacheRoot },
    );
    assert.deepEqual(
      first.files.map((file) => file.path),
      ['card.svg', 'tap.wav'],
    );
    assert.deepEqual(
      variant.files.map((file) => file.path),
      ['expansion/extra.svg'],
    );
    await writeFile(join(assets, 'added.svg'), svg);
    await assert.rejects(validateInputs(first), /Glob changed/);
    await validateInputs(variant);
    const changed = await buildUnit(
      (await resourceUnits()).find((unit) => unit.id.endsWith('-common')),
      false,
      { cacheRoot },
    );
    assert.notEqual(changed.fingerprint, first.fingerprint);
    assert.equal(changed.cached, false);
    await rm(join(assets, 'added.svg'));
    await assert.rejects(validateInputs(changed), /ENOENT/);
    const reverted = await buildUnit(
      (await resourceUnits()).find((unit) => unit.id.endsWith('-common')),
      false,
      { cacheRoot },
    );
    assert.equal(reverted.fingerprint, first.fingerprint);
    assert.equal(reverted.cached, true);
    await assert.rejects(
      gameResourceUnits(module, ['assets/games/template/die.svg'], workspace),
      /another game/,
    );
    if (process.platform === 'win32')
      await assert.rejects(
        gameResourceUnits(module, ['C:/outside.svg'], workspace),
        /another game/,
      );

    const app = join(root, 'runtime');
    for (const part of [
      'games',
      'bots',
      `web/games/${id}/web`,
      `web/games/${id}/resources/${id}`,
    ])
      await mkdir(join(app, part), { recursive: true });
    for (const record of [first, variant])
      for (const file of record.files) {
        const target = join(app, `web/games/${id}/resources/${id}`, file.path);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(join(record.directory, 'files', file.path), target);
      }
    module.entries = {
      rules: `games/${id}.cjs`,
      bot: `bots/${id}.cjs`,
      web: `/games/${id}/web/entry.js`,
    };
    module.styles = [];
    delete module.details;
    await writeFile(join(app, 'modules.json'), JSON.stringify([module]));
    await writeFile(join(app, '.tablemax-development.json'), '{"version":1}');
    await writeFile(
      join(app, 'web/index.html'),
      '<html>isolated no-glob development fixture</html>',
    );
    // Real browser module uses only resourceUrl; no import, CSS URL or media glob.
    await build({
      entryPoints: [client],
      outfile: join(app, `web/games/${id}/web/entry.js`),
      bundle: false,
      format: 'esm',
      platform: 'browser',
      logLevel: 'silent',
    });
    await build({
      stdin: {
        contents: `export {createService} from './apps/server/src/service';export {resourceUrl} from './packages/web-host/src/resource-url';`,
        resolveDir: resolve('.'),
      },
      outfile: join(app, 'service.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      logLevel: 'silent',
    });
    await build({
      stdin: {
        contents: `import {rules as original} from './games/template/rules';export const rules={...original,manifest:{...original.manifest,id:'${id}',assetNamespace:'${id}'}};`,
        resolveDir: resolve('.'),
      },
      outfile: join(app, `games/${id}.cjs`),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      logLevel: 'silent',
    });
    await build({
      stdin: {
        contents: `import {bot as original} from './games/template/bot';export const bot={...original,gameId:'${id}'};`,
        resolveDir: resolve('.'),
      },
      outfile: join(app, `bots/${id}.cjs`),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      logLevel: 'silent',
    });
    const require = createRequire(import.meta.url);
    const { createService, resourceUrl } = require(join(app, 'service.cjs'));
    const config = {
      dataDir: join(root, 'isolated-data'),
      gamesDir: join(root, 'isolated-games'),
      webDir: join(app, 'web'),
      host: '127.0.0.1',
      port: 0,
    };
    let service = await createService(config);
    let port = await service.listen();
    const view = () => service.room.view(service.hostToken);
    const command = async (token, value) => {
      const current = service.room.view(token);
      const reply = await service.room.command(token, {
        actionId: crypto.randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command: value,
      });
      assert.equal(reply.ok, true, JSON.stringify(reply));
    };
    const resource = async (ref, name) =>
      fetch(
        `http://127.0.0.1:${port}${resourceUrl(`${id}/${name}`, `http://127.0.0.1:${port}/game-packages/${ref}/web/web/entry.js`)}`,
      );
    try {
      await command(service.hostToken, { type: 'select-game', gameId: id });
      const ref = view().game.releaseRef;
      assert.match(ref, /^[a-f0-9]{64}$/);
      for (const [name, mime, bytes] of [
        ['card.svg', 'image/svg+xml', svg],
        ['tap.wav', 'audio/wav', wav],
        ['expansion/extra.svg', 'image/svg+xml', svg],
      ]) {
        const response = await resource(ref, name);
        assert.equal(response.status, 200);
        assert.ok(response.headers.get('content-type').startsWith(mime));
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      }
      for (const suffix of [
        'resources/template/die.svg',
        `resources/${id}/rules-original.pdf`,
        `resources/${id}/sources.json`,
        `games/${id}.cjs`,
      ])
        assert.equal(
          (
            await fetch(
              `http://127.0.0.1:${port}/game-packages/${ref}/${suffix}`,
            )
          ).status,
          404,
        );
      const descriptor = await (
        await fetch(
          `http://127.0.0.1:${port}/api/game-packages/releases/${ref}`,
        )
      ).json();
      assert.equal(descriptor.gameId, id);
      assert.ok(
        (
          await (
            await fetch(
              `http://127.0.0.1:${port}/game-packages/${ref}/${descriptor.module.entries.web}`,
            )
          ).text()
        ).includes('resourceUrl'),
      );
      for (const name of ['Future A', 'Future B']) {
        const joined = await service.room.join(name);
        await command(joined.token, { type: 'ready', ready: true });
      }
      await command(service.hostToken, { type: 'start' });
      const saved = view();
      await service.close();
      service = null;
      const newer = Buffer.from(svg.toString().replace('red', 'blue'));
      await writeFile(
        join(app, `web/games/${id}/resources/${id}/card.svg`),
        newer,
      );
      service = await createService(config);
      port = await service.listen();
      assert.equal(view().instanceId, saved.instanceId);
      assert.equal(view().game.releaseRef, ref);
      assert.equal(view().paused, true);
      assert.deepEqual(
        Buffer.from(await (await resource(ref, 'card.svg')).arrayBuffer()),
        svg,
      );
      await command(service.hostToken, {
        type: 'select-game',
        gameId: id,
        endCurrent: true,
      });
      const currentRef = view().game.releaseRef;
      assert.notEqual(currentRef, ref);
      assert.deepEqual(
        Buffer.from(
          await (await resource(currentRef, 'card.svg')).arrayBuffer(),
        ),
        newer,
      );
      assert.deepEqual(
        Buffer.from(await (await resource(ref, 'card.svg')).arrayBuffer()),
        svg,
      );
    } finally {
      if (service) await service.close();
    }
  },
);

test('automatic resource discovery rejects linked namespaces and newly introduced links', async (t) => {
  const root = await fixture(t);
  const assets = join(root, 'assets/games/future-table');
  const outside = join(root, 'outside');
  await mkdir(assets, { recursive: true });
  await mkdir(outside);
  await writeFile(join(outside, 'secret.svg'), '<svg/>');
  await symlink(
    outside,
    join(assets, 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    discoverGameMedia({ id: 'future-table' }, root),
    /Linked game resources/,
  );
  await rm(join(assets, 'linked'));
  await rm(assets, { recursive: true });
  await symlink(
    outside,
    assets,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    discoverGameMedia({ id: 'future-table' }, root),
    /Linked game resources/,
  );
  await assert.rejects(
    discoverGameMedia({ id: '../outside' }, root),
    /Invalid game resource namespace/,
  );
});
