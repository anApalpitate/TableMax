import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scheduleMaintenance } from '../../maintenance/lifecycle.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));

// Keep release evidence separate when the application version changes.
export function verificationOutput(...parts) {
  scheduleMaintenance();
  return resolve('artifacts/maintenance', `v${version}`, ...parts);
}
