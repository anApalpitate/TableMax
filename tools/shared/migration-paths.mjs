import { readFileSync } from 'node:fs';

export const migrationPaths = Object.freeze(
  JSON.parse(
    readFileSync(new URL('./migration-paths.json', import.meta.url), 'utf8'),
  ),
);
const previousPaths = new Map();
for (const [oldPath, newPath] of Object.entries(migrationPaths)) {
  if (!previousPaths.has(newPath)) previousPaths.set(newPath, oldPath);
}
export function historyPath(file) {
  const normalized = file.replaceAll('\\', '/');
  return previousPaths.get(normalized) ?? normalized;
}
export function executionPath(file) {
  const normalized = file.replaceAll('\\', '/');
  return migrationPaths[normalized] ?? normalized;
}
