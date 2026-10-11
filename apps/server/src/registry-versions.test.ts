import { afterEach, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import type { ModuleManifest } from '@tablemax/game-sdk/module-manifest';
import type { GameRelease } from './game-packages/types';
import type { PackageStore } from './game-packages/store';
import { createGameRegistry } from './game-registry';
import type { Save } from '@tablemax/platform-core';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/registry-versions-'));
  roots.push(root);
  const source = JSON.parse(
    readFileSync('games/avalon/game-module.json', 'utf8'),
  ) as ModuleManifest;
  const releases = new Map<string, { release: GameRelease; root: string }>();
  const add = (
    ref: string,
    limit: number,
    actualLimit = limit,
    variantId = 'configured',
  ) => {
    const module = structuredClone(source);
    if (variantId === 'classic') {
      delete module.retiredVariantIds;
      module.defaultVariantId = 'classic';
      module.compatibility.rulesVersion = 'classic-2012-1';
      module.variants = [
        {
          ...module.variants![0]!,
          id: 'classic',
          compatibility: { ...module.compatibility },
        },
      ];
    }
    module.catalog.max = limit;
    module.entries = {
      rules: 'rules.cjs',
      bot: 'bot.cjs',
      web: 'web/entry.js',
    };
    const folder = join(root, ref);
    mkdirSync(folder);
    const manifest = {
      id: 'avalon',
      name: module.catalog.name,
      sdkVersion: 1,
      rulesVersion: module.compatibility.rulesVersion,
      gameVersion: module.compatibility.gameVersion,
      stateVersion: module.compatibility.stateVersion,
      players: { min: module.catalog.min, max: actualLimit },
      assetNamespace: 'avalon',
    };
    const bot = {
      gameId: 'avalon',
      version: module.compatibility.strategyVersion,
      rulesVersion: module.compatibility.rulesVersion,
    };
    writeFileSync(
      join(folder, 'rules.cjs'),
      `const rules={manifest:${JSON.stringify(manifest)}};module.exports={rules,rulesByVariant:{${variantId}:rules}};`,
    );
    writeFileSync(
      join(folder, 'bot.cjs'),
      `const bot=${JSON.stringify(bot)};module.exports={bot,botsByVariant:{${variantId}:bot}};`,
    );
    const release: GameRelease = {
      releaseId: ref,
      gameId: 'avalon',
      variantId,
      module,
      code: ref,
      resources: [],
      resourceMap: {},
      releaseTag: 'v1.0.6',
    };
    releases.set(ref, { release, root: folder });
    return release;
  };
  const old = add('a'.repeat(64), 6, 6, 'classic');
  const current = add('b'.repeat(64), 10);
  const mismatch = add('c'.repeat(64), 10, 6);
  const store = {
    snapshot: () => ({
      catalog: { releases: [current, old] },
      index: {
        releases: { [current.releaseId]: current, [old.releaseId]: old },
      },
    }),
    selected: (_gameId: string, variantId?: string) =>
      variantId === 'configured' ? current : undefined,
    resolveModule: (ref: string) => releases.get(ref),
  } as unknown as PackageStore;
  return { old, current, mismatch, registry: createGameRegistry(false, store) };
}

it('uses current browsing limits while explicit historical refs load their own player limits', async () => {
  const { registry, old, current } = fixture();
  expect(registry.catalog().find((game) => game.id === 'avalon')?.max).toBe(10);
  expect(
    (
      await registry.loadSaved({
        manifest: {
          ...old.module.catalog,
          ...old.module.compatibility,
          players: { min: 5, max: 6 },
        },
        variantId: 'classic',
        releaseRef: old.releaseId,
      } as unknown as Save)
    ).rules.manifest.players.max,
  ).toBe(6);
  expect(
    (await registry.load('avalon', 'configured', current.releaseId)).rules
      .manifest.players.max,
  ).toBe(10);
});

it('rejects compiled limits that disagree with their pinned descriptor', async () => {
  const { registry, mismatch } = fixture();
  await expect(
    registry.load('avalon', 'configured', mismatch.releaseId),
  ).rejects.toThrow('incompatible-game-module');
});
