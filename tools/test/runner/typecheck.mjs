import { realpathSync } from 'node:fs';
import ts from 'typescript';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';

// TypeScript's native realpath can fail on readable Windows pnpm junctions.
// Resolve with Node's ordinary implementation before retaining a missing path.
export function compilerRealpath(path, resolvePath = realpathSync) {
  try {
    return resolvePath.native(path);
  } catch {
    try {
      return resolvePath(path);
    } catch {
      return path;
    }
  }
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  ts.sys.setBlocking?.();
  // Use the locked compiler's own CLI for flags, diagnostics and exit codes.
  ts.executeCommandLine(
    { ...ts.sys, realpath: compilerRealpath },
    () => {},
    process.argv.slice(2),
  );
}
