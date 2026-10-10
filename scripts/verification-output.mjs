import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scheduleMaintenance } from '../tools/maintenance/lifecycle.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));

// Keep release evidence separate when the application version changes.
export function verificationOutput(...parts) {
  scheduleMaintenance();
  return resolve('artifacts/maintenance', `v${version}`, ...parts);
}
