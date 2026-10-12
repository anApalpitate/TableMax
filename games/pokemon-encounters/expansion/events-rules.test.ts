import { describe, expect, it } from 'vitest';
import { pokemonExpansion as rules, createInitialState } from './index';
import { card } from './cards';
import {
  currentWeather,
  effectiveCard,
  eventKinds,
  resolveCardDefinitions,
  trickRoomMap,
} from './events';
import type { Action, State } from './state';
import type { RuleContext } from '@tablemax/game-sdk';

function context(count = 2): RuleContext {
  let seed = 731;
  return {
    seats: Array.from({ length: count }, (_, i) => `s${i}`),
    random: {
      next: () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      },
    },
  };
}
function apply(s: State, action: Action, ctx: RuleContext, seat = s.turnSeat) {
  return rules.apply(s, action, seat, ctx).state;
}
function playing(count = 2) {
  const ctx = context(count);
  let state = rules.initialize(ctx);
  for (const seat of ctx.seats)
    state = apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      ctx,
      seat,
    );
  for (const seat of ctx.seats)
    state = apply(state, { type: 'initial-flip', slot: 0 }, ctx, seat);
  return { ctx, state };
}
function top(s: State, id: string) {
  const outgoing = s.deck.at(-1)!;
  const inDeck = s.deck.indexOf(id);
  const inDiscard = s.discard.indexOf(id);
  if (inDeck >= 0) s.deck[inDeck] = outgoing;
  else if (inDiscard >= 0) s.discard[inDiscard] = outgoing;
  else {
    const slot = s.seatOrder
      .flatMap((seat) => s.boards[seat]!)
      .find((slot) => slot.instanceId === id);
    if (!slot) throw new Error('Missing fixture instance');
    slot.instanceId = outgoing;
  }
  s.deck[s.deck.length - 1] = id;
}
function put(
  s: State,
  id: string,
  seat: string,
  index: number,
  faceUp: boolean,
) {
  top(s, id);
  s.deck[s.deck.length - 1] = s.boards[seat]![index]!.instanceId;
  s.boards[seat]![index] = { instanceId: id, faceUp };
}
function unprotect(s: State) {
  s.normalTurnsBySeat = Object.fromEntries(
    s.seatOrder.map((seat) => [seat, 2]),
  );
  s.randomEvent!.protected = false;
}
function triggerContext(
  ctx: RuleContext,
  kind: (typeof eventKinds)[number],
): RuleContext {
  return {
    seats: ctx.seats,
    random: {
      next: () => (eventKinds.indexOf(kind) + 0.25) / eventKinds.length,
    },
  };
}

describe('v3 authoritative event profile', () => {
  it.each([2, 3, 4, 5, 6])(
    'starts %i seats with the unified deck and a private marker',
    (count) => {
      const ctx = context(count);
      const before = rules.initialize(ctx);
      expect(before.rulesProfile).toBe('events-research-v3');
      expect(before.deck).toHaveLength(144);
      expect(rules.validateState(before, ctx.seats)).toEqual(before);
      const { state } = playing(count);
      expect(state.randomEvent!.markerInstanceId).not.toBeNull();
      expect(state.deck).toContain(state.randomEvent!.markerInstanceId);
      expect(rules.validateState(state, ctx.seats)).toEqual(state);
      const publicJson = JSON.stringify(
        rules.project(state, { role: 'public' }),
      );
      expect(publicJson).not.toContain('markerInstanceId');
      expect(publicJson).not.toContain(state.randomEvent!.markerInstanceId!);
    },
  );
  it('excludes the marked card from all deck draws until every seat completes two turns', () => {
    const { ctx, state } = playing();
    const marker = state.randomEvent!.markerInstanceId!;
    top(state, marker);
    const drawn = apply(state, { type: 'draw', source: 'deck' }, ctx);
    expect(drawn.held).not.toBe(marker);
    expect(drawn.deck).toContain(marker);
    expect(drawn.randomEvent!.triggered).toBe(false);
    let next = state;
    for (let i = 0; i < 4; i++) {
      next = apply(next, { type: 'reposition', a: 1, b: 2 }, ctx);
      expect(next.randomEvent!.protected).toBe(i < 3);
    }
    expect(Object.values(next.normalTurnsBySeat!)).toEqual([2, 2]);
    expect(rules.validateState(next, ctx.seats)).toEqual(next);
  });
  it('applies a randomly selected event before the marked card enters its native ability', () => {
    const { ctx, state } = playing();
    unprotect(state);
    top(state, 'special-mewtwo#01');
    state.randomEvent!.markerInstanceId = 'special-mewtwo#01';
    put(state, 'ordinary-4#01', 's0', 0, true);
    top(state, 'special-mewtwo#01');
    const result = apply(
      state,
      { type: 'draw', source: 'deck' },
      triggerContext(ctx, 'rain'),
    );
    expect(result.phase).toBe('mewtwo-target');
    expect(currentWeather(result)).toBe('rain');
    expect(
      rules.project(result, { role: 'public' }).boards.s0![0]!.card,
    ).toMatchObject({
      value: 2,
      printedValue: 4,
      scoreEffect: { kind: 'rain', delta: -2 },
    });
    expect(
      result.events.filter((event) => event.kind === 'special-event'),
    ).toHaveLength(1);
    expect(
      result.events.findIndex((event) => event.kind === 'special-event'),
    ).toBeLessThan(
      result.events.findIndex((event) => event.action?.verb === 'draw'),
    );
    expect(rules.validateState(result, ctx.seats)).toEqual(result);
  });
  it.each(eventKinds)(
    'persists one %s outcome without replaying or repeating it',
    (kind) => {
      const { ctx, state } = playing();
      unprotect(state);
      top(state, 'ordinary-1#01');
      state.randomEvent!.markerInstanceId = 'ordinary-1#01';
      const triggered = apply(
        state,
        { type: 'draw', source: 'deck' },
        triggerContext(ctx, kind),
      );
      const recovered = rules.validateState(
        JSON.parse(JSON.stringify(triggered)),
        ctx.seats,
      );
      expect(recovered.randomEvent).toMatchObject({ kind, triggered: true });
      expect(rules.project(recovered, { role: 'public' }).currentEvent).toEqual(
        { kind, placeholder: kind === 'mega' },
      );
      const done = apply(recovered, { type: 'discard-held' }, ctx);
      top(done, 'ordinary-1#01');
      const again = apply(done, { type: 'draw', source: 'deck' }, ctx);
      expect(
        again.events.filter((event) => event.kind === 'special-event'),
      ).toHaveLength(1);
      if (kind === 'mega')
        expect(
          resolveCardDefinitions(triggered)[state.boards.s0![0]!.instanceId]!
            .value,
        ).toBe(
          card(state.boards.s0![0]!.instanceId, 'events-research-v3').value,
        );
    },
  );
  it('changes hidden ordinary roles once without revealing them or changing physical identities', () => {
    const { ctx, state } = playing();
    unprotect(state);
    put(state, 'ordinary--2#01', 's0', 1, false);
    top(state, 'ordinary-1#01');
    state.randomEvent!.markerInstanceId = 'ordinary-1#01';
    const before = state.boards.s0![1]!.instanceId;
    const next = apply(
      state,
      { type: 'draw', source: 'deck' },
      triggerContext(ctx, 'trick-room'),
    );
    expect(next.boards.s0![1]).toEqual({ instanceId: before, faceUp: false });
    expect(next.cardOverrides![before]).toBe(trickRoomMap['ordinary--2']);
    expect(
      effectiveCard(before, 'events-research-v3', next.cardOverrides).value,
    ).toBe(11);
    expect(
      rules.project(next, { role: 'public' }).boards.s0![1]!.card,
    ).toBeNull();
    const visible = structuredClone(next);
    visible.boards.s0![1]!.faceUp = true;
    expect(
      rules.project(visible, { role: 'public' }).boards.s0![1]!.card,
    ).toMatchObject({
      originalCategoryId: 'ordinary--2',
      categoryId: 'ordinary-garchomp',
      printedValue: -2,
      effectiveValue: 11,
      scoreEffect: null,
    });
    expect(rules.validateState(next, ctx.seats)).toEqual(next);
  });
  it('keeps the marker protected during Lucario extra draws', () => {
    const { ctx, state } = playing();
    top(state, 'special-lucario#01');
    let next = apply(state, { type: 'draw', source: 'deck' }, ctx);
    next = apply(next, { type: 'replace', slot: 0 }, ctx);
    next = apply(next, { type: 'extra-draw' }, ctx);
    top(next, 'ordinary-1#01');
    next.randomEvent!.markerInstanceId = 'ordinary-1#01';
    const drawn = apply(next, { type: 'draw', source: 'deck' }, ctx);
    expect(drawn.held).not.toBe('ordinary-1#01');
    expect(drawn.randomEvent!.triggered).toBe(false);
    expect(Object.values(drawn.normalTurnsBySeat!)).toEqual([0, 0]);
    expect(rules.validateState(drawn, ctx.seats)).toEqual(drawn);
  });
  it('fires from a Rocket replacement before that drawn card is put into the board', () => {
    const { ctx, state } = playing();
    unprotect(state);
    top(state, 'special-team-rocket#01');
    const rocketCtx = { seats: ctx.seats, random: { next: () => 0.75 } };
    const drawn = apply(state, { type: 'draw', source: 'deck' }, rocketCtx);
    expect(drawn.phase).toBe('rocket-pikachu');
    put(drawn, 'ordinary--2#01', drawn.turnSeat, 1, false);
    top(drawn, 'ordinary-1#01');
    drawn.randomEvent!.markerInstanceId = 'ordinary-1#01';
    const next = apply(
      drawn,
      { type: 'replace', slot: 1 },
      triggerContext(ctx, 'trick-room'),
    );
    expect(next.cardOverrides!['ordinary--2#01']).toBe('ordinary-garchomp');
    expect(next.cardOverrides!['ordinary-1#01']).toBeUndefined();
    expect(next.boards[drawn.turnSeat]![1]!.instanceId).toBe('ordinary-1#01');
    expect(next.randomEvent!.kind).toBe('trick-room');
    expect(rules.validateState(next, ctx.seats)).toEqual(next);
  });
  it('uses forced-revealed weather values while retaining the research visibility snapshot', () => {
    const { ctx, state } = playing();
    unprotect(state);
    state.randomEvent!.kind = 'rain';
    state.randomEvent!.triggered = true;
    const actor = state.turnSeat,
      other = ctx.seats.find((seat) => seat !== actor)!;
    put(state, 'ordinary-4#01', other, 1, false);
    for (let i = 0; i < 8; i++) state.boards[actor]![i]!.faceUp = true;
    state.boards[actor]![8]!.faceUp = false;
    top(state, 'ordinary-1#01');
    const held = apply(state, { type: 'draw', source: 'deck' }, ctx);
    const settled = apply(held, { type: 'replace', slot: 8 }, ctx);
    expect(settled.phase).toBe('round-result');
    expect(settled.preReveal![other]![1]).toBe(false);
    expect(settled.boards[other]![1]!.faceUp).toBe(true);
    expect(settled.roundResult!.scores[other]!.values[1]).toBe(2);
    expect(rules.validateState(settled, ctx.seats)).toEqual(settled);
  });
  it('limits new Mewtwo peeks and exchanges to the one authorized slot', () => {
    const { ctx, state } = playing();
    top(state, 'special-mewtwo#01');
    const drawing = apply(state, { type: 'draw', source: 'deck' }, ctx);
    const actor = drawing.turnSeat,
      other = ctx.seats.find((seat) => seat !== actor)!;
    expect(
      rules
        .legalActions(drawing, actor)
        .every((action) => action.type !== 'mewtwo-target' || 'slot' in action),
    ).toBe(true);
    expect(() =>
      apply(drawing, { type: 'mewtwo-target', seat: other, a: 1, b: 2 }, ctx),
    ).toThrow('Illegal');
    const peeked = apply(
      drawing,
      { type: 'mewtwo-target', seat: other, slot: 1 },
      ctx,
    );
    expect(
      rules.project(peeked, { role: 'player', seatId: actor }).peek!.cards,
    ).toHaveLength(1);
    expect(rules.project(peeked, { role: 'public' }).peek).toBeNull();
    expect(
      rules.project(peeked, { role: 'player', seatId: other }).peek,
    ).toBeNull();
    expect(() =>
      apply(peeked, { type: 'mewtwo-exchange', slot: 2 }, ctx),
    ).toThrow('Illegal');
    expect(rules.validateState(peeked, ctx.seats)).toEqual(peeked);
  });
  it('keeps the original profile for the next round of an already started old match', () => {
    const ctx = context();
    const legacy = createInitialState(ctx, 'research-buffer-v2');
    legacy.phase = 'round-result';
    legacy.roundResult = { scores: {}, winners: ['s0'] };
    const next = rules.applyLifecycle(
      legacy,
      { type: 'next-round' },
      ctx,
    ).state;
    expect(next.rulesProfile).toBe('research-buffer-v2');
    expect(next.deck).toHaveLength(112);
    expect(next.randomEvent).toBeUndefined();
  });
});
