import { describe, expect, it } from 'vitest';
import { rules } from '../rules';
import { face, type PokemonView } from '../rules/project';
import { observeMemory, memoryProfiles, validateMemory } from './memory';
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';

function view(): PokemonView {
  const result = rules.project(
    rules.initialize({ seats: ['S1', 'S2'], random: { next: () => 0.4 } }),
    { role: 'player', seatId: 'S1' },
  ) as PokemonView;
  result.phase = 'charizard-view';
  result.turnSeat = 'S1';
  result.peek = { slot: 0, card: face('ordinary-9#01') };
  return result;
}
describe('saved observation version 2', () => {
  for (const difficulty of ['default', 'doubao', 'juewu'] as BotDifficulty[]) {
    it(`${difficulty} ages once per completed own turn and deduplicates observations`, () => {
      const current = view();
      let memory = observeMemory(null, current, 'S1', difficulty);
      current.peek = null;
      for (let turn = 1; turn <= 9; turn++) {
        current.phase = 'place';
        current.turnSeat = 'S1';
        memory = observeMemory(memory, current, 'S1', difficulty);
        current.events.push({
          id: turn * 2,
          kind: 'replace',
          text: '能力子步骤',
        });
        const substep = observeMemory(memory, current, 'S1', difficulty);
        expect(substep.turn).toBe(turn - 1);
        current.phase = 'draw';
        current.turnSeat = 'S2';
        current.events.push({
          id: turn * 2 + 1,
          kind: 'effect-complete',
          text: '完成普通回合',
        });
        memory = observeMemory(substep, current, 'S1', difficulty);
        expect(memory.turn).toBe(turn);
        expect(memory.cards[0]).toBe(
          turn >= memoryProfiles[difficulty].turns ? null : 'ordinary-9',
        );
        expect(observeMemory(memory, current, 'S1', difficulty)).toEqual(
          memory,
        );
      }
    });
    it(`${difficulty} limits peek capacity and public history without exposing opponent cards`, () => {
      const current = view();
      let memory: JsonValue = null;
      for (let slot = 0; slot < 6; slot++) {
        current.peek = { slot, card: face(`ordinary-${slot % 2 ? 4 : 9}#01`) };
        memory = observeMemory(memory, current, 'S1', difficulty);
      }
      const observed = observeMemory(memory, current, 'S1', difficulty);
      expect(observed.cards.filter(Boolean)).toHaveLength(
        memoryProfiles[difficulty].cards,
      );
      current.peek = null;
      for (let id = 0; id < 140; id++) {
        current.events = [
          {
            id,
            kind: 'draw',
            text: '取牌',
            action: {
              actor: 'S2',
              verb: 'draw',
              ability: null,
              cardCategory: 'ordinary-4',
              targets: [],
            },
          },
        ];
        memory = observeMemory(memory, current, 'S1', difficulty);
      }
      const bounded = observeMemory(memory, current, 'S1', difficulty);
      expect(bounded.history).toHaveLength(memoryProfiles[difficulty].history);
      expect(validateMemory(bounded)).toEqual(bounded);
    });
  }
  it('migrates legacy memory without inventing history and clears positions on a new round', () => {
    const current = view();
    current.peek = null;
    current.events = [
      {
        id: 9,
        kind: 'replace',
        text: '旧事件',
        action: {
          actor: 'S1',
          verb: 'swap',
          ability: 'special-snorlax',
          cardCategory: null,
          targets: [{ seat: 'S1', slots: [0, 1] }],
        },
      },
    ];
    const legacy = {
      version: 1,
      roundNumber: 1,
      seatId: 'S1',
      cards: ['ordinary-9', null, null, null, null, null],
    };
    const memory = observeMemory(legacy, current, 'S1');
    expect(memory.cards[0]).toBe('ordinary-9');
    expect(memory.history).toEqual([]);
    current.roundNumber = 2;
    expect(observeMemory(memory, current, 'S1').cards).toEqual(
      Array(6).fill(null),
    );
  });
});
