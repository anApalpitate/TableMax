import { it, expect } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { createService } from '../service';
import { SqliteSaveRepository } from '../save-repository';
import type { Save } from '@tablemax/platform-core';
import type { Command } from '@tablemax/protocol';
import type { JsonValue } from '@tablemax/game-sdk';
import type { ModuleManifest } from '@tablemax/game-sdk/module-manifest';
import { rules, bot } from '../../../../games/uno';
type Service = Awaited<ReturnType<typeof createService>>;
async function command(
  service: Service,
  token: string,
  value: Command['command'],
) {
  const view = service.room.view(token);
  const reply = await service.room.command(token, {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: value,
  });
  expect(reply.ok).toBe(true);
}
function loadSave(dataDir: string): Save {
  const repository = new SqliteSaveRepository(dataDir);
  try {
    return repository.load() as Save;
  } finally {
    repository.close();
  }
}
/** Entire fixture is generated from checked-in source; no local delivery evidence. */
async function fixture(
  mismatch?: 'gameVersion' | 'rulesVersion' | 'stateVersion',
) {
  const root = mkdtempSync(join(tmpdir(), 'tablemax-legacy-save-'));
  const config = {
    host: '127.0.0.1' as const,
    port: 0,
    dataDir: join(root, 'data'),
    webDir: join(root, 'web'),
  };
  mkdirSync(config.webDir);
  writeFileSync(
    join(config.webDir, 'index.html'),
    '<html>isolated regression fixture</html>',
  );
  let service: Service | undefined;
  try {
    service = await createService(config, { rules, bot });
    const tokens: string[] = [];
    for (const name of ['旧局甲', '旧局乙']) {
      const player = await service.room.join(name);
      tokens.push(player.token);
      await command(service, player.token, { type: 'ready', ready: true });
    }
    await command(service, service.hostToken, { type: 'start' });
    let acted = false;
    for (const token of tokens) {
      const view = service.room.view(token);
      const actions = view.actions as JsonValue[];
      const action =
        actions.find(
          (action) =>
            action &&
            typeof action === 'object' &&
            !Array.isArray(action) &&
            action.type === 'draw',
        ) ?? actions[0];
      if (action) {
        await command(service, token, {
          type: 'game',
          decisionId: view.decisionId!,
          action,
        });
        acted = true;
        break;
      }
    }
    expect(acted).toBe(true);
    await service.close();
    service = undefined;
    const saved = loadSave(config.dataDir);
    expect(saved.releaseRef).toBeUndefined();
    expect(saved.history).toHaveLength(1);
    const gamesDir = join(root, 'games'),
      snapshot = join(gamesDir, '.legacy', 'a'.repeat(64));
    mkdirSync(join(snapshot, 'games'), { recursive: true });
    mkdirSync(join(snapshot, 'bots'), { recursive: true });
    mkdirSync(join(snapshot, 'web', 'games', 'uno', 'web'), {
      recursive: true,
    });
    await Promise.all(
      ['rules', 'bot'].map((part) =>
        build({
          entryPoints: [resolve(`games/uno/${part}/index.ts`)],
          outfile: join(
            snapshot,
            part === 'rules' ? 'games' : 'bots',
            'uno.cjs',
          ),
          bundle: true,
          platform: 'node',
          format: 'cjs',
          target: 'node22',
          logLevel: 'silent',
        }),
      ),
    );
    const module = JSON.parse(
      readFileSync(resolve('games/uno/game-module.json'), 'utf8'),
    ) as ModuleManifest;
    module.entries = {
      rules: 'games/uno.cjs',
      bot: 'bots/uno.cjs',
      web: '/games/uno/web/entry.js',
    };
    module.styles = [];
    if (mismatch)
      module.compatibility = {
        ...module.compatibility,
        [mismatch]:
          mismatch === 'stateVersion'
            ? module.compatibility.stateVersion + 1
            : 'unmatched-version',
      };
    writeFileSync(join(snapshot, 'modules.json'), JSON.stringify([module]));
    writeFileSync(
      join(snapshot, 'web', 'games', 'uno', 'web', 'entry.js'),
      'export const client = {};',
    );
    service = await createService({ ...config, gamesDir });
    return { root, config, saved, tokens, service };
  } catch (error) {
    await service?.close();
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
it('binds an unpinned save using exact game/rules/state versions, excluding game id from the version tuple', async () => {
  const f = await fixture();
  try {
    const view = f.service.room.view(f.service.hostToken);
    expect(view.game?.id).toBe('uno');
    expect(view.game?.releaseRef).toMatch(/^[a-f0-9]{64}$/);
    expect(view.instanceId).toBe(f.saved.instanceId);
    expect(view.paused).toBe(true);
    expect(view.history).toHaveLength(1);
    expect(view.gameView).not.toBeNull();
    const rebound = loadSave(f.config.dataDir);
    expect(rebound.releaseRef).toBe(view.game?.releaseRef);
    expect(rebound.snapshot).toEqual(f.saved.snapshot);
    expect(rebound.history).toEqual(f.saved.history);
    expect(rebound.seats.map((seat) => seat.tokenHash)).toEqual(
      f.saved.seats.map((seat) => seat.tokenHash),
    );
    for (let i = 0; i < f.tokens.length; i++)
      expect(f.service.room.view(f.tokens[i]!).self?.seatId).toBe(
        f.saved.seats[i]!.id,
      );
  } finally {
    await f.service.close();
    rmSync(f.root, { recursive: true, force: true });
  }
}, 30000);
it.each(['gameVersion', 'rulesVersion', 'stateVersion'] as const)(
  'keeps the original save in repair mode when the preserved %s differs',
  async (mismatch) => {
    const f = await fixture(mismatch);
    try {
      const view = f.service.room.view(f.service.hostToken);
      expect(view.game).toBeNull();
      expect(view.paused).toBe(true);
      expect(f.service.room.missingRelease).toBe('legacy');
      const untouched = loadSave(f.config.dataDir);
      expect(untouched.releaseRef).toBeUndefined();
      expect(untouched.manifest).toEqual(f.saved.manifest);
      expect(untouched.snapshot).toEqual(f.saved.snapshot);
      expect(untouched.seats).toEqual(f.saved.seats);
    } finally {
      await f.service.close();
      rmSync(f.root, { recursive: true, force: true });
    }
  },
  30000,
);
