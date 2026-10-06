import { expect, it } from 'vitest';
import { pokemonExpansion as rules } from '../index';
import { card } from '../cards';
import { scoreBoard } from '../scoring';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import { previewRelay } from './relay';
import { choose } from './strategy';
import { observeMemory } from './memory';

function fixture(seed = 53) {
  const context = { seats: ['a', 'b', 'c'], random: new RandomSource(seed) };
  let state = rules.initialize(context);
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  const index = state.deck.findIndex((id) => card(id).ability === 'zapdos');
  expect(index).toBeGreaterThanOrEqual(0);
  state.held = state.deck.splice(index, 1)[0]!;
  state.drawSource = 'deck';
  state.initialDone = [...context.seats];
  // This historical synthetic fixture represents a restored pre-usage chain.
  delete state.usedAbilityIds;
  delete state.pendingAbility;
  state.phase = 'zapdos-direction';
  state.turnSeat = 'b';
  if (seed === 53) {
    for (const [category, seat, slot] of [
      ['special-mew', 'b', 8],
      ['special-ditto', 'a', 4],
      ['special-zorua', 'c', 4],
    ] as const) {
      const source = state.deck.findIndex(
        (id) => card(id).categoryId === category,
      );
      expect(source).toBeGreaterThanOrEqual(0);
      [state.deck[source], state.boards[seat]![slot]!.instanceId] = [
        state.boards[seat]![slot]!.instanceId,
        state.deck[source]!,
      ];
    }
  }
  for (const seat of context.seats)
    for (const [slot, cell] of state.boards[seat]!.entries())
      cell.faceUp = slot !== 8;
  rules.validateState(state, context.seats);
  return { state, context };
}

it('chooses counterclockwise for a non-first actor when the complete relay changes the final-table value', () => {
  const { state, context } = fixture(1);
  const visibleHistory = structuredClone(state);
  for (const seat of context.seats)
    for (const cell of visibleHistory.boards[seat]!) cell.faceUp = true;
  const known = observeMemory(
    null,
    rules.project(visibleHistory, { role: 'player', seatId: 'b' }),
    'b',
    'juewu',
  );
  const view = rules.project(state, { role: 'player', seatId: 'b' });
  const memory = observeMemory(known, view, 'b', 'juewu');
  const actions = rules.legalActions(state, 'b');
  const before = structuredClone({ state, view, memory });
  const decide = (ordered: typeof actions) =>
    choose(
      view,
      ordered,
      memory,
      'juewu',
      { next: () => 0 },
      new AbortController().signal,
    );
  expect(decide(actions)).toEqual({
    type: 'pass-direction',
    direction: 'counterclockwise',
  });
  expect(decide([...actions].reverse())).toEqual(decide(actions));
  const reorderedDeck = structuredClone(state);
  reorderedDeck.deck.reverse();
  const sameView = rules.project(reorderedDeck, {
    role: 'player',
    seatId: 'b',
  });
  expect(sameView).toEqual(view);
  expect(
    choose(
      sameView,
      actions,
      memory,
      'juewu',
      { next: () => 0 },
      new AbortController().signal,
    ),
  ).toEqual(decide(actions));
  expect({ state, view, memory }).toEqual(before);
});

it.each(['clockwise', 'counterclockwise'] as const)(
  'matches every actual %s relay substep, suppresses incoming abilities, and discards the last outgoing card',
  (direction) => {
    const { state, context } = fixture();
    const directed = rules.apply(
      state,
      { type: 'pass-direction', direction },
      'b',
      context,
    ).state;
    const fields = {
      boards: Object.fromEntries(
        context.seats.map((seat) => [
          seat,
          state.boards[seat]!.map((cell) => cell.instanceId),
        ]),
      ),
      up: Object.fromEntries(
        context.seats.map((seat) => [
          seat,
          state.boards[seat]!.map((cell) => cell.faceUp),
        ]),
      ),
    };
    const before = structuredClone(fields);
    const preview = previewRelay(
      fields,
      ['b', ...directed.recipientQueue],
      state.held!,
      8,
      (board, up) => scoreBoard(board, state.activeResearch, up).total,
    );
    expect(card(preview.moves[0]!.outgoing).ability).toBe('mew');
    let current = directed;
    for (const [index, move] of preview.moves.entries()) {
      expect(current.held).toBe(move.incoming);
      expect(rules.decisions(current)[0]!.seatId).toBe(move.seat);
      current = rules.apply(
        current,
        { type: 'replace', slot: move.slot },
        move.seat,
        context,
      ).state;
      rules.validateState(current, context.seats);
      if (index < preview.moves.length - 1)
        expect(current.phase).toBe('zapdos-receive');
    }
    expect(current.held).toBeNull();
    expect(current.discard[0]).toBe(preview.discarded);
    for (const seat of context.seats)
      expect(current.boards[seat]!.map((cell) => cell.instanceId)).toEqual(
        preview.boards[seat],
      );
    expect(current.preReveal).toEqual(preview.up);
    expect(fields).toEqual(before);
  },
);

it('projects only the public remaining relay order, including non-first actors and restored intermediate steps', () => {
  const { state, context } = fixture();
  const directed = rules.apply(
    state,
    { type: 'pass-direction', direction: 'counterclockwise' },
    'b',
    context,
  ).state;
  for (const viewer of [
    { role: 'player' as const, seatId: 'b' },
    { role: 'public' as const },
    { role: 'player' as const, seatId: 'c' },
  ])
    expect(rules.project(directed, viewer)).toHaveProperty('relaySeats', [
      'a',
      'c',
    ]);
  const first = rules.apply(
    directed,
    { type: 'replace', slot: 0 },
    'b',
    context,
  ).state;
  const next = rules.apply(
    first,
    { type: 'replace', slot: 1 },
    'a',
    context,
  ).state;
  const restored = structuredClone(next);
  rules.validateState(restored, context.seats);
  expect(
    rules.project(restored, { role: 'player', seatId: 'c' }),
  ).toHaveProperty('relaySeats', ['c']);
  expect(rules.project(state, { role: 'public' })).toHaveProperty(
    'relaySeats',
    [],
  );
  const publicView = rules.project(directed, { role: 'public' });
  expect(publicView.boards.c![8]!.card).toBeNull();
  publicView.relaySeats.pop();
  expect(directed.recipientQueue).toEqual(['a', 'c']);
});
