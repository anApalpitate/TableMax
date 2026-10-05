import { describe, expect, it } from 'vitest';
import type { PublicAction } from '@tablemax/game-sdk';
import { startedAbility, expansionSoundRecipe } from './presentation';
const action = (
  verb: string,
  ability: string | null = 'mewtwo',
  cardCategory: string | null = 'special-mewtwo',
): PublicAction => ({ actor: 'S1', verb, ability, cardCategory, targets: [] });
describe('expansion committed presentation', () => {
  it('maps expansion action events to ordinary swap and discard feedback', () => {
    const game = { coin: null, matchWinners: [] };
    for (const verb of ['replace', 'discard-held'])
      expect(
        expansionSoundRecipe('action', action(verb, null), game, false).map(
          ({ cue }) => cue,
        ),
      ).toEqual(['replace']);
    expect(
      expansionSoundRecipe('action', action('reposition', null), game, false)[0]
        ?.cue,
    ).toBe('effect-complete');
  });
  it('does not enter optional abilities on drawing, looking or declining', () => {
    for (const verb of [
      'draw',
      'mewtwo-target',
      'decline-ability',
      'close-peek',
      'replace',
      'discard-held',
    ])
      expect(startedAbility(action(verb))).toBeNull();
    expect(startedAbility(action('mewtwo-exchange'))).toBe('mewtwo');
    expect(startedAbility(action('activate-arceus', 'arceus'))).toBe('arceus');
  });
  it('enters a relay once, never on each subsequent handoff', () => {
    expect(startedAbility(action('pass-direction', 'zapdos'))).toBe('zapdos');
    for (const verb of ['replace', 'draw', 'discard-held'])
      expect(
        startedAbility(action(verb, 'zapdos', 'special-zapdos')),
      ).toBeNull();
    expect(startedAbility(action('draw', null, 'special-team-rocket'))).toBe(
      'team-rocket',
    );
  });
  it('uses two existing sound lanes and gives saved final results priority', () => {
    const game = { coin: 'pikachu' as const, matchWinners: ['S1'] };
    const rocket = expansionSoundRecipe(
      'draw',
      action('draw', null, 'special-team-rocket'),
      game,
      false,
    );
    expect(
      rocket.map(({ cue, lane, delayMs }) => ({ cue, lane, delayMs })),
    ).toEqual([
      { cue: 'rocket', lane: 'effect', delayMs: 0 },
      { cue: 'pikachu', lane: 'cry', delayMs: 1200 },
    ]);
    expect(
      expansionSoundRecipe(
        'round-result',
        action('activate-arceus', 'arceus'),
        game,
        false,
      ).map(({ cue }) => cue),
    ).toEqual(['match-result']);
    expect(
      expansionSoundRecipe('action', action('decline-ability'), game, false),
    ).toEqual([]);
    expect(
      expansionSoundRecipe('action', action('mewtwo-exchange'), game, false)[0]
        ?.cue,
    ).toBe('effect-complete');
  });
});
