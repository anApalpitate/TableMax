import { describe, expect, it } from 'vitest';
import type { PublicAction } from '@tablemax/game-sdk';
import {
  startedAbility,
  expansionSoundRecipe,
  savedBoardEffects,
  expansionThemeFor,
  presentationCreature,
  ordinaryTheme,
  presentationTiming,
} from './presentation';
const action = (
  verb: string,
  ability: string | null = 'mewtwo',
  cardCategory: string | null = 'special-mewtwo',
): PublicAction => ({ actor: 'S1', verb, ability, cardCategory, targets: [] });
describe('expansion committed presentation', () => {
  it('orders the saved last ability, board changes, research and settlement without delaying rules', () => {
    const saved = {
      ...action('activate-arceus', 'arceus', 'special-arceus'),
      targets: [{ seat: 'S1', slots: [0, 1, 2, 3, 4, 5, 6, 7, 8] }],
    };
    expect(
      presentationTiming(
        [
          { kind: 'action', action: saved },
          { kind: 'research' },
          { kind: 'round-result' },
        ],
        { arceus: 1750 },
      ),
    ).toEqual({
      creature: 'arceus',
      abilityMs: 1750,
      boardMs: 650,
      researchDelayMs: 2400,
      resultDelayMs: 4900,
    });
    expect(
      presentationTiming([{ kind: 'round-result' }], {}).resultDelayMs,
    ).toBe(0);
    expect(presentationTiming([{ kind: 'research' }], {}).resultDelayMs).toBe(
      0,
    );
    expect(
      presentationTiming(
        [{ kind: 'action', action: action('mewtwo-target') }],
        { mewtwo: 1650 },
      ).abilityMs,
    ).toBe(0);
  });
  it('uses copy poses only for their public saved placement, without pretending a copy is an active ability', () => {
    expect(presentationCreature(action('replace', null, 'special-ditto'))).toBe(
      'ditto',
    );
    expect(presentationCreature(action('replace', null, 'special-zorua'))).toBe(
      'zorua',
    );
    for (const verb of ['draw', 'peek', 'mewtwo-target', 'decline-ability'])
      expect(
        presentationCreature(action(verb, null, 'special-ditto')),
      ).toBeNull();
    expect(presentationCreature(action('mewtwo-exchange'))).toBe('mewtwo');
  });
  it('uses distinct ordinary themes only for new saved public draws, never from hidden positions', () => {
    const themes = [
      'togepi',
      'magikarp',
      'piplup',
      'rowlet',
      'psyduck',
      'garchomp',
      'gardevoir',
      'dragonite',
      'metagross',
      'mimikyu',
    ];
    for (const theme of themes) {
      expect(ordinaryTheme(action('draw', null, `ordinary-${theme}`))).toBe(
        theme,
      );
      for (const verb of ['peek', 'replace', 'initial-flip', 'close-peek'])
        expect(
          ordinaryTheme(action(verb, null, `ordinary-${theme}`)),
        ).toBeNull();
    }
    expect(ordinaryTheme(action('draw', null, 'ordinary--2'))).toBeNull();
    expect(ordinaryTheme(undefined)).toBeNull();
  });
  it('plays a variant cry once for a public draw, without replaying it for private or later steps', () => {
    const voices = { 'special-mewtwo': '/local/mewtwo.ogg' };
    const game = { coin: null, matchWinners: [] };
    expect(
      expansionSoundRecipe('draw', action('draw'), game, false, voices),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lane: 'effect', cue: 'draw' }),
        expect.objectContaining({
          lane: 'cry',
          source: voices['special-mewtwo'],
        }),
      ]),
    );
    for (const verb of [
      'replace',
      'mewtwo-target',
      'mewtwo-exchange',
      'close-peek',
      'decline-ability',
    ])
      expect(
        expansionSoundRecipe(
          'action',
          action(verb),
          game,
          false,
          voices,
        ).filter((cue) => cue.source),
      ).toEqual([]);
    expect(
      expansionSoundRecipe(
        'draw',
        action('draw', null, 'unknown'),
        game,
        false,
        voices,
      ).filter((cue) => cue.source),
    ).toEqual([]);
    expect(
      expansionSoundRecipe('draw', action('draw'), game, true, voices).filter(
        (cue) => cue.source,
      ),
    ).toHaveLength(1);
  });
  it('uses original expansion themes only for saved activated abilities and research', () => {
    expect(
      expansionThemeFor('action', action('mewtwo-exchange'), 'effect-complete'),
    ).toBe('mewtwo');
    expect(
      expansionThemeFor(
        'action',
        action('row-target', 'kyogre'),
        'effect-complete',
      ),
    ).toBe('kyogre');
    expect(expansionThemeFor('research', undefined, 'effect-complete')).toBe(
      'research',
    );
    for (const verb of ['draw', 'peek', 'mewtwo-target', 'decline-ability'])
      expect(
        expansionThemeFor('action', action(verb), 'effect-complete'),
      ).toBeNull();
    expect(
      expansionThemeFor('action', action('mewtwo-exchange'), 'draw'),
    ).toBeNull();
  });
  it('draws three row exchanges without changing their column positions', () => {
    const result = savedBoardEffects({
      ...action('row-target', 'groudon'),
      targets: [{ seat: 'S2', slots: [6, 7, 8] }],
    });
    expect(result.moves).toEqual(
      [6, 7, 8].map((slot) => ({ from: `S1:${slot}`, to: `S2:${slot}` })),
    );
    expect(result.cover).toEqual([]);
  });
  it('keeps cover-only ninja targets in place and swaps only the saved swap branch', () => {
    const targets = [{ seat: 'S2', slots: [2, 8] }];
    expect(
      savedBoardEffects({ ...action('ninja-cover', 'greninja'), targets }),
    ).toEqual({ moves: [], cover: ['S2:2', 'S2:8'], reveal: [], pulse: [] });
    expect(
      savedBoardEffects({ ...action('ninja-swap', 'greninja'), targets }).moves,
    ).toEqual([{ from: 'S2:2', to: 'S2:8' }]);
  });
  it('never manufactures private targets or movements from ability names', () => {
    for (const verb of [
      'peek',
      'mewtwo-target',
      'close-peek',
      'decline-ability',
      'pass-direction',
    ])
      expect(
        savedBoardEffects({
          ...action(verb),
          targets: [{ seat: 'S2', slots: [1, 3] }],
        }),
      ).toEqual({ moves: [], cover: [], reveal: [], pulse: [] });
    expect(
      savedBoardEffects({
        ...action('reposition', null),
        targets: [{ seat: 'S1', slots: [0, 8] }],
      }).moves,
    ).toEqual([{ from: 'S1:0', to: 'S1:8' }]);
  });
  it('shows Arceus cover and only its authorized random face-up cells', () => {
    const targets = ['S1', 'S2'].map((seat) => ({
      seat,
      slots: Array.from({ length: 9 }, (_, i) => i),
    }));
    const boards = {
      S1: targets[0]!.slots.map((i) => ({
        slotId: `S1:${i}`,
        faceUp: i === 3,
      })),
      S2: targets[1]!.slots.map((i) => ({
        slotId: `S2:${i}`,
        faceUp: i === 6,
      })),
    };
    const result = savedBoardEffects(
      { ...action('activate-arceus', 'arceus'), targets },
      boards,
    );
    expect(result.moves).toEqual([]);
    expect(result.cover).toHaveLength(18);
    expect(result.reveal).toEqual(['S1:3', 'S2:6']);
  });
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
