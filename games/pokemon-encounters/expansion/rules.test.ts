import { describe, expect, it } from 'vitest';
import { pokemonExpansion as rules } from './index';
import type { State, Action } from './state';
import { instancesForSeats } from './cards';

const context = (n = 2) => ({
  seats: Array.from({ length: n }, (_, i) => `s${i}`),
  random: { next: () => 0.1 },
});
const apply = (s: State, a: Action, seat: string) =>
  rules.apply(s, a, seat, context(s.seatOrder.length)).state as State;
const dealt = () => {
  let s = rules.initialize(context()) as State;
  for (const seat of s.seatOrder)
    s = apply(
      s,
      { type: 'vote-research', taskId: s.researchCandidates[0]! },
      seat,
    );
  return s;
};
const playing = () => {
  let s = dealt();
  for (const seat of s.seatOrder)
    s = apply(s, { type: 'initial-flip', slot: 0 }, seat);
  return s;
};
function moveToDeckTop(s: State, id: string) {
  const replacement = s.deck.at(-1)!;
  const index = s.deck.indexOf(id);
  if (index >= 0) {
    s.deck[index] = replacement;
    s.deck[s.deck.length - 1] = id;
    return;
  }
  const discarded = s.discard.indexOf(id);
  if (discarded >= 0) {
    s.discard[discarded] = replacement;
    s.deck[s.deck.length - 1] = id;
    return;
  }
  for (const seat of s.seatOrder) {
    const c = s.boards[seat]!.find((c) => c.instanceId === id);
    if (c) {
      c.instanceId = replacement;
      s.deck[s.deck.length - 1] = id;
      return;
    }
  }
  throw new Error('Fixture instance absent');
}
function drawCategory(category: string) {
  let s = playing();
  moveToDeckTop(s, `${category}#01`);
  s = apply(s, { type: 'draw', source: 'deck' }, s.turnSeat);
  return s;
}
function putOnBoard(
  s: State,
  id: string,
  seat: string,
  slot: number,
  faceUp = true,
) {
  moveToDeckTop(s, id);
  const outgoing = s.boards[seat]![slot]!.instanceId;
  s.deck[s.deck.length - 1] = outgoing;
  s.boards[seat]![slot] = { instanceId: id, faceUp };
}
describe('expansion authoritative actions', () => {
  it('votes before dealing, private locked choices and commute-safe decisions', () => {
    let s = rules.initialize(context()) as State;
    expect(s.phase).toBe('research-vote');
    expect(s.boards.s0).toEqual([]);
    expect(rules.decisions(s)).toHaveLength(2);
    expect(
      new Set(rules.decisions(s).map((d) => d.concurrencyGroup)).size,
    ).toBe(1);
    s = apply(
      s,
      { type: 'vote-research', taskId: s.researchCandidates[0]! },
      's0',
    );
    expect(rules.legalActions(s, 's0')).toEqual([]);
    expect(JSON.stringify(rules.project(s, { role: 'public' }))).not.toContain(
      'votesBySeat',
    );
    expect(
      (
        rules.project(s, { role: 'player', seatId: 's1' }) as {
          ownVote: string | null;
        }
      ).ownVote,
    ).toBeNull();
    s = apply(
      s,
      { type: 'vote-research', taskId: s.researchCandidates[1]! },
      's1',
    );
    expect(s.phase).toBe('initial-flip');
    expect(s.activeResearch).toHaveLength(1);
    expect(s.boards.s0).toHaveLength(9);
    expect(s.discard).toHaveLength(2);
    expect(
      s.seatOrder
        .flatMap((id) => s.boards[id]!)
        .some((c) =>
          ['special-mewtwo', 'special-arceus'].includes(
            c.instanceId.split('#')[0]!,
          ),
        ),
    ).toBe(false);
    expect(rules.validateState(s, s.seatOrder)).toEqual(s);
  });
  it('second discard removes only itself and ordinary reposition preserves identities and orientation', () => {
    let s = playing();
    const before = [...s.discard];
    s = apply(
      s,
      { type: 'draw', source: 'discard', discardIndex: 1 },
      s.turnSeat,
    );
    expect(s.held).toBe(before.at(-2));
    expect(s.discard.at(-1)).toBe(before.at(-1));
    let t = playing();
    const a = { ...t.boards[t.turnSeat]![0]! },
      b = { ...t.boards[t.turnSeat]![1]! };
    const actor = t.turnSeat;
    t = apply(t, { type: 'reposition', a: 0, b: 1 }, actor);
    expect(t.boards[actor]![0]).toEqual(b);
    expect(t.boards[actor]![1]).toEqual(a);
    expect(t.phase).toBe('draw');
  });
  it('rejects corruption, extra action properties, and invalid identity', () => {
    const s = playing();
    expect(() =>
      rules.validateAction({ type: 'draw', source: 'deck', hidden: 'x' }),
    ).toThrow();
    expect(() =>
      rules.validateState({ ...s, deck: [...s.deck, s.deck[0]] }, s.seatOrder),
    ).toThrow();
    expect(rules.legalActions(s, 'intruder')).toEqual([]);
    const all = [
      ...s.seatOrder.flatMap((id) => s.boards[id]!.map((c) => c.instanceId)),
      ...s.deck,
      ...s.discard,
    ];
    expect(new Set(all).size).toBe(instancesForSeats(2).length);
  });
  it('saved states and projected views are independent copies', () => {
    const s = playing(),
      snapshot = JSON.stringify(s);
    const next = apply(s, { type: 'reposition', a: 0, b: 1 }, s.turnSeat);
    expect(JSON.stringify(s)).toBe(snapshot);
    const projected = rules.project(next, { role: 'public' });
    projected.seatOrder.push('forged');
    projected.winsBySeat.s0 = 3;
    expect(next.seatOrder).toHaveLength(2);
    expect(next.winsBySeat.s0).toBe(0);
    const restored = rules.validateState(JSON.parse(snapshot), s.seatOrder);
    expect(
      apply(restored, { type: 'reposition', a: 0, b: 1 }, restored.turnSeat),
    ).toEqual(next);
    expect(() =>
      rules.validateState(
        {
          ...next,
          events: [
            {
              id: 1,
              kind: 'action',
              text: 'x',
              action: {
                actor: 's0',
                verb: 'peek',
                cardCategory: 'special-charizard',
                ability: 'charizard',
                targets: [{ seat: 's0', slots: [2] }],
              },
            },
          ],
        },
        next.seatOrder,
      ),
    ).toThrow();
  });
  it('Arceus preserves every card/position, random one-up, and global once-per-round status', () => {
    let s = drawCategory('special-arceus');
    const seat = s.turnSeat;
    for (const c of s.boards[seat]!) c.faceUp = true;
    s.boards[seat]![1]!.faceUp = false;
    s = apply(s, { type: 'replace', slot: 1 }, seat);
    expect(s.phase).toBe('arceus-choice'); // last face-up must not settle ahead of ability
    const ids = Object.fromEntries(
      s.seatOrder.map((id) => [id, s.boards[id]!.map((c) => c.instanceId)]),
    );
    const deck = [...s.deck],
      discard = [...s.discard],
      research = [...s.activeResearch];
    s = apply(s, { type: 'activate-arceus' }, seat);
    expect(s.phase).toBe('draw');
    expect(s.arceusUsed).toBe(true);
    expect(
      Object.fromEntries(
        s.seatOrder.map((id) => [id, s.boards[id]!.map((c) => c.instanceId)]),
      ),
    ).toEqual(ids);
    for (const id of s.seatOrder) {
      expect(s.boards[id]!.filter((c) => c.faceUp)).toHaveLength(1);
      expect(s.boards[id]![0]!.faceUp).toBe(true);
    }
    expect(s.deck).toEqual(deck);
    expect(s.discard).toEqual(discard);
    expect(s.activeResearch.slice(0, research.length)).toEqual(research);
    expect(rules.validateState(s, s.seatOrder)).toEqual(s);
  });
  it('Mewtwo private peek can be declined, and confirmation requires self replacement', () => {
    let s = drawCategory('special-mewtwo');
    const seat = s.turnSeat,
      opponent = s.seatOrder.find((id) => id !== seat)!;
    s = apply(s, { type: 'mewtwo-target', seat: opponent, a: 1, b: 2 }, seat);
    expect(
      (rules.project(s, { role: 'player', seatId: seat }) as { peek: unknown })
        .peek,
    ).not.toBeNull();
    expect(
      (
        rules.project(s, { role: 'player', seatId: opponent }) as {
          peek: unknown;
        }
      ).peek,
    ).toBeNull();
    expect(
      (rules.project(s, { role: 'public' }) as { peek: unknown }).peek,
    ).toBeNull();
    expect(rules.validateState(s, s.seatOrder)).toEqual(s);
    const declined = apply(s, { type: 'decline-ability' }, seat);
    expect(declined.phase).toBe('place');
    expect(declined.held).toBe('special-mewtwo#01');
    const exchanged = apply(s, { type: 'mewtwo-exchange', slot: 1 }, seat);
    expect(exchanged.phase).toBe('mew-self');
    expect(
      rules
        .legalActions(exchanged, seat)
        .every((a) => (a as Action).type === 'replace'),
    ).toBe(true);
    expect(exchanged.boards[opponent]![1]!.instanceId).toBe(
      'special-mewtwo#01',
    );
    expect(rules.validateState(exchanged, s.seatOrder)).toEqual(exchanged);
  });
  it('Charizard peeks exactly one own hidden card and retains orientation', () => {
    let s = drawCategory('special-charizard');
    const seat = s.turnSeat;
    s = apply(s, { type: 'replace', slot: 1 }, seat);
    expect(s.phase).toBe('charizard-choice');
    const id = s.boards[seat]![2]!.instanceId;
    s = apply(s, { type: 'peek', slot: 2 }, seat);
    expect(s.peekSlots).toEqual([2]);
    expect(s.boards[seat]![2]).toEqual({ instanceId: id, faceUp: false });
    expect(rules.legalActions(s, seat)).toEqual([{ type: 'close-peek' }]);
    expect(
      (rules.project(s, { role: 'public' }) as { peek: unknown }).peek,
    ).toBeNull();
    s = apply(s, { type: 'close-peek' }, seat);
    expect(s.phase).toBe('draw');
  });
  it('Lucario extra draw suppresses mandatory effects and closes only after second placement', () => {
    let s = drawCategory('special-lucario');
    const seat = s.turnSeat;
    s = apply(s, { type: 'replace', slot: 1 }, seat);
    s = apply(s, { type: 'extra-draw' }, seat);
    moveToDeckTop(s, 'special-mew#01');
    s = apply(s, { type: 'draw', source: 'deck' }, seat);
    expect(s.phase).toBe('place');
    expect(s.suppressedAbility).toBe(true);
    s = apply(s, { type: 'replace', slot: 2 }, seat);
    expect(s.phase).toBe('draw');
    expect(s.turnSeat).not.toBe(seat);
  });
  it('Zapdos queues either direction, conserves cards, and only finishes after every recipient', () => {
    for (const direction of ['clockwise', 'counterclockwise'] as const) {
      let s = playing();
      moveToDeckTop(s, 'special-zapdos#01');
      s = apply(s, { type: 'draw', source: 'deck' }, s.turnSeat);
      const seat = s.turnSeat;
      s = apply(s, { type: 'pass-direction', direction }, seat);
      expect(rules.validateState(s, s.seatOrder)).toEqual(s);
      s = apply(s, { type: 'replace', slot: 1 }, seat);
      expect(s.phase).toBe('zapdos-receive');
      expect(rules.validateState(s, s.seatOrder)).toEqual(s);
      s = apply(s, { type: 'replace', slot: 1 }, s.recipientQueue[0]!);
      expect(s.phase).toBe('draw');
      expect(s.held).toBeNull();
      expect(rules.validateState(s, s.seatOrder)).toEqual(s);
    }
  });
  it('normal held cards are public but deck order and covered board identities are absent', () => {
    const s = drawCategory('ordinary-4');
    const v = rules.project(s, { role: 'public' }) as {
      held: { categoryId: string } | null;
      boards: Record<string, { card: unknown }[]>;
    };
    expect(v.held?.categoryId).toBe('ordinary-4');
    expect(v.boards[s.turnSeat]![1]!.card).toBeNull();
    expect(JSON.stringify(v)).not.toContain('instanceId');
  });
  it('trio requires simultaneous on-board visibility and publishes after full final-turn ability', () => {
    let s = playing();
    const seat = s.turnSeat;
    for (const id of s.seatOrder)
      for (const c of s.boards[id]!) c.faceUp = false;
    const ids = [
      'special-groudon#01',
      'special-kyogre#01',
      'ordinary-4#01',
      'ordinary-4#02',
      'ordinary-4#03',
      'ordinary-1#01',
      'ordinary-3#01',
      'ordinary-5#01',
    ];
    ids.forEach((id, i) => putOnBoard(s, id, seat, i));
    moveToDeckTop(s, 'special-rayquaza#01');
    s = apply(s, { type: 'draw', source: 'deck' }, seat);
    expect(s.hoennTriggered).toBe(false); // held is not on the field
    s = apply(s, { type: 'replace', slot: 8 }, seat);
    expect(s.phase).toBe('row-choice');
    expect(s.hoennTriggered).toBe(true);
    expect(s.hoennPending).not.toBeNull();
    expect(s.activeResearch).toHaveLength(1);
    expect(rules.validateState(s, s.seatOrder)).toEqual(s);
    s = apply(s, { type: 'decline-ability' }, seat);
    expect(s.phase).toBe('round-result');
    expect(s.activeResearch).toHaveLength(2);
    const lastKinds = s.events.slice(-3).map((e) => e.kind);
    expect(lastKinds).toEqual(['action', 'research', 'round-result']);
    expect(s.roundResult!.scores[seat]!.research).toHaveLength(2);
    expect(rules.validateState(s, s.seatOrder)).toEqual(s);
  });
  it('forced settlement revelation never creates a trio task', () => {
    let s = playing();
    const seat = s.turnSeat,
      other = s.seatOrder.find((id) => id !== seat)!;
    for (const id of s.seatOrder)
      for (const c of s.boards[id]!) c.faceUp = false;
    putOnBoard(s, 'special-groudon#01', other, 1, false);
    putOnBoard(s, 'special-kyogre#01', other, 2, false);
    putOnBoard(s, 'special-rayquaza#01', other, 3, false);
    for (const c of s.boards[seat]!) c.faceUp = true;
    s = apply(s, { type: 'reposition', a: 0, b: 1 }, seat);
    expect(s.phase).toBe('round-result');
    expect(s.hoennTriggered).toBe(false);
    expect(s.activeResearch).toHaveLength(1);
  });
  it('private vote preserves stable decisions and random draw only at last vote', () => {
    const ctx = context(3);
    let calls = 0;
    ctx.random.next = () => {
      calls++;
      return 0.25;
    };
    let s = rules.initialize(ctx) as State;
    const stable = rules.decisions(s).find((d) => d.seatId === 's2')!.id,
      startCalls = calls;
    s = rules.apply(
      s,
      { type: 'vote-research', taskId: s.researchCandidates[0]! },
      's0',
      ctx,
    ).state as State;
    expect(calls).toBe(startCalls);
    expect(rules.decisions(s).find((d) => d.seatId === 's2')!.id).toBe(stable);
    s = rules.apply(
      s,
      { type: 'vote-research', taskId: s.researchCandidates[1]! },
      's1',
      ctx,
    ).state as State;
    s = rules.apply(
      s,
      { type: 'vote-research', taskId: s.researchCandidates[2]! },
      's2',
      ctx,
    ).state as State;
    expect(s.voteCounts).toEqual(
      Object.fromEntries(s.researchCandidates.map((id) => [id, 1])),
    );
    expect(s.activeResearch[0]).toBe(s.researchCandidates[0]);
  });
  it('all legal transitions preserve validated state through random complete matches for 2–6 seats', () => {
    for (let n = 2; n <= 6; n++) {
      let seed = n;
      const random = {
          next: () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
          },
        },
        ctx = { ...context(n), random };
      let s = rules.initialize(ctx) as State;
      let steps = 0;
      while (!rules.ended(s) && steps++ < 8000) {
        const lifecycle = rules.lifecycleActions(s);
        if (lifecycle.length) {
          s = rules.applyLifecycle(s, lifecycle[0]!, ctx).state as State;
        } else {
          const d = rules.decisions(s)[0]!;
          let legal = rules.legalActions(s, d.seatId) as Action[];
          if (s.phase === 'draw')
            legal = legal.filter((a) => a.type === 'draw');
          if (
            [
              'place',
              'mew-self',
              'zapdos-self',
              'zapdos-receive',
              'rocket-meowth',
            ].includes(s.phase)
          ) {
            const hidden = legal.filter(
              (a) =>
                a.type === 'replace' && !s.boards[d.seatId]![a.slot]!.faceUp,
            );
            if (hidden.length) legal = hidden;
          }
          const a = legal[Math.floor(random.next() * legal.length)]!;
          s = rules.apply(s, a, d.seatId, ctx).state as State;
        }
        expect(
          () => rules.validateState(s, ctx.seats),
          `${n} seats ${s.phase} step ${s.step}`,
        ).not.toThrow();
      }
      expect(rules.ended(s), `${n} seats within bounded fixture`).toBe(true);
    }
  });
});
