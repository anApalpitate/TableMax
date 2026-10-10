import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

// Decimal bytes; ZIP and actual unpacked runtime must both be below this cap.
export const MAXIMUM_PACKAGE_BYTES = 120_000_000;
export const PACKAGE_BUDGET_BYTES = 114_000_000;
