import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

// Decimal bytes; ZIP and actual unpacked runtime must both be below this cap.
export const MAXIMUM_PACKAGE_BYTES = 120_000_000;
export const PACKAGE_BUDGET_BYTES = 110_000_000;
export const MAXIMUM_GAME_BYTES = 64_000_000;
export const GAME_BUDGET_BYTES = 48_000_000;
