import type { BotStrategy } from '@tablemax/game-sdk';
import type { PokemonView } from '../rules/project';
import type { Action } from '../rules';

export const bot: BotStrategy = {
  id: 'pokemon-encounters/basic',
  version: '1',
  gameId: 'pokemon-encounters',
  rulesVersion: 'tablemax-cn-s19-v1',
  validateMemory(input) {
    if (input !== null) throw new Error('Invalid strategy memory');
    return null;
  },
  async decide({ view: input, actions: raw, decision, signal, memory }) {
    if (signal.aborted) throw new Error('Aborted');
    bot.validateMemory(memory);
    const view = input as PokemonView;
    const actions = raw as readonly Action[];
    if (!actions.length) throw new Error('No legal choice');
    const own = view.boards[decision.seatId]!;
    const priority = (slot: number) =>
      own[slot]!.faceUp ? 100 - (own[slot]!.card?.value ?? -100) : slot;
    let action: Action | undefined;
    if (view.phase === 'initial-flip')
      action = actions.find((a) => a.type === 'initial-flip');
    else if (view.phase === 'draw')
      action = actions.find((a) => a.type === 'draw' && a.source === 'deck');
    else if (view.phase === 'mew-other') {
      const start = view.seatOrder.indexOf(decision.seatId);
      const other = view.seatOrder[(start + 1) % view.seatOrder.length]!;
      const candidates = actions.filter(
        (a): a is Extract<Action, { type: 'mew-target' }> =>
          a.type === 'mew-target' && a.seat === other,
      );
      candidates.sort(
        (a, b) =>
          (view.boards[other]![a.slot]!.faceUp ? 10 + a.slot : a.slot) -
          (view.boards[other]![b.slot]!.faceUp ? 10 + b.slot : b.slot),
      );
      action = candidates[0];
    } else if (view.phase === 'snorlax-choice')
      action = actions.find((a) => a.type === 'decline-ability');
    else if (view.phase === 'charizard-choice')
      action = actions.find((a) => a.type === 'peek');
    else if (view.phase === 'charizard-view')
      action = actions.find((a) => a.type === 'close-peek');
    else {
      const candidates = actions.filter(
        (
          a,
        ): a is Extract<
          Action,
          { type: 'replace' | 'initial-flip' | 'peek' }
        > => a.type === 'replace',
      );
      candidates.sort(
        (a, b) =>
          (view.phase === 'rocket-pikachu'
            ? (own[a.slot]!.faceUp ? 10 + a.slot : a.slot) -
              (own[b.slot]!.faceUp ? 10 + b.slot : b.slot)
            : priority(a.slot) - priority(b.slot)) || a.slot - b.slot,
      );
      action = candidates[0];
    }
    return { action: action ?? actions[0]!, memory: null };
  },
};
