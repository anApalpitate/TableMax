import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';

export const MAXIMUM_INSTALLER_BYTES = 50_000_000;

export function assertInstallerSize(bytes) {
  assert.ok(
    Number.isSafeInteger(bytes) &&
      bytes > 0 &&
      bytes <= MAXIMUM_INSTALLER_BYTES,
    'Complete installer must be at most 50,000,000 bytes: ' + bytes,
  );
}

// Legacy portable ZIP/EXE thresholds and existing internal safety bounds.
export const MAXIMUM_PACKAGE_BYTES = 120_000_000;
export const PACKAGE_BUDGET_BYTES = 110_000_000;
export const MAXIMUM_GAME_BYTES = 64_000_000;
export const GAME_BUDGET_BYTES = 48_000_000;
