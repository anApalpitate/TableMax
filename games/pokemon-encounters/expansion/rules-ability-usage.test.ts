import { describe, expect, it } from 'vitest';
import { pokemonExpansion as rules } from './index';
import { card, categories } from './cards';
import { RoomFeedbackSchema } from '../../../packages/protocol/src';
import type { State, Action } from './state';
import type { View } from './project';

const context = () => ({ seats: ['s0', 's1'], random: { next: () => 0.1 } });
const apply = (s: State, a: Action, seat = s.turnSeat) =>
  rules.apply(s, a, seat, context()).state as State;
function playing() {
  let s = rules.initialize(context()) as State;
  for (const seat of s.seatOrder)
    s = apply(
      s,
      { type: 'vote-research', taskId: s.researchCandidates[0]! },
      seat,
    );
  for (const seat of s.seatOrder)
    s = apply(s, { type: 'initial-flip', slot: 0 }, seat);
  return s;
}
function moveToDeckTop(s: State, id: string) {
  const replacement = s.deck.at(-1)!;
  const index = s.deck.indexOf(id);
  if (index >= 0) {
    [s.deck[index], s.deck[s.deck.length - 1]] = [replacement, id];
    return;
  }
  const discarded = s.discard.indexOf(id);
  if (discarded >= 0) s.discard[discarded] = replacement;
  else {
    const slot = Object.values(s.boards)
      .flat()
      .find((c) => c.instanceId === id);
    if (!slot) throw new Error('Missing fixture instance');
    slot.instanceId = replacement;
  }
  s.deck[s.deck.length - 1] = id;
}
function draw(category: string) {
  let s = playing();
  moveToDeckTop(s, `${category}#01`);
  s = apply(s, { type: 'draw', source: 'deck' });
  return s;
}
const view = (s: State) => rules.project(s, { role: 'public' }) as View;
const legacy = (s: State) => {
  const old = structuredClone(s);
  delete old.usedAbilityIds;
  delete old.pendingAbility;
  for (const event of old.events) delete event.effect;
  return old;
};
const last = (s: State) => s.events.at(-1)!;

describe('saved per-instance expansion ability use', () => {
  it('transports a committed real ability through the strict feedback protocol while keeping saved effects in projection', () => {
    let s = draw('special-snorlax');
    s = apply(s, { type: 'replace', slot: 1 });
    const result = rules.apply(
      s,
      { type: 'swap', a: 1, b: 2 },
      s.turnSeat,
      context(),
    );
    const feedback = {
      instanceId: '00000000-0000-4000-8000-000000000001',
      branch: 0,
      revision: 1,
      events: result.events,
    };
    expect(RoomFeedbackSchema.safeParse(feedback).success).toBe(true);
    const next = result.state as State;
    expect(next.events.at(-1)?.effect).toEqual({ entrance: 'snorlax' });
    expect(view(next).events.at(-1)?.effect).toEqual({ entrance: 'snorlax' });
    expect(next.usedAbilityIds).toEqual(['special-snorlax#01']);
  });

  it('keeps old snapshot bytes unchanged and lazily adds current fields only after an action', () => {
    const old = legacy(playing()),
      before = JSON.stringify(old);
    expect(JSON.stringify(rules.validateState(old, old.seatOrder))).toBe(
      before,
    );
    const next = apply(old, { type: 'reposition', a: 1, b: 2 });
    expect(next.usedAbilityIds).toEqual([]);
    expect(next.pendingAbility).toBeNull();
    expect(JSON.stringify(old)).toBe(before);
    expect(last(next).effect).toBeUndefined();
  });

  it('rejects half-present or malformed explicit fields rather than normalizing corrupt records', () => {
    const s = playing();
    expect(() =>
      rules.validateState({ ...legacy(s), usedAbilityIds: [] }, s.seatOrder),
    ).toThrow();
    expect(() =>
      rules.validateState(
        { ...s, usedAbilityIds: ['ordinary-1#01'] },
        s.seatOrder,
      ),
    ).toThrow();
    expect(() =>
      rules.validateState(
        { ...s, usedAbilityIds: ['special-mew#01', 'special-mew#01'] },
        s.seatOrder,
      ),
    ).toThrow();
  });

  it('charges the exact Snorlax instance after swapping its own position and blocks its later reuse', () => {
    let s = draw('special-snorlax');
    const seat = s.turnSeat;
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.pendingAbility).toEqual({
      kind: 'current',
      ability: 'snorlax',
      sourceInstanceId: 'special-snorlax#01',
    });
    expect(s.usedAbilityIds).toEqual([]);
    s = apply(s, { type: 'swap', a: 1, b: 2 });
    expect(s.usedAbilityIds).toEqual(['special-snorlax#01']);
    expect(s.boards[seat]![2]!.instanceId).toBe('special-snorlax#01');
    expect(view(s).boards[seat]![2]!.card?.abilityUsed).toBe(true);
    expect(last(s).effect).toEqual({ entrance: 'snorlax' });
    moveToDeckTop(s, 'special-snorlax#01');
    s = apply(s, { type: 'draw', source: 'deck' });
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.phase).toBe('draw');
    expect(s.pendingAbility).toBeNull();
    expect(s.usedAbilityIds).not.toContain('special-snorlax#02');
    expect(() => rules.validateState(s, s.seatOrder)).not.toThrow();
  });

  it('does not charge declined optional abilities', () => {
    let s = draw('special-snorlax');
    const seat = s.turnSeat;
    s = apply(s, { type: 'replace', slot: 1 });
    s = apply(s, { type: 'decline-ability' });
    expect(s.usedAbilityIds).toEqual([]);
    expect(view(s).boards[seat]![1]!.card?.abilityUsed).toBe(false);
    expect(last(s).effect).toBeUndefined();
  });

  it('uses deck only for Lucario and leaves the extra special card unspent and untriggered', () => {
    let s = draw('special-lucario');
    const seat = s.turnSeat;
    s = apply(s, { type: 'replace', slot: 1 });
    s = apply(s, { type: 'extra-draw' });
    expect(s.usedAbilityIds).toEqual(['special-lucario#01']);
    expect(last(s).effect).toEqual({ entrance: 'lucario' });
    expect(rules.legalActions(s, seat)).toEqual([
      { type: 'draw', source: 'deck' },
    ]);
    expect(() =>
      apply(s, { type: 'draw', source: 'discard', discardIndex: 0 }),
    ).toThrow();
    moveToDeckTop(s, 'special-mew#01');
    s = apply(s, { type: 'draw', source: 'deck' });
    expect(s.phase).toBe('place');
    expect(last(s).effect).toBeUndefined();
    s = apply(s, { type: 'replace', slot: 2 });
    expect(s.usedAbilityIds).not.toContain('special-mew#01');
    expect(view(s).boards[seat]![2]!.card?.abilityUsed).toBe(false);
    expect(s.pendingAbility).toBeNull();
  });

  it('resets only recycled instances while retaining both top discards and field use', () => {
    let s = playing();
    for (const id of [
      'special-mew#01',
      'special-zapdos#01',
      'special-charizard#01',
    ])
      moveToDeckTop(s, id);
    const fieldId = s.boards[s.turnSeat]!.find(
      (slot) => card(slot.instanceId).ability !== null,
    )!.instanceId;
    const keep = ['special-zapdos#01', 'special-charizard#01'];
    s.discard = [...s.discard, ...s.deck]
      .filter((id) => !keep.includes(id))
      .concat(keep);
    s.deck = [];
    s.usedAbilityIds = ['special-mew#01', ...keep, fieldId];
    s.arceusUsed = true;
    s = apply(s, { type: 'draw', source: 'deck' });
    expect(s.usedAbilityIds).not.toContain('special-mew#01');
    expect(s.usedAbilityIds).toEqual(
      expect.arrayContaining([...keep, fieldId]),
    );
    expect(s.arceusUsed).toBe(true);
    expect(s.discard).toEqual(keep);
    expect(() => rules.validateState(s, s.seatOrder)).not.toThrow();
  });

  it('charges Mew at the exchange, preserves the chain and does not consume the acquired card', () => {
    let s = draw('special-mew');
    const seat = s.turnSeat,
      opponent = s.seatOrder.find((id) => id !== seat)!;
    expect(last(s).effect).toEqual({ entrance: 'mew' });
    expect(s.usedAbilityIds).toEqual([]);
    const acquired = s.boards[opponent]![1]!.instanceId;
    s = apply(s, { type: 'mew-target', seat: opponent, slot: 1 });
    expect(s.usedAbilityIds).toEqual(['special-mew#01']);
    expect(s.phase).toBe('mew-self');
    expect(view(s).boards[opponent]![1]!.card?.abilityUsed).toBe(true);
    expect(last(s).effect).toBeUndefined();
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.usedAbilityIds).not.toContain(acquired);
  });

  it('charges Mewtwo before exchange selection and never publishes peek targets or hidden usage', () => {
    let s = draw('special-mewtwo');
    const seat = s.turnSeat,
      opponent = s.seatOrder.find((id) => id !== seat)!;
    expect(last(s).effect).toBeUndefined();
    s = apply(s, { type: 'mewtwo-target', seat: opponent, a: 1, b: 2 });
    expect(s.usedAbilityIds).toEqual(['special-mewtwo#01']);
    expect(last(s).effect).toEqual({ entrance: 'mewtwo' });
    expect(last(s).action?.targets).toEqual([]);
    expect(view(s).peek).toBeNull();
    s = apply(s, { type: 'decline-ability' });
    expect(s.phase).toBe('place');
    expect(view(s).held?.abilityUsed).toBe(true);
    expect(last(s).effect).toBeUndefined();
    expect(JSON.stringify(view(s))).not.toContain('sourceInstanceId');
    expect(JSON.stringify(view(s))).not.toContain('usedAbilityIds');
    expect(view(s).boards[opponent]![1]!.card).toBeNull();
  });

  it('never rolls or emits an entrance when drawing an exhausted Rocket', () => {
    let s = playing();
    moveToDeckTop(s, 'special-team-rocket#01');
    s.usedAbilityIds = ['special-team-rocket#01'];
    let rolls = 0;
    s = rules.apply(s, { type: 'draw', source: 'deck' }, s.turnSeat, {
      ...context(),
      random: {
        next: () => {
          rolls++;
          return 0.1;
        },
      },
    }).state as State;
    expect(rolls).toBe(0);
    expect(s.phase).toBe('place');
    expect(s.coin).toBeNull();
    expect(last(s).effect).toBeUndefined();
    expect(view(s).held?.ability).toBe('team-rocket');
    expect(view(s).held?.abilityUsed).toBe(true);
  });

  it('continues an old mid-Mew chain with no guessed source and no historical charge', () => {
    let s = draw('special-mew');
    const seat = s.turnSeat,
      opponent = s.seatOrder.find((id) => id !== seat)!;
    s = apply(s, { type: 'mew-target', seat: opponent, slot: 1 });
    const old = legacy(s),
      before = JSON.stringify(old);
    expect(rules.validateState(old, old.seatOrder)).toEqual(old);
    const next = apply(old, { type: 'replace', slot: 1 });
    expect(next.usedAbilityIds).toEqual([]);
    expect(next.pendingAbility).toBeNull();
    expect(next.phase).toBe('draw');
    expect(JSON.stringify(old)).toBe(before);
  });

  it.each(categories.filter((c) => c.ability !== null))(
    'never re-enters the exhausted $name ability',
    (category) => {
      let s = playing();
      const instance = `${category.categoryId}#01`;
      moveToDeckTop(s, instance);
      s.usedAbilityIds = [instance];
      s = apply(s, { type: 'draw', source: 'deck' });
      expect(s.phase).toBe('place');
      expect(s.pendingAbility).toBeNull();
      expect(last(s).effect).toBeUndefined();
      s = apply(s, { type: 'replace', slot: 1 });
      expect(s.phase).toBe('draw');
      expect(s.usedAbilityIds).toEqual([instance]);
      expect(last(s).effect).toBeUndefined();
      expect(() => rules.validateState(s, s.seatOrder)).not.toThrow();
    },
  );

  it.each([
    ['charizard', { type: 'peek', slot: 2 }],
    ['arceus', { type: 'activate-arceus' }],
    ['greninja', { type: 'ninja-target', seat: 's0', a: 1, b: 2, swap: true }],
    ['groudon', { type: 'row-target', seat: 's1' }],
    ['kyogre', { type: 'row-target', seat: 's1' }],
    ['rayquaza', { type: 'row-target', seat: 's1' }],
  ] as const)(
    'charges %s only on the actual effect and preserves its static scoring ability',
    (ability, action) => {
      let s = draw(`special-${ability}`);
      s = apply(s, { type: 'replace', slot: 1 });
      expect(s.usedAbilityIds).toEqual([]);
      const declined = apply(s, { type: 'decline-ability' });
      expect(declined.usedAbilityIds).toEqual([]);
      expect(last(declined).effect).toBeUndefined();
      s = apply(s, action);
      expect(s.usedAbilityIds).toEqual([`special-${ability}#01`]);
      expect(last(s).effect?.entrance).toBe(ability);
      expect(card(`special-${ability}#01`).ability).toBe(ability);
      expect(() => rules.validateState(s, s.seatOrder)).not.toThrow();
      if (ability === 'arceus' || ability === 'greninja') {
        expect(last(s).effect?.source).toEqual({ seat: 's0', slot: 1 });
        expect(JSON.stringify(last(s).effect)).not.toContain('Instance');
        const source = s.boards.s0!.find(
          (c) => c.instanceId === `special-${ability}#01`,
        )!;
        expect(source.faceUp).toBe(false);
      }
    },
  );

  it('does not consume Zapdos while choosing direction, then charges before the first pass and permits the whole chain', () => {
    let s = draw('special-zapdos');
    const seat = s.turnSeat;
    expect(last(s).effect).toEqual({ entrance: 'zapdos' });
    s = apply(s, { type: 'pass-direction', direction: 'clockwise' });
    expect(s.usedAbilityIds).toEqual([]);
    expect(last(s).effect).toBeUndefined();
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.usedAbilityIds).toEqual(['special-zapdos#01']);
    expect(s.phase).toBe('zapdos-receive');
    expect(() => rules.validateState(s, s.seatOrder)).not.toThrow();
    s = apply(s, { type: 'replace', slot: 1 }, s.recipientQueue[0]!);
    expect(s.phase).toBe('draw');
    expect(s.turnSeat).not.toBe(seat);
    expect(last(s).effect).toBeUndefined();
  });

  it.each([0.1, 0.9])(
    'charges Rocket before either coin outcome (%s) and emits only saved coin results',
    (roll) => {
      let s = playing();
      moveToDeckTop(s, 'special-team-rocket#01');
      s = rules.apply(s, { type: 'draw', source: 'deck' }, s.turnSeat, {
        ...context(),
        random: { next: () => roll },
      }).state as State;
      expect(s.usedAbilityIds).toEqual(['special-team-rocket#01']);
      expect(last(s).effect).toEqual({
        entrance: 'team-rocket',
        coin: roll < 0.5 ? 'meowth' : 'pikachu',
      });
      expect(() => rules.validateState(s, s.seatOrder)).not.toThrow();
      s = apply(s, { type: 'replace', slot: 1 });
      expect(s.usedAbilityIds).toEqual(['special-team-rocket#01']);
      expect(last(s).effect).toBeUndefined();
    },
  );

  it('records the actual discard option without inventing an entrance or exposing hidden IDs', () => {
    let s = playing();
    moveToDeckTop(s, 'ordinary-4#01');
    const outgoing = s.discard.at(-2)!;
    s.discard[s.discard.length - 2] = s.deck.at(-1)!;
    s.deck[s.deck.length - 1] = outgoing;
    s = apply(s, { type: 'draw', source: 'discard', discardIndex: 1 });
    expect(last(s).effect).toEqual({ discardIndex: 1 });
    expect(() => rules.validateState(s, s.seatOrder)).not.toThrow();
    const corrupt = structuredClone(s);
    corrupt.events.at(-1)!.effect = {
      discardIndex: 0,
      source: { seat: 's0', slot: 1 },
    };
    expect(() => rules.validateState(corrupt, s.seatOrder)).toThrow();
  });

  it('keeps consumed passive-copy scoring semantics and avoids charging cards merely revealed or moved', () => {
    const s = playing();
    expect(s.usedAbilityIds).toEqual([]);
    for (const category of categories.filter((c) => c.copy)) {
      const id = `${category.categoryId}#01`;
      moveToDeckTop(s, id);
      const held = apply(s, { type: 'draw', source: 'deck' });
      expect(held.phase).toBe('place');
      expect(view(held).held?.copy).toBe(category.copy);
      expect(view(held).held?.abilityUsed).toBe(false);
      const placed = apply(held, { type: 'replace', slot: 1 });
      expect(placed.usedAbilityIds).toEqual([]);
    }
  });

  it('continues every legacy ability phase without guessing historical usage or mutating saved bytes', () => {
    const cases: State[] = [];
    for (const category of categories.filter((c) => c.ability !== null)) {
      let s = draw(category.categoryId);
      if (s.phase === 'place') s = apply(s, { type: 'replace', slot: 1 });
      cases.push(s);
      if (s.phase === 'mew-other')
        cases.push(apply(s, { type: 'mew-target', seat: 's1', slot: 1 }));
      if (s.phase === 'mewtwo-target') {
        s = apply(s, { type: 'mewtwo-target', seat: 's1', a: 1, b: 2 });
        cases.push(
          s,
          apply(s, { type: 'decline-ability' }),
          apply(s, { type: 'mewtwo-exchange', slot: 1 }),
        );
      }
      if (s.phase === 'zapdos-direction') {
        s = apply(s, { type: 'pass-direction', direction: 'clockwise' });
        cases.push(s, apply(s, { type: 'replace', slot: 1 }));
      }
      if (s.phase === 'charizard-choice')
        cases.push(apply(s, { type: 'peek', slot: 2 }));
      if (s.phase === 'lucario-choice') {
        s = apply(s, { type: 'extra-draw' });
        cases.push(s, apply(s, { type: 'draw', source: 'deck' }));
      }
    }
    let rocket = playing();
    moveToDeckTop(rocket, 'special-team-rocket#01');
    rocket = rules.apply(
      rocket,
      { type: 'draw', source: 'deck' },
      rocket.turnSeat,
      { ...context(), random: { next: () => 0.9 } },
    ).state as State;
    cases.push(rocket);
    expect(new Set(cases.map((s) => s.phase)).size).toBe(18);
    for (const candidate of cases) {
      const old = legacy(candidate),
        originalBytes = JSON.stringify(old);
      expect(
        JSON.stringify(rules.validateState(old, old.seatOrder)),
        candidate.phase,
      ).toBe(originalBytes);
      let continued = old,
        steps = 0;
      while (
        !['draw', 'round-result', 'match-result'].includes(continued.phase) &&
        steps++ < 10
      ) {
        const decision = rules.decisions(continued)[0]!;
        continued = apply(
          continued,
          rules.legalActions(continued, decision.seatId)[0]! as Action,
          decision.seatId,
        );
        expect(continued.usedAbilityIds, candidate.phase).toEqual([]);
        expect(last(continued).effect?.source).toBeUndefined();
        expect(
          () => rules.validateState(continued, continued.seatOrder),
          candidate.phase,
        ).not.toThrow();
      }
      expect(steps, candidate.phase).toBeLessThan(10);
      expect(continued.pendingAbility).toBeNull();
      expect(JSON.stringify(old)).toBe(originalBytes);
    }
  });

  it('provides a safe legacy Lucario escape without offering discard draws or unavailable extra draws', () => {
    let choice = draw('special-lucario');
    choice = apply(choice, { type: 'replace', slot: 1 });
    // Availability-only fixture: a fully conserved board cannot naturally exhaust both sources.
    const unavailable = {
      ...choice,
      deck: [],
      discard: choice.discard.slice(-2),
    };
    expect(rules.legalActions(unavailable, unavailable.turnSeat)).toEqual([
      { type: 'decline-ability' },
    ]);
    const old = legacy({
      ...unavailable,
      phase: 'lucario-draw',
      suppressedAbility: true,
    });
    expect(rules.legalActions(old, old.turnSeat)).toEqual([
      { type: 'decline-ability' },
    ]);
    const escaped = apply(old, { type: 'decline-ability' });
    expect(escaped.phase).toBe('draw');
    expect(escaped.usedAbilityIds).toEqual([]);
    expect(escaped.pendingAbility).toBeNull();
  });

  it('rejects forged effect sources, inconsistent live sources and undeclared effect fields', () => {
    let s = draw('special-snorlax');
    s = apply(s, { type: 'replace', slot: 1 });
    const forged = structuredClone(s);
    forged.pendingAbility!.sourceInstanceId = 'special-snorlax#02';
    expect(() => rules.validateState(forged, forged.seatOrder)).toThrow();
    s = apply(s, { type: 'swap', a: 1, b: 2 });
    const event = s.events.at(-1)!;
    event.effect = { entrance: 'arceus', source: { seat: 's0', slot: 1 } };
    expect(() => rules.validateState(s, s.seatOrder)).toThrow();
    event.effect = {
      entrance: 'snorlax',
      sourceInstanceId: 'special-snorlax#01',
    } as unknown as typeof event.effect;
    expect(() => rules.validateState(s, s.seatOrder)).toThrow();
  });
});
