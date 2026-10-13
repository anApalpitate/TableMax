import { realpathSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
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

export function compilerArguments(root, args) {
  const cacheFlags = args.filter(
    (arg) =>
      arg === '--incremental-cache' || arg.startsWith('--incremental-cache='),
  );
  if (!cacheFlags.length) return args;
  if (
    cacheFlags.length !== 1 ||
    args.some((arg) =>
      /^--(?:incremental|tsBuildInfoFile)(?:=|$)/i.test(arg),
    ) ||
    args.includes('--build') ||
    args.includes('-b')
  )
    throw new Error(
      'Incremental cache cannot duplicate compiler incremental/build options',
    );
  const compilerArgs = args.filter((arg) => !cacheFlags.includes(arg));
  const directory = resolve(
    root,
    cacheFlags[0] === '--incremental-cache'
      ? '.cache/typecheck'
      : cacheFlags[0].slice('--incremental-cache='.length),
  );
  const name = relative(root, directory);
  if (
    !name ||
    name === '..' ||
    name.startsWith('../') ||
    name.startsWith('..\\') ||
    isAbsolute(name)
  )
    throw new Error('Typecheck cache must stay inside the workspace');
  for (let cursor = directory; cursor !== root; cursor = dirname(cursor))
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink())
      throw new Error('Linked typecheck cache rejected');
  mkdirSync(directory, { recursive: true });
  const key = createHash('sha256')
    .update(JSON.stringify({ compiler: ts.version, args: compilerArgs, root }))
    .digest('hex');
  const cacheFile = resolve(directory, key + '.tsbuildinfo');
  if (
    existsSync(cacheFile) &&
    (!lstatSync(cacheFile).isFile() || lstatSync(cacheFile).isSymbolicLink())
  )
    throw new Error('Unsafe typecheck cache file');
  return [...compilerArgs, '--incremental', '--tsBuildInfoFile', cacheFile];
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  ts.sys.setBlocking?.();
  const originalArgs = process.argv.slice(2);
  // Use the locked compiler's own CLI for flags, diagnostics and exit codes.
  ts.executeCommandLine(
    { ...ts.sys, realpath: compilerRealpath },
    () => {},
    compilerArguments(process.cwd(), originalArgs),
  );
}
