import { allowsScope, parseScope, presetCandidates } from './scopes.mjs';
import { createFingerprintStage, fingerprint } from './evidence.mjs';
import { preparePlan, validateOwnedChanges } from './plan.mjs';

export function preparePreset(root, value, changes, scope, options = {}) {
  const planningStarted = performance.now();
  let selectionFingerprintMs = 0;
  const categories = value.split(',');
  if (
    !categories.length ||
    new Set(categories).size !== categories.length ||
    categories.some(
      (category) => !['rules', 'ui', 'resources', 'tooling'].includes(category),
    )
  )
    throw new Error('Choose preset categories: rules, ui, resources, tooling');
  validateOwnedChanges(root, changes);
  const allowed = parseScope(scope),
    stage = createFingerprintStage();
  const selected = [],
    excluded = [];
  const changed = changes.files.map((file) => file.path.replaceAll('\\', '/'));
  for (const candidate of presetCandidates(root)) {
    let reason;
    if (!candidate.scopes)
      reason = 'Unclassified test; use an explicit reviewed plan';
    else if (!allowsScope(allowed, candidate.scopes))
      reason = 'Outside selected scope';
    else if (
      !categories.some((category) => candidate.categories.includes(category))
    )
      reason = 'Outside selected categories';
    else {
      const binding = fingerprint(root, candidate, { stage });
      selectionFingerprintMs += binding.durationMs;
      // Static dependencies are exact; incomplete dynamic inputs conservatively
      // select the affected scope, but cannot create a reusable passing proof.
      const prefixes = candidate.scopes.flatMap((required) =>
        required.startsWith('game:')
          ? [
              'games/' + required.slice(5) + '/',
              'assets/' + required.slice(5) + '/',
              'assets/games/' + required.slice(5) + '/',
            ]
          : required === 'tooling'
            ? ['tools/test/runner/']
            : ['apps/', 'packages/', 'assets/platform/'],
      );
      const relevant = changed.some(
        (path) =>
          binding.value.files.some((file) => file.path === path) ||
          (!binding.reusable &&
            prefixes.some((prefix) => path.startsWith(prefix))),
      );
      if (!relevant)
        reason =
          'No task-owned change affects known dependencies or conservative scope inputs';
    }
    if (reason)
      excluded.push({
        id: candidate.id,
        script: candidate.script,
        decision: 'excluded',
        reason,
      });
    else {
      const { scopes, categories: declaredCategories, ...item } = candidate;
      selected.push({
        ...item,
        combination: { category: declaredCategories, scope: scopes },
      });
    }
  }
  const prepared = preparePlan(
    root,
    { version: 2, tests: selected },
    undefined,
    scope,
    { ...options, stage, allowEmpty: true },
  );
  return {
    ...prepared,
    changes,
    preset: categories,
    excluded,
    timings: {
      ...prepared.timings,
      planningMs: performance.now() - planningStarted,
      selectionFingerprintMs,
    },
  };
}
