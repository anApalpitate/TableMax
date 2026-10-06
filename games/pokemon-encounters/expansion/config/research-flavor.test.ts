import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import baseline from './compatibility-fixtures.json';
import research from './research.json';
import { researchDefinitions } from './research-data';
import { cardDefinitions, deckProfiles } from './card-data';
import { validateResearch } from './validation';
import { compatibilityFixture } from './compatibility-fixture';
import { tasks } from '../research';

describe('Pokémon research flavor stays separate from mechanics and saved data', () => {
  it('retains all IDs, order, pools, rewards and complete condition parameters', () => {
    const mechanics = researchDefinitions.map(
      ({ id, reward, pool, condition }) => ({ id, reward, pool, condition }),
    );
    expect(
      createHash('sha256').update(JSON.stringify(mechanics)).digest('hex'),
    ).toBe(baseline.researchMechanicsSha256);
    expect(researchDefinitions.map(({ id }) => id)).toEqual(
      baseline.researchDisplay.map(({ id }) => id),
    );
  });

  it('uses known local characters and keeps presentation out of public task objects', () => {
    const known = new Set(cardDefinitions.map(({ categoryId }) => categoryId));
    for (const definition of researchDefinitions) {
      expect(definition.presentation.flavor.trim()).not.toBe('');
      expect(definition.presentation.subjects.length).toBeGreaterThanOrEqual(1);
      expect(definition.presentation.subjects.length).toBeLessThanOrEqual(3);
      expect(
        definition.presentation.subjects.every((id) => known.has(id)),
      ).toBe(true);
      expect(
        Object.keys(tasks.find(({ id }) => id === definition.id)!).sort(),
      ).toEqual(['description', 'id', 'name', 'pool', 'reward']);
    }
  });

  it('rejects missing themes, unknown character references and excessive subjects', () => {
    const profile = deckProfiles.find(({ id }) => id === 'small')!;
    for (const mutate of [
      (value: typeof research) => {
        value.tasks[0]!.presentation.flavor = '';
      },
      (value: typeof research) => {
        value.tasks[0]!.presentation.subjects = ['ordinary-unknown'];
      },
      (value: typeof research) => {
        value.tasks[0]!.presentation.subjects = [];
      },
      (value: typeof research) => {
        value.tasks[0]!.presentation.subjects = Array(4).fill('ordinary-4');
      },
    ]) {
      const invalid = structuredClone(research);
      mutate(invalid);
      expect(() =>
        validateResearch(invalid, cardDefinitions, profile),
      ).toThrow();
    }
  });

  it('preserves historical full-trajectory hashes and restores new display strings', () => {
    const before = structuredClone(tasks);
    const expected = baseline.results[0]!;
    expect(
      compatibilityFixture(
        expected.seats,
        expected.seed,
        baseline.researchDisplay,
      ),
    ).toEqual(expected);
    expect(tasks).toEqual(before);
    expect(tasks[0]!.name).toBe('杰尼龟排排站');
  });

  it('restores presentation even when legacy comparison cannot run', () => {
    const before = structuredClone(tasks);
    expect(() =>
      compatibilityFixture(2, 701, baseline.researchDisplay.slice(1)),
    ).toThrow();
    expect(tasks).toEqual(before);
    expect(() =>
      compatibilityFixture(7, 701, baseline.researchDisplay),
    ).toThrow('Invalid expansion seats');
    expect(tasks).toEqual(before);
  });
});
