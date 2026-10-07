import { describe, expect, it } from 'vitest';
import cardsJson from './cards.json';
import decksJson from './decks.json';
import researchJson from './research.json';
import baseline from './ability-policy-fixtures.json';
import { cardDefinitions, deckProfiles } from './card-data';
import {
  validateCards,
  validateCondition,
  validateDecks,
  validateResearch,
} from './validation';
import { categories, categoryPresentation, instancesForSeats } from '../cards';
import { matchesTask, researchDefinition, tasks } from '../research';
import { scoreBoard } from '../scoring';
import { compatibilityFixture } from './compatibility-fixture';

describe('independent expansion configuration', () => {
  it('retains the public task/card shapes while all 34 presentations are complete', () => {
    expect(categories).toHaveLength(34);
    expect(tasks).toHaveLength(30);
    expect(tasks.filter((t) => t.pool === 'opening')).toHaveLength(24);
    expect(tasks.filter((t) => t.pool === 'hoenn')).toHaveLength(6);
    for (const c of categories) {
      expect(Object.keys(c).sort()).toEqual([
        'ability',
        'categoryId',
        'copy',
        'name',
        'small',
        'standard',
        'value',
      ]);
      const p = categoryPresentation(c.categoryId);
      expect(p.creature).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/);
      expect(p.frame).toMatch(/^#[a-fA-F0-9]{6}$/);
      expect(Boolean(p.abilitySummary)).toBe(Boolean(c.ability || c.copy));
    }
    for (const t of tasks)
      expect(Object.keys(t).sort()).toEqual([
        'description',
        'failurePenalty',
        'failureVictory',
        'id',
        'name',
        'pool',
        'reward',
        'rewardEffects',
        'rewardText',
        'riskText',
        'successVictory',
      ]);
    expect(categoryPresentation('special-rayquaza').abilitySummary).toBe(
      '顶行交换',
    );
    expect(categoryPresentation('special-kyogre').abilitySummary).toBe(
      '中行交换',
    );
    expect(categoryPresentation('special-groudon').abilitySummary).toBe(
      '底行交换',
    );
    expect(() => categoryPresentation('unknown')).toThrow();
    expect(() => researchDefinition('R99')).toThrow();
  });

  for (const t of tasks)
    it(`${t.id} diagram uses unique real cards and passes its authoritative predicate`, () => {
      const definition = researchDefinition(t.id);
      const { instances, preReveal } = definition.diagram.sample;
      const available = new Set(instancesForSeats(2));
      expect(instances).toHaveLength(9);
      expect(new Set(instances).size).toBe(9);
      expect(instances.every((id) => available.has(id))).toBe(true);
      const score = scoreBoard(instances, [t.id], preReveal);
      expect(matchesTask(t.id, instances, score, preReveal)).toBe(true);
      expect(score.research[0]).toMatchObject({
        taskId: t.id,
        achieved: true,
        title: `${t.name}研究达成`,
      });
      expect(score.research[0]!.deduction).toBe(
        -score.research[0]!.effects!.reduce(
          (sum, effect) => sum + effect.adjustment,
          0,
        ),
      );
      expect(score.total).toBe(score.base - score.deduction);
      expect(definition.illustrationId).toBe(t.id);
      if (['lines', 'copy', 'visibility'].includes(definition.diagram.kind))
        expect(
          definition.diagram.highlightLines.every((line) =>
            score.matchedLines.includes(line),
          ),
        ).toBe(true);
    });

  it('parameter changes reach the registered predicate, including thresholds and distinctness', () => {
    const definition = researchDefinition('R06', 'legacy');
    const before = structuredClone(definition.condition);
    try {
      if (definition.condition.type !== 'zero-lines')
        throw new Error('Invalid fixture type');
      const { instances, preReveal } = definition.diagram.sample;
      const score = scoreBoard(instances, [], preReveal, 'legacy');
      definition.condition.minimumValue = 11;
      expect(matchesTask('R06', instances, score, preReveal, 'legacy')).toBe(
        false,
      );
      definition.condition.minimumValue = 10;
      expect(matchesTask('R06', instances, score, preReveal, 'legacy')).toBe(
        true,
      );
      definition.condition.minimumRoles = 3;
      expect(matchesTask('R06', instances, score, preReveal, 'legacy')).toBe(
        false,
      );
    } finally {
      definition.condition = before;
    }
  });

  it('rejects malformed card identities, incomplete presentations and overlapping deck profiles', () => {
    const duplicate = structuredClone(cardsJson);
    duplicate.cards[1]!.categoryId = duplicate.cards[0]!.categoryId;
    expect(() => validateCards(duplicate)).toThrow();
    const missing = structuredClone(cardsJson);
    missing.cards.at(-1)!.presentation.abilitySummary = '';
    expect(() => validateCards(missing)).toThrow();
    const quantity = structuredClone(decksJson);
    quantity.profiles[0]!.counts['ordinary--2']++;
    expect(() => validateDecks(quantity, cardDefinitions)).toThrow();
    const overlap = structuredClone(decksJson);
    overlap.profiles[1]!.minSeats = 3;
    expect(() => validateDecks(overlap, cardDefinitions)).toThrow();
  });

  it('rejects unknown predicates and out-of-board parameters', () => {
    expect(() =>
      validateCondition({ type: 'execute', script: 'return true' }),
    ).toThrow();
    expect(() =>
      validateCondition({ type: 'ordinary-only', slots: [9] }),
    ).toThrow();
    expect(() =>
      validateCondition({
        type: 'zero-lines',
        lines: [8],
        require: 'any',
        minimumValue: null,
        minimumRoles: null,
      }),
    ).toThrow();
    expect(() =>
      validateCondition({
        type: 'value-bands',
        bands: [{ slots: [0], minimum: 8, maximum: 3 }],
      }),
    ).toThrow();
    expect(() =>
      validateCondition({
        type: 'center-rings',
        center: 4,
        higherSlots: [4],
        lowerSlots: [0],
      }),
    ).toThrow();
  });

  it('rejects physically impossible diagram samples and mismatched task/illustration identities', () => {
    const profile = deckProfiles.find((p) => p.id === 'small')!;
    const duplicate = structuredClone(researchJson);
    duplicate.tasks[0]!.diagram.sample.instances[1] =
      duplicate.tasks[0]!.diagram.sample.instances[0]!;
    expect(() =>
      validateResearch(duplicate, cardDefinitions, profile),
    ).toThrow();
    const unavailable = structuredClone(researchJson);
    unavailable.tasks[0]!.diagram.sample.instances[0] = 'special-arceus#02';
    expect(() =>
      validateResearch(unavailable, cardDefinitions, profile),
    ).toThrow();
    const identity = structuredClone(researchJson);
    identity.tasks[0]!.illustrationId = 'H01';
    expect(() =>
      validateResearch(identity, cardDefinitions, profile),
    ).toThrow();
    const reveal = structuredClone(researchJson);
    reveal.tasks[0]!.diagram.sample.preReveal.pop();
    expect(() => validateResearch(reveal, cardDefinitions, profile)).toThrow();
  });
});

describe('2026-10-07 ability-policy seeded state, projection and RNG replay', () => {
  for (const expected of baseline.results)
    it(`${expected.seats} players, seed ${expected.seed}, saved-state/branch replay`, () => {
      expect(
        compatibilityFixture(
          expected.seats,
          expected.seed,
          baseline.researchDisplay,
        ),
      ).toEqual(expected);
    });
});
