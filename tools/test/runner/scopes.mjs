import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { readdirSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export const gameIds = [
  'pokemon-encounters',
  'modern-art',
  'power-grid',
  'rummikub',
  'uno',
  'avalon',
  'manila',
  'cockroach-poker',
  'cockroach-salad',
];
const gameScopes = gameIds.map((id) => `game:${id}`);
const validScopes = ['box', 'shared', 'tooling', ...gameScopes];

// Classify what a test actually exercises, rather than its containing app.
const unitScopes = {
  'apps/server/src/cockroach-games.test.ts': [
    'game:cockroach-poker',
    'game:cockroach-salad',
  ],
  'apps/server/src/cockroach-worker.test.ts': [
    'game:cockroach-poker',
    'game:cockroach-salad',
  ],
  'packages/platform-core/src/automatic-timing.test.ts': ['shared'],
  'apps/server/src/game-packages/development.test.ts': [
    'shared',
    'game:manila',
  ],
  'apps/server/src/manila.test.ts': ['game:manila'],
  'apps/server/src/manila-worker.test.ts': ['game:manila'],
  'apps/server/src/events-integration.test.ts': ['game:pokemon-encounters'],
  'apps/server/src/game-packages/catalog.test.ts': ['box', 'shared', 'tooling'],
  'apps/server/src/registry-versions.test.ts': ['shared', 'tooling'],
  'apps/server/src/game-packages/public.test.ts': ['box', 'shared', 'tooling'],
  'apps/server/src/game-packages/legacy-save.test.ts': [
    'shared',
    'tooling',
    'game:uno',
  ],
  'apps/server/src/game-packages/store.test.ts': ['shared', 'tooling'],
  'apps/server/src/game-packages/preinstalled.test.ts': [
    'box',
    'shared',
    'tooling',
  ],
  'apps/server/src/game-packages/service-integration.test.ts': [
    'box',
    'shared',
    'tooling',
  ],
  'packages/platform-core/src/release-pinning.test.ts': ['shared'],
  'packages/web-host/src/resource-url.test.ts': ['shared', 'tooling'],
  'apps/web/src/components/game-library/filter.test.ts': ['box'],
  'apps/web/src/content/feedback.test.ts': ['box', 'shared'],
  'apps/web/src/components/notifications/notification-center.test.ts': ['box'],
  'apps/desktop/src/audio-controller.test.ts': ['shared'],
  'apps/desktop/src/display-controller.test.ts': ['shared'],
  'apps/desktop/src/runtime-guard.test.ts': ['shared'],
  'apps/web/src/components/player-frame.test.ts': ['shared'],
  'apps/web/src/components/WindowModeSettings.test.ts': ['shared'],
  'packages/web-host/src/preferences/sound-preference.test.ts': ['shared'],
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
  'apps/server/src/database-lock.test.ts': ['shared'],
  'apps/server/src/debug-connections.test.ts': ['box'],
  'apps/server/src/entry.test.ts': ['shared', 'game:pokemon-encounters'],
  'apps/server/src/desktop-update-pipe.test.ts': ['shared'],
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
  'apps/server/src/service-shutdown.test.ts': ['shared'],
  'apps/server/src/room-projections.test.ts': ['shared'],
  'apps/server/src/room-sync.test.ts': ['shared'],
  'apps/server/src/sync-diagnostics.test.ts': ['shared'],
  'packages/platform-core/src/admission.test.ts': ['box'],
  'apps/web/src/components/external-entry.test.ts': ['box'],
  'packages/protocol/src/names.test.ts': ['box', 'shared'],
  'packages/protocol/src/name-length.test.ts': ['box', 'shared'],
  'packages/platform-core/src/avatar.test.ts': ['box'],
  'packages/platform-core/src/bot-difficulty.test.ts': ['shared'],
  'packages/platform-core/src/countdown.test.ts': [
    'shared',
    'game:pokemon-encounters',
    'game:modern-art',
  ],
  'packages/platform-core/src/game-variants.test.ts': ['box'],
  'packages/platform-core/src/game-setup-timing.test.ts': ['shared'],
  'packages/platform-core/src/game-setup-recovery.test.ts': [
    'shared',
    'game:uno',
  ],
  'packages/platform-core/src/modern-art-auction.test.ts': ['game:modern-art'],
  'packages/platform-core/src/play-mode.test.ts': ['shared'],
  'packages/platform-core/src/room-evolution.test.ts': [
    'shared',
    'game:pokemon-encounters',
  ],
  'packages/platform-core/src/room.test.ts': ['shared'],
  'packages/platform-core/src/room-shutdown.test.ts': ['shared'],
  'packages/platform-core/src/game-action-contract.test.ts': ['shared'],
  'packages/platform-core/src/room-status.test.ts': ['shared'],
  'packages/platform-core/src/session-receipts.test.ts': ['box'],
  'packages/platform-core/src/transfer.test.ts': ['box'],
};

// Unregistered scripts may only run with an explicitly chosen full scope.
// Mixed matrices cannot be narrowed by adding an option they do not implement.
const verificationScopes = {
  'tools/test/games/cockroach/verify-cockroach-installed.mjs': [
    'game:cockroach-poker',
    'game:cockroach-salad',
  ],
  'tools/test/games/cockroach/verify-cockroach-source.mjs': [
    'game:cockroach-poker',
    'game:cockroach-salad',
  ],
  'tools/shared/application-version.test.mjs': ['tooling'],
  'tools/release/installer-retention.test.mjs': ['tooling'],
  'tools/release/published-release-replacement.test.mjs': ['tooling'],
  'tools/dev/session.test.mjs': ['tooling'],
  'tools/dev/verify-session.mjs': ['tooling'],
  'tools/shared/windows-executable-security.test.mjs': ['tooling'],
  'tools/test/platform/verify-save-overlay.mjs': [
    'box',
    'shared',
    ...gameScopes,
  ],
  'tools/release/installation-evidence.test.mjs': ['tooling'],
  'tools/test/installation/verify-update-activation.mjs': ['shared', 'tooling'],
  'tools/test/installation/verify-update-activation.cs': ['shared', 'tooling'],
  'tools/test/installation/verify-resource-cleanup.mjs': ['shared', 'tooling'],
  'tools/test/installation/resource-cleanup-harness.cs': ['shared', 'tooling'],
  'tools/release/delivery-paths.test.mjs': ['tooling'],
  'tools/test/installation/finalize-evidence.test.mjs': ['tooling'],
  'tools/test/installation/verify-production-user.test.mjs': ['tooling'],
  'tools/test/installation/finalize-evidence.mjs': ['tooling'],
  'tools/test/installation/prepare/handoff-fixture.test.mjs': ['tooling'],
  'tools/test/installation/prepare/transaction-fixture.test.mjs': ['tooling'],
  'tools/test/installation/scenarios/framework-recovery.test.mjs': ['tooling'],
  'tools/test/installation/scenarios/update-transaction.test.mjs': ['tooling'],
  'tools/shared/application-update.test.mjs': ['tooling', 'shared'],
  'tools/shared/windows-acceptance-profile.test.mjs': ['tooling'],
  'tools/release/installation-package.test.mjs': ['tooling'],
  'tools/release/installation-promote.test.mjs': ['tooling'],
  'tools/release/installation-publication.test.mjs': ['tooling'],
  'tools/release/installation-verifier.test.mjs': ['tooling'],
  'tools/release/prepare-internal-games.test.mjs': ['tooling'],
  'tools/release/installation-verifier.mjs': ['box', 'shared', 'tooling'],
  'tools/test/installation/native-confirm-harness.cs': ['shared', 'tooling'],
  'tools/test/installation/native-confirm-harness.mjs': ['shared', 'tooling'],
  'tools/test/installation/native-launch-harness.cs': ['shared', 'tooling'],
  'tools/test/installation/native-launch-harness.mjs': ['shared', 'tooling'],
  'tools/test/installation/verify-installer-wizard.cs': ['shared', 'tooling'],
  'tools/test/installation/verify-installer-wizard.mjs': ['shared', 'tooling'],
  'tools/test/installation/native-update-harness.mjs': ['shared', 'tooling'],
  'tools/test/installation/fixture-application-update.test.mjs': [
    'shared',
    'tooling',
  ],
  'tools/test/support/fixture-application-update.mjs': ['shared', 'tooling'],
  'tools/test/installation/native-long-path-harness.mjs': ['shared', 'tooling'],
  'tools/test/installation/native-migration-lease-harness.mjs': [
    'shared',
    'tooling',
  ],
  'tools/test/installation/native-recovery-harness.mjs': ['shared', 'tooling'],
  'tools/test/installation/verify-application-handoff.mjs': [
    'box',
    'shared',
    'tooling',
  ],
  'tools/test/installation/verify-installed-legacy-save.mjs': [
    'box',
    'shared',
    'tooling',
    'game:pokemon-encounters',
  ],
  'tools/test/installation/verify-update-ui.mjs': ['box', 'shared', 'tooling'],
  'tools/test/installation/verify-save-barrier.mjs': [
    'box',
    'shared',
    'tooling',
  ],
  'tools/test/installation/verify-update-transaction.mjs': [
    'shared',
    'tooling',
  ],
  'tools/test/installation/verify-production-user.ps1': [
    'box',
    'shared',
    'tooling',
  ],
  'tools/test/installation/verify-portable-migration.mjs': [
    'box',
    'shared',
    'tooling',
  ],
  'tools/test/runner/evidence.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: true },
  },
  'tools/test/runner/plan.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: true },
  },
  'tools/maintenance/cache-plan.test.mjs': ['tooling'],
  'tools/maintenance/current-delivery.test.mjs': ['tooling'],
  'tools/maintenance/current-delivery.test.ps1': ['tooling'],
  'tools/test/platform/verify-download-loopback.mjs': ['tooling', 'shared'],
  'tools/test/desktop/verify-delivery-session.mjs': [
    'tooling',
    'box',
    'shared',
  ],
  'tools/release/verify-windows-editions.mjs': ['box', 'shared', 'tooling'],
  'tools/test/platform/verify-game-introduction.mjs': ['box'],
  'packages/game-sdk/src/metadata.test.mjs': ['box', 'shared', 'tooling'],
  'tools/build/lean-catalog.test.mjs': ['box', 'shared', 'tooling'],
  'tools/build/introduction-resources.test.mjs': ['box', 'shared', 'tooling'],
  'tools/test/platform/verify-package-crash.mjs': ['shared', 'tooling'],
  'tools/test/platform/verify-legacy-game-migration.mjs': [
    'box',
    'shared',
    'tooling',
    'game:uno',
  ],
  'tools/author/verify-author-platform.mjs': ['box', 'shared', 'tooling'],
  'tools/test/platform/verify-package-library.mjs': [
    'box',
    'shared',
    'tooling',
  ],
  'tools/test/platform/verify-installed-games.mjs': [
    'box',
    'shared',
    'tooling',
    ...gameScopes,
  ],
  'tools/test/platform/verify-settings-and-save-layout.mjs': [
    'box',
    'shared',
    ...gameScopes,
  ],
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
  'tools/maintenance/image-copies.test.ps1': ['tooling'],
  'tools/maintenance/project-maintenance.test.ps1': ['tooling'],
  'tools/maintenance/retired-generated.test.ps1': ['tooling'],
  'tools/maintenance/reviewed-files.test.ps1': ['tooling'],
  'tools/maintenance/verify-preserved-tar.test.mjs': ['tooling'],
  'tools/maintenance/verify-cleanup-fast.ps1': ['tooling'],
  'tools/maintenance/verify-cleanup-idle.ps1': ['tooling'],
  'tools/test/games/avalon/verify-avalon.mjs': ['game:avalon'],
  'tools/test/games/avalon/verify-host-layout.mjs': ['game:avalon'],
  'tools/test/games/manila/verify-manila.mjs': ['game:manila'],
  'tools/test/games/manila/verify-manila-design.mjs': ['game:manila'],
  'tools/test/games/manila/verify-manila-touch.mjs': ['game:manila'],
  'tools/test/games/manila/verify-manila-harbor.mjs': ['game:manila'],
  'tools/test/games/avalon/verify-configured-delivery.mjs': [
    'game:avalon',
    'box',
    'shared',
    'tooling',
  ],
  'tools/test/games/avalon/verify-avalon-compat.mjs': ['game:avalon'],
  'tools/test/games/modern-art/verify-modern-art-empty-gallery.mjs': [
    'game:modern-art',
  ],
  'tools/test/box/verify-game-library.mjs': ['box'],
  'tools/test/box/verify-box-repository.mjs': ['box'],
  'tools/test/box/verify-box-seats.mjs': ['box'],
  'tools/test/box/verify-box-notifications.mjs': ['box'],
  'tools/test/platform/verify-speech-panel.mjs': ['box', 'shared'],
  'tools/test/platform/verify-player-interaction-audio.mjs': ['box', 'shared'],
  'tools/release/verify-shipping-executable.mjs': ['box', 'shared'],
  'tools/build/build-idle.test.mjs': ['tooling'],
  'tools/maintenance/maintenance.test.mjs': ['tooling'],
  'tools/maintenance/screenshot-preview.test.mjs': ['tooling'],
  'tools/test/support/screenshots.test.mjs': ['tooling'],
  'tools/test/support/installation-fixture.test.mjs': ['tooling'],
  'tools/test/desktop/verify-service-stop.mjs': ['shared', 'tooling'],
  'tools/test/desktop/verify-shutdown.mjs': ['box', 'shared', 'tooling'],
  'tools/maintenance/coordinator.test.mjs': ['tooling'],
  'tools/analysis/storage/space-analysis.test.mjs': ['tooling'],
  'tools/shared/migration.test.mjs': ['tooling'],
  'tools/test/runner/scopes.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: false, files: ['tools/test/runner/test-scoped.mjs'] },
  },
  'tools/test/runner/history.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: false },
  },
  'tools/test/runner/typecheck.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: true, files: ['tools/test/runner/typecheck.mjs'] },
  },
  'tools/test/runner/presets.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: true },
  },
  'tools/test/runner/round.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: true },
  },
  'tools/maintenance/read-doc.test.mjs': {
    scopes: ['tooling'],
    preset: {
      complete: false,
      files: [
        'tools/maintenance/read-doc.mjs',
        'tools/maintenance/markdown-source.mjs',
      ],
    },
  },
  'tools/maintenance/audit-efficiency-docs.mjs': ['tooling'],
  'tools/maintenance/verify-documentation-skills.mjs': ['tooling'],
  'tools/maintenance/audit-efficiency-docs.test.mjs': {
    scopes: ['tooling'],
    preset: {
      complete: false,
      files: [
        'tools/maintenance/audit-efficiency-docs.mjs',
        'tools/maintenance/markdown-source.mjs',
      ],
    },
  },
  'tools/maintenance/find-doc.test.mjs': {
    scopes: ['tooling'],
    preset: {
      complete: false,
      files: [
        'tools/maintenance/find-doc.mjs',
        'tools/maintenance/markdown-source.mjs',
      ],
    },
  },
  'tools/test/runner/log-output.test.mjs': {
    scopes: ['tooling'],
    preset: { complete: true },
  },
  'tools/test/runner/benchmark-efficiency.mjs': ['tooling'],
  'tools/test/box/verify-box-layout.mjs': ['box'],
  'tools/test/desktop/verify-fullscreen.mjs': [
    'box',
    'shared',
    'game:modern-art',
  ],
  'tools/test/desktop/verify-f11.mjs': ['box', 'shared', 'tooling'],
  'tools/release/verify-pages.mjs': ['shared', 'tooling'],
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
  'tools/test/games/uno/verify-uno-source.mjs': ['box', 'shared', 'game:uno'],
  'tools/test/games/pokemon-encounters/verify-pokemon-expansion.mjs': [
    'game:pokemon-encounters',
  ],
  'tools/test/games/pokemon-encounters/verify-pokemon-expansion-effects.mjs': [
    'game:pokemon-encounters',
  ],
  'tools/test/games/pokemon-encounters/verify-pokemon-expansion-awards.mjs': [
    'game:pokemon-encounters',
  ],
  'tools/test/games/pokemon-encounters/verify-pokemon-expansion-play.mjs': [
    'game:pokemon-encounters',
  ],
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
  if (normalized === 'games/avalon/bot/timing.test.ts')
    return ['game:avalon', 'shared'];
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
  if (script === 'tools/test/platform/verify-installed-games.mjs') {
    const only = item.args.filter((arg) => arg.startsWith('--only='));
    if (
      only.length === 1 &&
      only[0]
        .slice(7)
        .split(',')
        .every((value) => gameIds.includes(value.split(':')[0]))
    )
      return [
        'box',
        'shared',
        'tooling',
        ...new Set(
          only[0]
            .slice(7)
            .split(',')
            .map((value) => `game:${value.split(':')[0]}`),
        ),
      ];
    if (only.length) throw new Error('Invalid installed-game selection');
  }
  if (
    script === 'tools/test/games/rummikub/verify-rummikub-ui.mjs' &&
    item.args.includes('--entry-only')
  )
    return ['box', 'game:rummikub'];
  if (
    script === 'tools/test/platform/verify-connection-entry.mjs' &&
    item.args.includes('--box-only')
  )
    return ['box'];
  if (
    script === 'tools/test/platform/verify-root-entry.mjs' &&
    item.args.includes('--connection-only')
  )
    return ['box', 'shared'];
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
  const registration = verificationScopes[script];
  return registration?.scopes ?? registration;
}

// Preset metadata shares the existing scope authority. Product verifiers with
// package/device arguments remain explicit plans, never guessed invocations.
export function checkCategories(file) {
  const normalized = file.replaceAll('\\', '/');
  if (normalized.startsWith('tools/')) return ['tooling'];
  const resources =
    /(?:resource-url|sound-player|audio-(?:player|controller)|card-catalog|voice-resources|avatar(?:-upload)?\.test)/.test(
      normalized,
    );
  const ui =
    /(?:\/ui\/|\/web\/|^apps\/web\/|^apps\/desktop\/.*(?:audio|display))/.test(
      normalized,
    );
  return [...(ui ? ['ui'] : ['rules']), ...(resources ? ['resources'] : [])];
}

export function presetCandidates(root) {
  const units = selectUnitTests(root, 'full').selected.map((script) => ({
    id: 'preset/' + script,
    runtime: 'vitest',
    script,
    args: [],
    scopes: unitTestScopes(script),
    categories: checkCategories(script),
    inputs: { complete: false },
  }));
  const checks = Object.entries(verificationScopes)
    .filter(
      ([script, registration]) =>
        registration.preset && existsSync(resolve(root, script)),
    )
    .map(([script, registration]) => ({
      id: 'preset/' + script,
      runtime: 'node',
      script,
      nodeArgs: ['--test'],
      args: [],
      scopes: registration.scopes,
      categories: checkCategories(script),
      inputs: registration.preset,
    }));
  return [...units, ...checks].sort((a, b) => a.script.localeCompare(b.script));
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
