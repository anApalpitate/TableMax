import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export const gameIds = [
  'pokemon-encounters',
  'modern-art',
  'power-grid',
  'rummikub',
  'uno',
  'avalon',
];
const gameScopes = gameIds.map((id) => `game:${id}`);
const validScopes = ['box', 'shared', 'tooling', ...gameScopes];

// Classify what a test actually exercises, rather than its containing app.
const unitScopes = {
  'apps/web/src/components/game-library/filter.test.ts': ['box'],
  'apps/web/src/content/feedback.test.ts': ['box', 'shared'],
  'apps/web/src/components/notifications/notification-center.test.ts': ['box'],
  'apps/desktop/src/audio-controller.test.ts': ['shared'],
  'apps/desktop/src/display-controller.test.ts': ['shared'],
  'apps/desktop/src/runtime-guard.test.ts': ['shared'],
  'apps/web/src/components/player-frame.test.ts': ['shared'],
  'apps/web/src/game-clients/styles.test.ts': ['shared'],
  'apps/web/src/interactions/model.test.ts': ['shared'],
  'apps/web/src/interactions/audio-player.test.ts': ['shared'],
  'apps/web/src/interactions/playback-controller.test.ts': ['shared'],
  'apps/web/src/interactions/shot-slots.test.ts': ['shared'],
  'apps/web/src/interactions/diagnostics.test.ts': ['shared'],
  'apps/web/src/session/admissionRecovery.test.ts': ['box'],
  'apps/web/src/session/presentation.test.ts': ['shared'],
  'apps/web/src/session/randomId.test.ts': ['shared'],
  'apps/web/src/session/reliableRoomSync.test.ts': ['shared'],
  'apps/web/src/session/interactionInbox.test.ts': ['shared'],
  'apps/server/src/avatar-upload.test.ts': ['box'],
  'apps/server/src/avatar.test.ts': ['box'],
  'apps/server/src/bot-executor.test.ts': ['shared'],
  'apps/server/src/countdown.test.ts': ['shared'],
  'apps/server/src/crash.test.ts': ['shared'],
  'apps/server/src/database.test.ts': ['shared'],
  'apps/server/src/debug-connections.test.ts': ['box'],
  'apps/server/src/entry.test.ts': ['shared', 'game:pokemon-encounters'],
  'apps/server/src/expansion-integration.test.ts': ['game:pokemon-encounters'],
  'apps/server/src/game-registry.test.ts': ['shared', ...gameScopes],
  'apps/server/src/interaction-service.test.ts': ['shared'],
  'apps/server/src/interactions.test.ts': ['shared'],
  'apps/server/src/modern-art-open.test.ts': ['game:modern-art'],
  'apps/server/src/modern-art.test.ts': ['game:modern-art'],
  'apps/server/src/network-directory.test.ts': ['box'],
  'apps/server/src/network-settings.test.ts': ['box'],
  'apps/server/src/platform.test.ts': ['shared', 'game:pokemon-encounters'],
  'apps/server/src/pokemon-crash.test.ts': ['game:pokemon-encounters'],
  'apps/server/src/power-grid-concurrency.test.ts': ['game:power-grid'],
  'apps/server/src/power-grid.test.ts': ['game:power-grid'],
  'apps/server/src/rummikub.test.ts': ['game:rummikub'],
  'apps/server/src/rummikub-worker.test.ts': ['game:rummikub'],
  'apps/server/src/uno.test.ts': ['game:uno'],
  'apps/server/src/uno-worker.test.ts': ['game:uno'],
  'apps/server/src/avalon.test.ts': ['game:avalon'],
  'apps/server/src/avalon-worker.test.ts': ['game:avalon'],
  'apps/server/src/save-storage-games.test.ts': [
    'game:pokemon-encounters',
    'game:modern-art',
    'game:power-grid',
  ],
  'apps/server/src/save-storage-gc.test.ts': ['shared'],
  'apps/server/src/save-storage.test.ts': ['shared'],
  'apps/server/src/service.test.ts': ['shared'],
  'apps/server/src/room-projections.test.ts': ['shared'],
  'apps/server/src/room-sync.test.ts': ['shared'],
  'apps/server/src/sync-diagnostics.test.ts': ['shared'],
  'packages/platform-core/src/admission.test.ts': ['box'],
  'packages/platform-core/src/avatar.test.ts': ['box'],
  'packages/platform-core/src/bot-difficulty.test.ts': ['shared'],
  'packages/platform-core/src/countdown.test.ts': [
    'shared',
    'game:pokemon-encounters',
    'game:modern-art',
  ],
  'packages/platform-core/src/game-variants.test.ts': ['box'],
  'packages/platform-core/src/modern-art-auction.test.ts': ['game:modern-art'],
  'packages/platform-core/src/play-mode.test.ts': ['shared'],
  'packages/platform-core/src/room-evolution.test.ts': [
    'shared',
    'game:pokemon-encounters',
  ],
  'packages/platform-core/src/room.test.ts': ['shared'],
  'packages/platform-core/src/game-action-contract.test.ts': ['shared'],
  'packages/platform-core/src/room-status.test.ts': ['shared'],
  'packages/platform-core/src/session-receipts.test.ts': ['box'],
  'packages/platform-core/src/transfer.test.ts': ['box'],
};

// Unregistered scripts may only run with an explicitly chosen full scope.
// Mixed matrices cannot be narrowed by adding an option they do not implement.
const verificationScopes = {
  'tools/analysis/games/pokemon-encounters/pokemon-expansion-flow-observer.test.mjs':
    ['tooling'],
  'tools/assets/games/pokemon-encounters/soften-pokemon-cries.test.mjs': [
    'tooling',
  ],
  'tools/build/pokemon-bot-brotli.test.mjs': ['tooling'],
  'tools/build/service-brotli.test.mjs': ['tooling'],
  'tools/build/verify-cache-failures.mjs': ['tooling'],
  'tools/build/verify-module-runtime-input.mjs': ['tooling'],
  'tools/maintenance/cleanup-history.test.ps1': ['tooling'],
  'tools/maintenance/cleanup-local.test.ps1': ['tooling'],
  'tools/maintenance/compress-workspace.test.ps1': ['tooling'],
  'tools/maintenance/duplicate-screenshots-cleanup.test.ps1': ['tooling'],
  'tools/maintenance/historical-screenshots.test.ps1': ['tooling'],
  'tools/maintenance/project-maintenance.test.ps1': ['tooling'],
  'tools/maintenance/retired-generated.test.ps1': ['tooling'],
  'tools/maintenance/verify-cleanup-fast.ps1': ['tooling'],
  'tools/maintenance/verify-cleanup-idle.ps1': ['tooling'],
  'tools/test/games/avalon/verify-avalon.mjs': ['game:avalon'],
  'tools/test/box/verify-game-library.mjs': ['box'],
  'tools/test/box/verify-box-repository.mjs': ['box'],
  'tools/test/box/verify-box-seats.mjs': ['box'],
  'tools/test/box/verify-box-notifications.mjs': ['box'],
  'tools/test/platform/verify-speech-panel.mjs': ['box', 'shared'],
  'tools/test/platform/verify-player-interaction-audio.mjs': ['box', 'shared'],
  'tools/release/verify-shipping-executable.mjs': ['box', 'shared'],
  'tools/build/build-idle.test.mjs': ['tooling'],
  'tools/maintenance/maintenance.test.mjs': ['tooling'],
  'tools/maintenance/coordinator.test.mjs': ['tooling'],
  'tools/analysis/storage/space-analysis.test.mjs': ['tooling'],
  'tools/shared/migration.test.mjs': ['tooling'],
  'tools/test/runner/scopes.test.mjs': ['tooling'],
  'tools/test/runner/history.test.mjs': ['tooling'],
  'tools/test/box/verify-box-layout.mjs': ['box'],
  'tools/test/platform/verify-connection-entry.mjs': [
    'box',
    'game:pokemon-encounters',
  ],
  'tools/test/box/verify-box-avatars.mjs': [
    'box',
    'game:pokemon-encounters',
    'game:modern-art',
  ],
  'tools/test/box/verify-box-debug.mjs': ['box', ...gameScopes],
  'tools/test/platform/verify-interactions.mjs': [
    'box',
    'shared',
    ...gameScopes,
  ],
  'tools/test/platform/verify-modern-art.mjs': [
    'game:modern-art',
    'game:pokemon-encounters',
  ],
  'tools/test/platform/verify-power-grid.mjs': [
    'game:pokemon-encounters',
    'game:modern-art',
    'game:power-grid',
  ],
  'tools/test/games/rummikub/verify-rummikub-ui.mjs': ['game:rummikub'],
  'tools/test/games/rummikub/verify-rummikub-runtime.mjs': ['game:rummikub'],
  'tools/test/games/uno/verify-uno.mjs': ['game:uno'],
};
const gameFilteredVerifiers = new Set([
  'tools/test/desktop/verify-player-display.mjs',
  'tools/test/platform/verify-rules-guides.mjs',
  'tools/test/platform/verify-interactions.mjs',
]);

export function parseScope(value) {
  if (value === 'full') return 'full';
  if (typeof value !== 'string' || !value.length)
    throw new Error(
      'Choose an explicit test scope: box, game:<id>, shared or full',
    );
  const scopes = value.split(',');
  if (
    new Set(scopes).size !== scopes.length ||
    scopes.some((scope) => !validScopes.includes(scope))
  )
    throw new Error(`Invalid test scope: ${value}`);
  return scopes;
}

export function allowsScope(allowed, required) {
  return (
    allowed === 'full' ||
    (required !== undefined &&
      required.every((scope) => allowed.includes(scope)))
  );
}

export function unitTestScopes(file) {
  const normalized = file.replaceAll('\\', '/');
  const game = normalized.match(/^games\/([^/]+)\/.+\.test\.ts$/)?.[1];
  if (gameIds.includes(game)) return [`game:${game}`];
  return unitScopes[normalized];
}

function unitFiles(root, directory) {
  const results = [];
  for (const entry of readdirSync(resolve(root, directory), {
    withFileTypes: true,
  })) {
    const file = `${directory}/${entry.name}`;
    if (
      entry.isDirectory() &&
      !['node_modules', 'dist', 'build', 'bin', 'obj'].includes(entry.name)
    )
      results.push(...unitFiles(root, file));
    else if (entry.isFile() && file.endsWith('.test.ts')) results.push(file);
  }
  return results;
}

export function selectUnitTests(root, value, filters = []) {
  const allowed = parseScope(value);
  const files = ['apps', 'packages', 'games']
    .flatMap((directory) => unitFiles(root, directory))
    .sort();
  const normalizedFilters = filters.map((file) =>
    relative(root, resolve(root, file)).replaceAll('\\', '/'),
  );
  for (const filter of normalizedFilters) {
    if (!files.includes(filter))
      throw new Error(`Use an exact existing test file: ${filter}`);
    if (!allowsScope(allowed, unitTestScopes(filter)))
      throw new Error(`Test is outside the selected scope: ${filter}`);
  }
  const selected = files.filter(
    (file) =>
      allowsScope(allowed, unitTestScopes(file)) &&
      (!filters.length || normalizedFilters.includes(file)),
  );
  return {
    scope: value,
    selected,
    excluded: files.filter((file) => !selected.includes(file)),
    unclassified: files.filter((file) => !unitTestScopes(file)),
  };
}

// Direct Vitest commands remain usable with exact files. Broad runs require a
// scope, so an omitted filter cannot silently start all games.
export function scopedVitestIncludes(root, value, args = []) {
  const filters = args.filter(
    (arg) => arg.endsWith('.test.ts') && !arg.startsWith('-'),
  );
  if (value) return selectUnitTests(root, value, filters).selected;
  if (!filters.length) parseScope(value);
  for (const file of filters)
    if (
      !unitTestScopes(relative(root, resolve(root, file)).replaceAll('\\', '/'))
    )
      throw new Error(`Unclassified test file: ${file}`);
  return selectUnitTests(root, 'full', filters).selected;
}

export function verificationTestScopes(item) {
  const script = item.script.replaceAll('\\', '/');
  if (
    script === 'tools/test/platform/verify-connection-entry.mjs' &&
    item.args.includes('--box-only')
  )
    return ['box'];
  const selectors = item.args.filter(
    (arg) => arg === '--game' || arg.startsWith('--game='),
  );
  if (
    script === 'tools/test/platform/verify-interactions.mjs' &&
    item.args.includes('--menus-only')
  ) {
    if (
      item.args.includes('--box-only') ||
      item.args.includes('--shot-visuals')
    )
      throw new Error(
        'Interaction menu/visual/box filters are mutually exclusive',
      );
    if (
      selectors.length > 1 ||
      (selectors.length && !gameIds.includes(selectors[0].slice(7)))
    )
      throw new Error('Invalid/duplicate --game option');
    return [
      'shared',
      ...(selectors.length ? [`game:${selectors[0].slice(7)}`] : gameScopes),
    ];
  }
  if (
    script === 'tools/test/platform/verify-interactions.mjs' &&
    item.args.includes('--shot-visuals')
  ) {
    if (selectors.length || item.args.includes('--box-only'))
      throw new Error(
        'Interaction visual/box/game filters are mutually exclusive',
      );
    return ['box', 'shared'];
  }
  if (
    script === 'tools/test/platform/verify-interactions.mjs' &&
    item.args.includes('--box-only')
  ) {
    if (selectors.length)
      throw new Error('Interaction box/game filters are mutually exclusive');
    return ['box', 'shared'];
  }
  if (selectors.length && !gameFilteredVerifiers.has(script))
    throw new Error(`This verifier has no registered game filter: ${script}`);
  if (gameFilteredVerifiers.has(script)) {
    if (selectors.length > 1)
      throw new Error(`Invalid/duplicate --game option: ${script}`);
    if (
      [
        'tools/test/desktop/verify-player-display.mjs',
        'tools/test/platform/verify-interactions.mjs',
      ].includes(script) &&
      selectors[0] === '--game=all'
    )
      throw new Error(
        `${script} does not support --game=all; omit the game option for its full matrix`,
      );
    if (
      selectors.length &&
      selectors[0] !== '--game=all' &&
      !gameIds.includes(selectors[0].slice(7))
    )
      throw new Error(`Invalid/duplicate --game option: ${script}`);
    const games =
      !selectors.length || selectors[0] === '--game=all'
        ? [...gameScopes]
        : [`game:${selectors[0].slice(7)}`];
    if (
      script === 'tools/test/platform/verify-interactions.mjs' &&
      !selectors.length
    )
      return ['box', 'shared', ...games];
    if (
      script === 'tools/test/desktop/verify-player-display.mjs' &&
      !item.args.includes('--visual-audit')
    )
      return [
        'box',
        ...(item.args.includes('--quick') ? [] : ['shared']),
        ...games,
      ];
    return games;
  }
  return verificationScopes[script];
}

export function validateBatchScope(plan, value) {
  const allowed = parseScope(value);
  if (plan.version !== 1 || !Array.isArray(plan.tests) || !plan.tests.length)
    throw new Error('A version 1 plan requires explicit tests');
  for (const item of plan.tests) {
    if (
      typeof item.script !== 'string' ||
      !Array.isArray(item.args) ||
      item.args.some((arg) => typeof arg !== 'string')
    )
      throw new Error('Invalid verification script or arguments');
    if (!allowsScope(allowed, verificationTestScopes(item)))
      throw new Error(
        `Verification is outside the selected scope or unregistered: ${item.script}`,
      );
  }
  return { ...plan, scope: value };
}
