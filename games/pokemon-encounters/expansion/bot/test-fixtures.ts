import type { RuleContext } from '@tablemax/game-sdk';
import { card } from '../cards';
import { createInitialState, rules } from '../index';
import type { State } from '../state';

export function directPressureFixture(
  context: RuleContext,
  ability: 'greninja' | 'groudon' = 'greninja',
) {
  let state = createInitialState(context, 'events-research-v3');
  const profile = 'events-research-v3';
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state as State;
  for (const seat of context.seats)
    state = rules.apply(state, { type: 'initial-flip', slot: 0 }, seat, context)
      .state as State;
  const actor = state.turnSeat;
  const rival = context.seats.find((id) => id !== actor)!;
  state.winsBySeat[rival] = 2;
  state.boards[rival]![1]!.faceUp = true;

  const isAbility = (id: string) => card(id, profile).ability === ability;
  const revealAt = state.deck.findIndex(isAbility);
  const top = state.deck.length - 1;
  if (revealAt >= 0) {
    [state.deck[revealAt], state.deck[top]] = [
      state.deck[top]!,
      state.deck[revealAt]!,
    ];
  } else {
    const holder = Object.values(state.boards)
      .flat()
      .find(({ instanceId }) => isAbility(instanceId));
    if (!holder) throw new Error('Missing ability in fixture');
    [holder.instanceId, state.deck[top]] = [
      state.deck[top]!,
      holder.instanceId,
    ];
  }
  state = rules.apply(state, { type: 'draw', source: 'deck' }, actor, context)
    .state as State;
  state = rules.apply(state, { type: 'replace', slot: 1 }, actor, context)
    .state as State;
  if (
    state.phase !== (ability === 'greninja' ? 'greninja-choice' : 'row-choice')
  )
    throw new Error('Expected an actual targeted ability decision');
  // Give the acting side distinct natural values so covering its own cards
  // does not displace the pressure choice with an unrelated scoring gain.
  const usedValues = new Set([
    card(state.boards[actor]![1]!.instanceId, profile).value,
  ]);
  for (const slot of [0, 2, 3, 4, 5, 6, 7]) {
    const index = state.deck.findIndex((id) => {
      const face = card(id, profile);
      return (
        face.categoryId.startsWith('ordinary-') &&
        face.value !== null &&
        !face.copy &&
        !usedValues.has(face.value)
      );
    });
    if (index < 0) throw new Error('Missing distinct ordinary fixture card');
    const incoming = state.deck[index]!;
    state.deck[index] = state.boards[actor]![slot]!.instanceId;
    state.boards[actor]![slot] = { instanceId: incoming, faceUp: true };
    usedValues.add(card(incoming, profile).value);
  }
  return rules.validateState(state, context.seats) as State;
}
