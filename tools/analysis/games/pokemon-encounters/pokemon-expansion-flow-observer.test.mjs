import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlowObserver } from './pokemon-expansion-flow-observer.mjs';
const state = (up = true) => ({
  roundNumber: 1,
  phase: 'draw',
  preReveal: null,
  boards: Object.fromEntries(
    ['a', 'b'].map((s) => [
      s,
      Array.from({ length: 9 }, (_, i) => ({
        instanceId: `${s}${i}`,
        faceUp: up,
      })),
    ]),
  ),
});
test('row movement preserves facing by identity, not position', () => {
  const before = state(false);
  before.boards.a[0].faceUp = true;
  const after = structuredClone(before);
  [after.boards.a[0], after.boards.b[0]] = [
    after.boards.b[0],
    after.boards.a[0],
  ];
  const observer = createFlowObserver();
  observer.observe(before, after, { type: 'row-target' });
  const r = observer.snapshot()[0];
  assert.equal(r.coveredCards, 0);
  assert.equal(r.coverRevealCycles, 0);
  assert.deepEqual(before, stateWithOneUp());
});
function stateWithOneUp() {
  const s = state(false);
  s.boards.a[0].faceUp = true;
  return s;
}
test('settlement forced reveal does not close a natural cover cycle', () => {
  const before = state(true),
    covered = structuredClone(before);
  covered.boards.a[0].faceUp = false;
  covered.boards.a[1].faceUp = false;
  const end = structuredClone(covered);
  end.phase = 'round-result';
  end.preReveal = Object.fromEntries(
    Object.entries(covered.boards).map(([s, b]) => [s, b.map((c) => c.faceUp)]),
  );
  for (const board of Object.values(end.boards))
    for (const c of board) c.faceUp = true;
  const observer = createFlowObserver();
  observer.observe(before, covered, {
    type: 'ninja-target',
    seat: 'a',
    a: 0,
    b: 1,
  });
  observer.observe(covered, end, { type: 'replace', slot: 8 });
  const r = observer.snapshot()[0];
  assert.equal(r.coveredCards, 2);
  assert.equal(r.coverRevealCycles, 0);
  assert.equal(r.pendingAtSettlement, 2);
});
test('Arceus same-action cover and random reveal are both counted', () => {
  const before = state(true),
    after = state(false);
  after.boards.a[0].faceUp = true;
  after.boards.b[1].faceUp = true;
  const observer = createFlowObserver();
  observer.observe(before, after, { type: 'activate-arceus' });
  const r = observer.snapshot()[0];
  assert.equal(r.coveredCards, 18);
  assert.equal(r.coverRevealCycles, 2);
  assert.equal(r.sameActionCycles, 2);
  assert.deepEqual(r.cycleSavedActionDelays, [0, 0]);
});
test('repeated covers follow moved cards, reset per round, and censor departures', () => {
  const observer = createFlowObserver(),
    start = state(true),
    covered = structuredClone(start);
  covered.boards.a[0].faceUp = false;
  covered.boards.a[1].faceUp = false;
  observer.observe(start, covered, {
    type: 'ninja-target',
    seat: 'a',
    a: 0,
    b: 1,
  });
  const moved = structuredClone(covered);
  [moved.boards.a[0], moved.boards.b[0]] = [
    moved.boards.b[0],
    moved.boards.a[0],
  ];
  observer.observe(covered, moved, { type: 'row-target' });
  const revealed = structuredClone(moved);
  revealed.boards.b[0].faceUp = true;
  observer.observe(moved, revealed, { type: 'replace' });
  const again = structuredClone(revealed);
  again.boards.b[0].faceUp = false;
  observer.observe(revealed, again, {
    type: 'ninja-target',
    seat: 'b',
    a: 0,
    b: 1,
  });
  const departed = structuredClone(again);
  departed.boards.b[0] = { instanceId: 'new', faceUp: true };
  observer.observe(again, departed, { type: 'replace' });
  const next = state(true);
  next.roundNumber = 2;
  const nextCovered = structuredClone(next);
  nextCovered.boards.a[0].faceUp = false;
  nextCovered.boards.a[1].faceUp = false;
  observer.observe(next, nextCovered, {
    type: 'ninja-target',
    seat: 'a',
    a: 0,
    b: 1,
  });
  const rows = observer.snapshot();
  assert.equal(rows[0].repeatedCoverEpisodes, 1);
  assert.equal(rows[0].coverRevealCycles, 1);
  assert.equal(rows[0].departedWhileCovered, 1);
  assert.equal(rows[1].repeatedCoverEpisodes, 0);
  assert.ok(!JSON.stringify(rows).includes('instanceId'));
  assert.ok(!JSON.stringify(rows).includes('a0'));
});
