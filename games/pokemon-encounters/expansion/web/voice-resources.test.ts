import { expect, it } from 'vitest';
import { categories } from '../cards';
import { expansionVoices } from './voice-resources';
import { expansionSoundRecipe } from './presentation';

it('maps every remaining creature to its own packaged cry while preserving user audio and Rocket', () => {
  const retained = new Set([
    'ordinary--2',
    'ordinary-0',
    'ordinary-1',
    'ordinary-3',
    'ordinary-4',
    'ordinary-7',
    'special-team-rocket',
  ]);
  expect(Object.keys(expansionVoices)).toHaveLength(27);
  for (const category of categories) {
    const source = expansionVoices[category.categoryId];
    if (retained.has(category.categoryId)) {
      expect(source).toBeUndefined();
      continue;
    }
    expect(source).toMatch(/-encyclopedia-cry-v1\.ogg$/);
    const recipe = expansionSoundRecipe(
      'draw',
      {
        actor: 'a',
        verb: 'draw',
        ability: null,
        cardCategory: category.categoryId,
        targets: [],
      },
      { coin: null, matchWinners: [] },
      false,
      expansionVoices,
    );
    expect(recipe.filter((cue) => cue.source === source)).toHaveLength(1);
  }
  for (const [category, cue] of [
    ['ordinary--2', 'pikachu'],
    ['ordinary-0', 'jigglypuff'],
    ['ordinary-1', 'eevee'],
    ['ordinary-3', 'bulbasaur'],
    ['ordinary-4', 'squirtle'],
    ['ordinary-7', 'gengar'],
  ]) {
    const recipe = expansionSoundRecipe(
      'draw',
      {
        actor: 'a',
        verb: 'draw',
        ability: null,
        cardCategory: category!,
        targets: [],
      },
      { coin: null, matchWinners: [] },
      false,
      expansionVoices,
    );
    expect(recipe).toEqual(
      expect.arrayContaining([expect.objectContaining({ cue, lane: 'cry' })]),
    );
    expect(recipe.some((entry) => entry.source)).toBe(false);
  }
  expect(
    expansionSoundRecipe(
      'draw',
      {
        actor: 'a',
        verb: 'draw',
        ability: 'team-rocket',
        cardCategory: 'special-team-rocket',
        targets: [],
      },
      { coin: 'meowth', matchWinners: [] },
      false,
      expansionVoices,
    ).map((entry) => entry.cue),
  ).toEqual(['rocket', 'meowth']);
});
