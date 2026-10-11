import { it, expect } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  cpSync,
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
import {
  projectGameDetails,
  projectGameRuntime,
} from '@tablemax/game-sdk/metadata';
import { PackageStore } from './store';
import { publicReleaseDetails } from './public';
import { PROJECT_GAME_PUBLIC_KEY } from './project-public-key';
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
    const oldRules = {
      ...rules,
      manifest: { ...rules.manifest, gameVersion: 'legacy-fixture-1' },
    };
    service = await createService(config, { rules: oldRules, bot });
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
          ...(part === 'rules'
            ? {
                footer: {
                  js: 'module.exports = { ...module.exports, rules: { ...module.exports.rules, manifest: { ...module.exports.rules.manifest, gameVersion: "legacy-fixture-1" } } };',
                },
              }
            : {}),
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
    module.compatibility.gameVersion = 'legacy-fixture-1';
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
    // Current complete payload coexists with the preserved, distinctly versioned old module.
    const pointer = JSON.parse(
      readFileSync('artifacts/package-payloads/v1.0.6/current.json', 'utf8'),
    );
    const payload = join(
      pointer.deliveries.find(
        (item: { edition: string }) => item.edition === 'full',
      ).manifestPath,
      '..',
      'win-unpacked',
      'preinstalled-games',
    );
    cpSync(payload, join(root, 'preinstalled-games'), { recursive: true });
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

it('normalizes separate details during legacy migration and preserves old embedded details', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/legacy-details-'));
  try {
    const sourceModule = JSON.parse(
      readFileSync('games/uno/game-module.json', 'utf8'),
    ) as ModuleManifest;
    const document = projectGameDetails(sourceModule);
    for (const separate of [false, true]) {
      const gamesDir = join(root, separate ? 'new-details' : 'old-inline');
      const snapshot = join(gamesDir, '.legacy', 'a'.repeat(64));
      for (const directory of ['games', 'bots', 'web/games/uno/web'])
        mkdirSync(join(snapshot, directory), { recursive: true });
      const module = separate
        ? projectGameRuntime(sourceModule, {
            details: '/games/uno/web/details.json',
          })
        : structuredClone(sourceModule);
      module.entries = {
        rules: 'games/uno.cjs',
        bot: 'bots/uno.cjs',
        web: '/games/uno/web/entry.js',
      };
      module.styles = [];
      writeFileSync(join(snapshot, 'modules.json'), JSON.stringify([module]));
      writeFileSync(join(snapshot, 'games/uno.cjs'), 'preserved rules bytes');
      writeFileSync(join(snapshot, 'bots/uno.cjs'), 'preserved bot bytes');
      writeFileSync(
        join(snapshot, 'web/games/uno/web/entry.js'),
        'preserved web bytes',
      );
      if (separate)
        writeFileSync(
          join(snapshot, 'web/games/uno/web/details.json'),
          JSON.stringify(document),
        );
      const options = {
        root: gamesDir,
        publicKey: PROJECT_GAME_PUBLIC_KEY,
        protectedReleaseIds: () => [],
      };
      const store = new PackageStore(options);
      const [ref] = store.migrateLegacy(snapshot);
      expect(ref).toBeDefined();
      const installed = store.resolveModule(ref!)!;
      expect(installed.release.module.entries.web).toBe('web/web/entry.js');
      expect(installed.release.module.details).toBe(
        separate ? 'web/web/details.json' : undefined,
      );
      expect(
        readFileSync(
          join(installed.root, installed.release.module.entries.rules),
          'utf8',
        ),
      ).toBe('preserved rules bytes');
      expect(publicReleaseDetails(store, ref!)).toEqual(document);
      const reopened = new PackageStore(options);
      expect(reopened.selected('uno')?.releaseId).toBe(ref);
      expect(publicReleaseDetails(reopened, ref!)).toEqual(document);
      expect(reopened.snapshot().index).toEqual(store.snapshot().index);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
