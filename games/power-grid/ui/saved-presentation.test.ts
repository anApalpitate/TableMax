import { describe, expect, it } from 'vitest';
import type { RoomFeedback } from '../../../packages/protocol/src';
import { rules } from '../rules';
import type { PowerGridView } from '../types';
import { classifySaved, soundAllowed } from './saved-presentation';

function view() {
  const state = rules.initialize({
    seats: ['a', 'b', 'c'],
    random: { next: () => 0.3 },
  });
  return rules.project(state, { role: 'public' }) as PowerGridView;
}
function feedback(verbs: string[]): RoomFeedback {
  return {
    instanceId: '00000000-0000-4000-8000-000000000001',
    branch: 0,
    revision: 2,
    events: verbs.map((verb) => ({
      kind: verb === 'end' ? 'game-ended' : 'effect-complete',
      text: verb,
      action: {
        actor: 'a',
        verb,
        cardCategory: null,
        ability: null,
        targets: [],
      },
    })),
  };
}
describe('Power Grid saved presentation', () => {
  it('prioritizes actual purchase, supply and ending in compound saved results', () => {
    const game = view();
    expect(
      classifySaved(feedback(['pass', 'purchase-plant']), game, game)?.theme,
    ).toBe('purchase-plant');
    expect(
      classifySaved(feedback(['supply', 'round']), game, game)?.theme,
    ).toBe('supply');
    expect(
      classifySaved(feedback(['supply', 'round', 'end']), game, game)?.theme,
    ).toBe('end');
  });
  it('distinguishes pending third step from saved activation, including direct first to third', () => {
    const before = view(),
      pending = { ...before, step3Pending: true };
    expect(classifySaved(feedback(['bid']), pending, before)?.theme).toBe(
      'bid',
    );
    const third = { ...pending, step: 3 as const };
    const result = classifySaved(feedback(['supply', 'round']), third, before)!;
    expect(result.theme).toBe('step');
    expect(result.text).toContain('supply');
    expect(classifySaved(feedback(['round']), third, null)?.theme).toBe(
      'round',
    );
  });
  it('limits repetitive audio without dropping saved visual results or interrupting major cues', () => {
    const game = view();
    const bid = classifySaved(feedback(['bid']), game, game)!;
    const fuel = classifySaved(feedback(['buy-resource']), game, game)!;
    const end = classifySaved(feedback(['end']), game, game)!;
    expect(bid.major).toBe(false);
    expect(fuel.major).toBe(false);
    expect(end.major).toBe(true);
    const ordinary = { time: 1000, until: 1350, priority: bid.priority };
    expect(soundAllowed(ordinary, bid, 1499)).toBe(false);
    expect(soundAllowed(ordinary, bid, 1500)).toBe(true);
    expect(soundAllowed(ordinary, fuel, 1649)).toBe(false);
    expect(soundAllowed(ordinary, fuel, 1650)).toBe(true);
    expect(
      soundAllowed(
        { time: 1000, until: 1900, priority: end.priority },
        fuel,
        1800,
      ),
    ).toBe(false);
    expect(soundAllowed(ordinary, end, 1100)).toBe(true);
  });
  it('uses structured public targets and does not mutate or expose private draft/cash', () => {
    const game = view();
    game.history = [
      {
        id: 'log2',
        actor: 'a',
        verb: 'build',
        plantId: null,
        cityId: 'essen',
        resource: null,
        amount: 10,
        text: '建设埃森',
      },
    ];
    const before = JSON.stringify(game);
    const result = classifySaved(feedback(['build']), game, game)!;
    expect(result.cityId).toBe('essen');
    expect(result).not.toHaveProperty('cash');
    expect(JSON.stringify(game)).toBe(before);
  });
});
