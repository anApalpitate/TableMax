import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { pokemonExpansion as rules } from '../../../../games/pokemon-encounters/expansion/index.ts';
import { measureMatch } from './pokemon-expansion-match-runner.mjs';
import { createFlowObserver } from './pokemon-expansion-flow-observer.mjs';
let active = false;
/** Isolated audit process only: preserve the rule result and restore the hook on all exits. */
export async function measureFlow(players, seed, levels, roundCap, onRound) {
  assert.equal(active, false, 'Flow measurement must be serial');
  active = true;
  const original = rules.apply,
    observer = createFlowObserver();
  rules.apply = (state, action, seat, context) => {
    const result = original(state, action, seat, context);
    observer.observe(state, result.state, action);
    return result;
  };
  try {
    const result = await measureMatch(players, seed, levels, roundCap, onRound);
    const flow = observer.snapshot();
    if (result.completed) assert.equal(flow.length, result.rounds.length);
    else assert.equal(flow.length, result.rounds.length + 1);
    assert.equal(
      flow.reduce((n, r) => n + r.actions, 0),
      result.actions,
    );
    return { ...result, flow };
  } finally {
    rules.apply = original;
    active = false;
  }
}
