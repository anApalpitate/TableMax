import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
// Settlement reveals are presentation, not a saved gameplay reveal.
const orientation = (state) => {
  const settled = ['round-result', 'match-result'].includes(state.phase);
  const entries = Object.entries(state.boards).flatMap(([seat, board]) =>
    board.map((card, slot) => {
      const up = settled ? state.preReveal?.[seat]?.[slot] : card.faceUp;
      assert.equal(typeof up, 'boolean', 'Missing pre-reveal orientation');
      return [card.instanceId, up];
    }),
  );
  const result = new Map(entries);
  assert.equal(result.size, entries.length, 'Duplicate board identity');
  return result;
};
export function createFlowObserver() {
  const rows = [];
  let current = null,
    pending = new Map(),
    coverCounts = new Map();
  return {
    observe(before, after, action) {
      assert.equal(before.roundNumber, after.roundNumber);
      if (current?.round !== before.roundNumber) {
        current = {
          round: before.roundNumber,
          actions: 0,
          coverActions: 0,
          coveredCards: 0,
          repeatedCoverEpisodes: 0,
          coverRevealCycles: 0,
          sameActionCycles: 0,
          departedWhileCovered: 0,
          pendingAtSettlement: 0,
          cycleSavedActionDelays: [],
        };
        rows.push(current);
        pending = new Map();
        coverCounts = new Map();
      }
      current.actions++;
      const prior = orientation(before),
        next = orientation(after);
      if (['ninja-target', 'activate-arceus'].includes(action.type))
        current.coverActions++;
      // Arceus covers every bright card before randomly revealing one per seat;
      // some complete cover/reveal cycles therefore have zero saved-action delay.
      const covered = [...prior]
        .filter(
          ([id, up]) =>
            up &&
            next.has(id) &&
            (action.type === 'activate-arceus' || next.get(id) === false),
        )
        .map(([id]) => id);
      for (const id of covered) {
        current.coveredCards++;
        if (coverCounts.has(id)) current.repeatedCoverEpisodes++;
        coverCounts.set(id, (coverCounts.get(id) ?? 0) + 1);
        pending.set(id, current.actions);
      }
      for (const [id, step] of pending) {
        if (!next.has(id)) {
          current.departedWhileCovered++;
          pending.delete(id);
        } else if (next.get(id)) {
          const delay = current.actions - step;
          current.coverRevealCycles++;
          current.sameActionCycles += Number(delay === 0);
          current.cycleSavedActionDelays.push(delay);
          pending.delete(id);
        }
      }
      if (['round-result', 'match-result'].includes(after.phase))
        current.pendingAtSettlement = pending.size;
      assert.equal(
        current.coveredCards,
        current.coverRevealCycles + current.departedWhileCovered + pending.size,
        'Cover episode conservation',
      );
    },
    snapshot() {
      return structuredClone(rows);
    },
  };
}
