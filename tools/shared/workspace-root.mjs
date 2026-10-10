import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const canonical = (path) => {
  const value = realpathSync(path);
  return process.platform === 'win32' ? value.toLowerCase() : value;
};

export function isDirectExecution(url) {
  return (
    Boolean(process.argv[1]) &&
    canonical(resolve(process.argv[1])) === canonical(fileURLToPath(url))
  );
}

export function assertWorkspaceRoot() {
  const project = JSON.parse(
    readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'),
  );
  if (
    project.name !== 'tablemax' ||
    canonical(process.cwd()) !== canonical(workspaceRoot)
  ) {
    throw new Error(
      `Run this tool from the TableMax repository root: ${workspaceRoot}`,
    );
  }
  return workspaceRoot;
}
