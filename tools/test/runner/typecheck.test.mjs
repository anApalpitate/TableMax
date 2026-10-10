import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { compilerRealpath } from './typecheck.mjs';
import { workspaceRoot } from '../../shared/workspace-root.mjs';

test('readable junctions fall back after a native access error', () => {
  const resolver = (path) => `${path}/real`;
  resolver.native = () => {
    throw Object.assign(new Error('restricted native lookup'), {
      code: 'EPERM',
    });
  };
  assert.equal(compilerRealpath('linked', resolver), 'linked/real');
  resolver.native = () => 'native';
  assert.equal(compilerRealpath('linked', resolver), 'native');
});

test('unreadable paths retain the compiler missing-file behavior', () => {
  const resolver = () => {
    throw new Error('missing');
  };
  resolver.native = resolver;
  assert.equal(compilerRealpath('missing', resolver), 'missing');
});

test('the compiler resolves Vitest declarations and still rejects real errors', () => {
  mkdirSync(join(workspaceRoot, 'tmp'), { recursive: true });
  const directory = mkdtempSync(join(workspaceRoot, 'tmp/typecheck-'));
  const config = join(directory, 'tsconfig.json');
  const input = join(directory, 'fixture.ts');
  writeFileSync(
    config,
    JSON.stringify({
      extends: '../../tsconfig.json',
      compilerOptions: { noUnusedLocals: false },
      include: ['fixture.ts'],
    }),
  );
  const run = () =>
    spawnSync(
      process.execPath,
      [
        'tools/test/runner/typecheck.mjs',
        '--project',
        config,
        '--noEmit',
        '--pretty',
        'false',
      ],
      { cwd: workspaceRoot, encoding: 'utf8' },
    );
  try {
    writeFileSync(
      input,
      "import { expect } from 'vitest'; expect(1).not.toBe(2);",
    );
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    writeFileSync(input, 'export const value: number = "wrong";');
    const invalid = run();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout, /TS2322/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
