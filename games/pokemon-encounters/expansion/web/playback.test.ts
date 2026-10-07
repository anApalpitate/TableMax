import { expect, it } from 'vitest';
import type { View } from '../project';
import {
  PresentationQueue,
  presentationSteps,
  presentedWins,
} from './playback';
const action = {
  actor: 'A',
  verb: 'draw',
  cardCategory: 'special-team-rocket',
  ability: 'team-rocket',
  source: 'discard' as const,
  targets: [],
};
const game = {
  boards: {},
  activeResearch: [],
  matchWinners: [],
  roundResult: null,
} as unknown as View;
it('reveals the actual research win award only when the saved result presentation completes', () => {
  const awarded = {
    winsBySeat: { A: 3, B: 1 },
    roundResult: { winners: ['A', 'B'], awardsBySeat: { A: 2, B: 0 } },
  } as unknown as View;
  expect(presentedWins(awarded, 'A', false)).toBe(1);
  expect(presentedWins(awarded, 'A', true)).toBe(3);
  expect(presentedWins(awarded, 'B', false)).toBe(1);
  expect(presentedWins(awarded, 'B', true)).toBe(1);
});
it('retains a full entrance followed by its board step while another save arrives; deduplicates receipts and cancels branches', () => {
  const q = new PresentationQueue();
  const a = presentationSteps(
    game,
    [
      {
        id: 1,
        kind: 'draw',
        text: '',
        action,
        effect: { entrance: 'team-rocket', coin: 'meowth', discardIndex: 1 },
      },
    ],
    1,
    false,
  );
  q.append('branch1', a);
  expect(q.next()?.kind).toBe('ability');
  q.append('branch1', a);
  q.append(
    'branch1',
    presentationSteps(
      game,
      [
        {
          id: 2,
          kind: 'replace',
          text: '',
          action: {
            ...action,
            verb: 'replace',
            targets: [{ seat: 'A', slots: [2] }],
          },
        },
      ],
      2,
      false,
    ),
  );
  expect(q.next()?.effects.moves[0]).toEqual({
    from: '@discard-second',
    to: '@held',
  });
  expect(q.next()?.event.id).toBe(2);
  q.append('branch2', a);
  expect(q.next()?.kind).toBe('ability');
  q.reset('branch2');
  expect(q.next()).toBeNull();
});
it('exhausted Rocket is a normal draw with no coin/entrance even though its category retains the ability', () => {
  expect(
    presentationSteps(
      game,
      [{ id: 3, kind: 'draw', text: '', action }],
      3,
      false,
    ).map((s) => s.kind),
  ).toEqual(['board']);
});
it('orders terminal action, research and result and captures no private cards or hidden votes', () => {
  const data = {
    ...game,
    peek: { secret: 'do-not-copy' },
    votesBySeat: { A: 'hidden' },
    activeResearch: [{ id: 'R01', name: '研究' }],
  } as unknown as View;
  const steps = presentationSteps(
    data,
    [
      { id: 4, kind: 'research', text: '' },
      { id: 5, kind: 'round-result', text: '' },
      {
        id: 6,
        kind: 'action',
        text: '',
        action: { ...action, verb: 'activate-arceus' },
        effect: { entrance: 'arceus' },
      },
    ],
    4,
    false,
  );
  expect(steps.map((s) => s.kind)).toEqual(['ability', 'research', 'result']);
  expect(JSON.stringify(steps)).not.toContain('do-not-copy');
  expect(JSON.stringify(steps)).not.toContain('hidden');
});
