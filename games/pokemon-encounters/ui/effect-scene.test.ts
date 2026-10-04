import { describe, expect, it } from 'vitest';
import type { PublicAction } from '../../../packages/protocol/src';
import { rules } from '../rules';
import type { State } from '../rules/state';
import { project } from '../rules/project';
import { effectScene } from './effect-scene';

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
    expect(scene).toEqual({ theme: 'charizard', duration: 650 });
    expect(Object.keys(scene!)).toEqual(['theme', 'duration']);
  });
});
