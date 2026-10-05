import { describe, expect, it } from 'vitest';
import type { PublicAction } from '@tablemax/game-sdk';
import { rules } from '../rules';
import type { State } from '../rules/state';
import { project } from '../rules/project';
import { effectScene } from './effect-scene';
import { savedMotionDuration } from './motion';

const game = project(
  rules.initialize({
    seats: ['S1', 'S2'],
    random: { next: () => 0.4 },
  }) as State,
  { role: 'public' },
);
function action(verb: PublicAction['verb'], ability: string): PublicAction {
  return { verb, ability, cardCategory: ability, actor: 'S1', targets: [] };
}
describe('committed scene boundaries', () => {
  it('retains each complete entrance while the coin landing stays independent', () => {
    for (const [category, duration] of [
      ['special-mew', 1650],
      ['special-zapdos', 1500],
      ['special-team-rocket', 1800],
    ] as const) {
      const view = structuredClone(game);
      view.coin = 'meowth';
      view.events = [
        { id: 1, kind: 'draw', text: '取牌', action: action('draw', category) },
      ];
      expect(savedMotionDuration(view)).toBe(duration);
    }
    expect(savedMotionDuration(game)).toBe(1200);
  });
  it('never promotes follow-up choices, declines or ordinary character draws to an entrance', () => {
    for (const next of [
      action('replace', 'special-mew'),
      action('zapdos-pass', 'special-zapdos'),
      action('decline', 'special-snorlax'),
      action('close-peek', 'special-charizard'),
      action('draw', 'special-charizard'),
      action('draw', 'special-snorlax'),
    ])
      expect(effectScene(next, game, false)).toBeNull();
    expect(
      effectScene(action('draw', 'special-team-rocket'), game, false),
    ).toBeNull();
  });
  it('gives a saved result priority over any simultaneous ability', () => {
    expect(
      effectScene(action('swap', 'special-snorlax'), game, true)?.theme,
    ).toBe('result');
  });
  it('expresses a public peek without a target, position or private card', () => {
    const scene = effectScene(action('peek', 'special-charizard'), game, false);
    expect(scene).toBeNull();
  });
});
