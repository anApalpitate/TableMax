import { existsSync } from 'node:fs';
import {
  validateBatchScope,
  unitTestScopes,
  parseScope,
  allowsScope,
} from './scopes.mjs';
import {
  EvidenceIndex,
  fileRecord,
  fingerprint,
  localFile,
  keyOf,
} from './evidence.mjs';

export function preparePlan(
  root,
  plan,
  changes,
  scope,
  { force = false, index = new EvidenceIndex(root) } = {},
) {
  if (plan.version !== 2 || !Array.isArray(plan.tests) || !plan.tests.length)
    throw new Error('Version 2 requires explicit registered checks');
  const allowed = parseScope(scope);
  if (changes !== undefined) {
    if (changes.version !== 1 || !Array.isArray(changes.files))
      throw new Error('Expected version 1 task-owned change manifest');
    for (const change of changes.files) {
      const path = localFile(root, change.path);
      if (
        change.sha256 === null
          ? existsSync(path)
          : fileRecord(root, change.path).sha256 !== change.sha256
      )
        throw new Error('Task change manifest is stale: ' + change.path);
    }
  }
  const seen = new Map(),
    ids = new Map(),
    tests = [],
    cache = new Map();
  for (const item of plan.tests) {
    if (
      !/^[a-z0-9][a-z0-9/_.-]*$/i.test(item.id) ||
      !['node', 'powershell', 'vitest'].includes(item.runtime) ||
      !Array.isArray(item.args) ||
      item.args.some((value) => typeof value !== 'string')
    )
      throw new Error('Invalid version 2 check');
    if (
      item.nodeArgs &&
      (!Array.isArray(item.nodeArgs) ||
        item.nodeArgs.some((arg) => !['--import=tsx', '--test'].includes(arg)))
    )
      throw new Error('Unsupported Node runtime argument');
    if (item.runtime === 'vitest') {
      if (!allowsScope(allowed, unitTestScopes(item.script)))
        throw new Error('Vitest file outside selected scope');
      if (item.args.some((arg) => !arg.startsWith('--testNamePattern=')))
        throw new Error('Only explicit Vitest case filters are supported');
    } else validateBatchScope({ version: 1, tests: [item] }, scope);
    for (const field of ['files', 'directories'])
      if (
        item.inputs?.[field] !== undefined &&
        (!Array.isArray(item.inputs[field]) ||
          item.inputs[field].some((path) => typeof path !== 'string'))
      )
        throw new Error('Invalid dependency declaration');
    for (const path of item.evidence ?? []) localFile(root, path);
    if (item.resultFile) localFile(root, item.resultFile);
    const binding = fingerprint(root, item, { cache });
    if (ids.has(item.id) && ids.get(item.id) !== binding.key)
      throw new Error('One check ID cannot name different configurations');
    ids.set(item.id, binding.key);
    const previous = seen.get(binding.key);
    if (previous) {
      previous.selectedBy.push(item.id);
      continue;
    }
    const changedPaths = changes?.files.map((file) =>
      file.path.replaceAll('\\', '/'),
    );
    const relevant =
      !changedPaths ||
      !binding.reusable ||
      changedPaths.some(
        (path) =>
          binding.value.files.some((file) => file.path === path) ||
          (item.inputs?.directories ?? []).some((directory) =>
            path.startsWith(
              directory.replaceAll('\\', '/').replace(/\/$/, '') + '/',
            ),
          ),
      );
    const cached = relevant && !force ? index.find(binding) : undefined;
    const decision = !relevant
      ? 'not-applicable'
      : cached?.proof
        ? 'reuse'
        : 'execute';
    const test = {
      ...item,
      binding,
      selectedBy: [item.id],
      decision,
      reason: !relevant
        ? 'No task-owned change affects declared dependencies'
        : force
          ? 'Forced execution'
          : (cached?.reason ?? 'No passing evidence'),
      evidencePath: cached?.path,
      reusedProof: cached?.proof,
    };
    tests.push(test);
    seen.set(binding.key, test);
  }
  return {
    version: 2,
    scope,
    changes: changes ?? null,
    tests,
    planKey: keyOf(
      tests.map((test) => ({
        id: test.id,
        key: test.binding.key,
        decision: test.decision,
      })),
    ),
  };
}
