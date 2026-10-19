import { describe, expect, it } from 'vitest';
import { abilityMark } from './ability-mark';
import { categories as originalCategories } from '../rules/cards';
import { categoriesForProfile } from '../expansion/cards';
import { face as originalFace } from '../rules/project';
import { face as expansionFace } from '../expansion/project';

describe('authorized card ability symbols', () => {
  it('distinguishes original mandatory, optional and passive definitions', () => {
    for (const category of originalCategories) {
      const mark = abilityMark(originalFace(`${category.categoryId}#01`));
      const mode = category.abilityDefinition?.mode;
      expect(mark?.kind ?? null).toBe(
        mode === 'optional' ? 'optional' : mode ? 'mandatory' : null,
      );
    }
    expect(abilityMark(originalFace('special-ditto#01'))?.label).toBe(
      '被动复制能力',
    );
  });
  it('uses the mixed symbol for Mewtwo, keeps passive copies unmarked and hides used abilities', () => {
    const mandatory = ['special-mew', 'special-team-rocket', 'special-zapdos'];
    for (const category of categoriesForProfile('events-research-v3')) {
      const face = expansionFace(
        `${category.categoryId}#01`,
        false,
        'events-research-v3',
      );
      const mark = abilityMark(face);
      expect(mark?.kind ?? null).toBe(
        !category.ability
          ? null
          : category.categoryId === 'special-mewtwo'
            ? 'mixed'
            : mandatory.includes(category.categoryId)
              ? 'mandatory'
              : 'optional',
      );
      expect(abilityMark({ ...face, abilityUsed: true })).toBeNull();
    }
    expect(abilityMark(null)).toBeNull();
  });
});
