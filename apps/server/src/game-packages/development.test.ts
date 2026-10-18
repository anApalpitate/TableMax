import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createService } from '../service';
import { PackageStore } from './store';
import { PROJECT_GAME_PUBLIC_KEY } from './project-public-key';
import type { Command } from '@tablemax/protocol';
import type { ModuleManifest } from '@tablemax/game-sdk/module-manifest';

type Service = Awaited<ReturnType<typeof createService>>;
async function fixture() {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/development-games-'));
  const app = join(root, 'app');
  for (const path of ['games', 'bots', 'web/games/manila/web'])
    mkdirSync(join(app, path), { recursive: true });
  const module = JSON.parse(
    readFileSync('games/manila/game-module.json', 'utf8'),
  ) as ModuleManifest;
  module.entries = {
    rules: 'games/manila.cjs',
    bot: 'bots/manila.cjs',
    web: '/games/manila/web/entry.js',
  };
  module.styles = [];
  delete module.details;
  writeFileSync(join(app, 'modules.json'), JSON.stringify([module]));
  writeFileSync(
    join(app, '.tablemax-development.json'),
    JSON.stringify({ version: 1 }),
  );
  writeFileSync(
    join(app, 'web/index.html'),
    '<html>source development fixture</html>',
  );
  writeFileSync(
    join(app, 'web/games/manila/web/entry.js'),
    'export const sourceRevision = 1;',
  );
  await Promise.all(
    ['rules', 'bot'].map((part) =>
      build({
        entryPoints: [resolve(`games/manila/${part}/index.ts`)],
        outfile: join(app, part === 'rules' ? 'games' : 'bots', 'manila.cjs'),
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
        logLevel: 'silent',
      }),
    ),
  );
  return {
    root,
    app,
    config: {
      host: '127.0.0.1',
      port: 0,
      webDir: join(app, 'web'),
      dataDir: join(root, 'data'),
      gamesDir: join(root, 'games'),
    },
  };
}
async function command(
  service: Service,
  token: string,
  command: Command['command'],
) {
  const view = service.room.view(token);
  const reply = await service.room.command(token, {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  });
  expect(reply).toMatchObject({ ok: true });
}
it('loads Manila on the first source startup and serves the current browser entry', async () => {
  const f = await fixture();
  const service = await createService(f.config);
  try {
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    const ref = service.room.view().game!.releaseRef!;
    expect(ref).toMatch(/^[a-f0-9]{64}$/);
    const descriptor = await service.app.inject({
      method: 'GET',
      url: `/api/game-packages/releases/${ref}`,
    });
    expect(descriptor.statusCode).toBe(200);
    const entry = await service.app.inject({
      method: 'GET',
      url: `/game-packages/${ref}/` + descriptor.json().module.entries.web,
    });
    expect(entry.statusCode).toBe(200);
    expect(entry.body).toContain('sourceRevision = 1');
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    expect(service.room.view().game!.releaseRef).toBe(ref);
  } finally {
    await service.close();
  }
}, 30000);
it('uses the rebuilt source for new games while an existing SQLite match stays pinned across restarts', async () => {
  const f = await fixture();
  let service = await createService(f.config);
  try {
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    const tokens: string[] = [];
    for (const name of ['源码甲', '源码乙', '源码丙']) {
      const player = await service.room.join(name);
      tokens.push(player.token);
      await command(service, player.token, { type: 'ready', ready: true });
    }
    await command(service, service.hostToken, { type: 'start' });
    const original = service.room.view();
    const oldRef = original.game!.releaseRef!;
    await service.close();
    writeFileSync(
      join(f.app, 'web/games/manila/web/entry.js'),
      'export const sourceRevision = 2;',
    );
    service = await createService(f.config);
    expect(service.room.view().instanceId).toBe(original.instanceId);
    expect(service.room.view().game!.releaseRef).toBe(oldRef);
    expect(service.room.view().gameView).toEqual(original.gameView);
    expect(service.room.view(tokens[0]!).self.role).toBe('player');
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
      endCurrent: true,
    });
    const newRef = service.room.view().game!.releaseRef!;
    expect(newRef).not.toBe(oldRef);
    const oldEntry = await service.app.inject({
      method: 'GET',
      url: `/game-packages/${oldRef}/web/web/entry.js`,
    });
    const newEntry = await service.app.inject({
      method: 'GET',
      url: `/game-packages/${newRef}/web/web/entry.js`,
    });
    expect(oldEntry.body).toContain('sourceRevision = 1');
    expect(newEntry.body).toContain('sourceRevision = 2');
    await service.close();
    service = await createService(f.config);
    expect(service.room.view().game!.releaseRef).toBe(newRef);
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    expect(service.room.view().game!.releaseRef).toBe(newRef);
  } finally {
    await service.close();
  }
}, 30000);
it('cannot make an unsigned local runtime current outside an explicitly marked development build', async () => {
  const f = await fixture();
  const store = new PackageStore({
    root: f.config.gamesDir,
    publicKey: PROJECT_GAME_PUBLIC_KEY,
    protectedReleaseIds: () => [],
  });
  expect(() => store.loadDevelopment(f.app)).toThrow('not-development-build');
  expect(store.current('manila')).toBeUndefined();
  expect(Object.keys(store.snapshot().index.releases)).toHaveLength(0);
}, 30000);
