import { topology } from '../shared/topology';
import { card, type Category } from './cards';
import type { Score } from './scoring';
import {
  researchDefinitions,
  legacyResearchDefinitions,
} from './config/research-data';
import type {
  ResearchCondition,
  ResearchDefinition,
  ResearchTask,
  RulesProfile,
} from './config/types';
export type {
  ResearchCondition,
  ResearchDefinition,
  ResearchDiagram,
  ResearchTask,
  RulesProfile,
} from './config/types';

export const grid = topology({ rows: 3, columns: 3 });
export const lines = [...grid.rows, ...grid.columns, ...grid.diagonals];
export const tasks: ResearchTask[] = researchDefinitions.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  reward: t.reward,
  pool: t.pool,
  rewardText: t.rewardText!,
  riskText: t.riskText!,
  rewardEffects: t.rewardEffects!,
  failurePenalty: t.failurePenalty!,
  successVictory: t.successVictory!,
  failureVictory: t.failureVictory!,
}));
const legacyTasks: ResearchTask[] = legacyResearchDefinitions.map(
  ({ id, name, description, reward, pool }) => ({
    id,
    name,
    description,
    reward,
    pool,
  }),
);
export const tasksForProfile = (profile: RulesProfile) =>
  profile === 'legacy' ? legacyTasks : tasks;
export const task = (
  id: string,
  profile: RulesProfile = 'research-buffer-v2',
) => {
  const found = tasksForProfile(profile).find((t) => t.id === id);
  if (!found) throw new Error('Invalid research task');
  return found;
};
export function researchDefinition(
  id: string,
  profile: RulesProfile = 'research-buffer-v2',
): ResearchDefinition {
  const found = (
    profile === 'legacy' ? legacyResearchDefinitions : researchDefinitions
  ).find((t) => t.id === id);
  if (!found) throw new Error('Invalid research task');
  return found;
}
type EvaluationContext = {
  values: Score['values'];
  matched: Score['matchedLines'];
  categories: Category[];
  score: Score;
  preReveal: readonly boolean[];
};
type Evaluators = {
  [K in ResearchCondition['type']]: (
    condition: Extract<ResearchCondition, { type: K }>,
    context: EvaluationContext,
  ) => boolean;
};
const distinct = (values: readonly number[], slots: readonly number[]) =>
  new Set(slots.map((i) => values[i])).size;
const sum = (values: readonly number[], slots: readonly number[]) =>
  slots.reduce((n, i) => n + values[i]!, 0);
const quantify = (require: 'any' | 'all', checks: boolean[]) =>
  require === 'all' ? checks.every(Boolean) : checks.some(Boolean);
export const categoryMatches = (categoryId: string, selector: string | null) =>
  selector === null ||
  selector === categoryId ||
  (selector === 'hoenn-god' &&
    ['special-groudon', 'special-kyogre', 'special-rayquaza'].includes(
      categoryId,
    ));
function evaluateCondition(
  condition: ResearchCondition,
  context: EvaluationContext,
): boolean {
  const evaluate = evaluators[condition.type] as (
    c: ResearchCondition,
    x: EvaluationContext,
  ) => boolean;
  return evaluate(condition, context);
}

/** Predicates use typed data parameters, never task IDs or executable config. */
const evaluators: Evaluators = {
  all: (c, x) => c.conditions.every((child) => evaluateCondition(child, x)),
  count: (c, x) => {
    const total = c.slots.filter(
      (i) =>
        (c.minimum === null || x.values[i]! >= c.minimum) &&
        (c.maximum === null || x.values[i]! <= c.maximum) &&
        categoryMatches(x.categories[i]!.categoryId, c.category) &&
        (c.ability === null ||
          (x.categories[i]!.ability !== null) === c.ability) &&
        (c.copy === null || (x.categories[i]!.copy !== null) === c.copy) &&
        (!c.outsideZero || !x.score.zeroSlots.includes(i)),
    ).length;
    return total >= c.atLeast && total <= c.atMost;
  },
  'zero-count': (c, x) =>
    x.matched.length >= c.minimum && x.matched.length <= c.maximum,
  'distinct-exact': (c, x) => distinct(x.values, c.slots) === c.count,
  'signed-row-balance': (c, x) =>
    c.zeroGroups.some((g, i) => {
      const others = c.zeroGroups
        .filter((_row, n) => n !== i)
        .map((row) => sum(x.values, row));
      return (
        sum(x.values, g) === 0 &&
        g.some((n) => x.values[n]! < 0) &&
        g.some((n) => x.values[n]! > 0) &&
        others.every((n) => n >= c.otherMinimum) &&
        new Set(others).size === others.length
      );
    }),
  'copy-anchors': (c, x) =>
    x.matched.some((line) => {
      const copies = x.score.copies.filter((copy) =>
        lines[line]!.includes(copy.slot),
      );
      return (
        x.values[lines[line]![0]!]! >= c.minimumValue &&
        copies.length >= c.minimumCopies &&
        new Set(
          copies.map((copy) => x.categories[copy.path.at(-1)!]!.categoryId),
        ).size >= c.minimumRoles
      );
    }),
  'visible-roles': (c, x) =>
    x.preReveal.filter(Boolean).length === c.faceUp &&
    new Set(
      x.categories
        .filter((_category, i) => x.preReveal[i])
        .map((category) => category.categoryId),
    ).size >= c.minimumRoles,
  'group-sum': (c, x) => c.groups.some((g) => sum(x.values, g) === c.sum),
  'zero-lines': (c, x) =>
    quantify(
      c.require,
      c.lines.map(
        (i) =>
          x.matched.includes(i) &&
          (c.minimumValue === null ||
            x.values[lines[i]![0]!]! >= c.minimumValue) &&
          (c.minimumRoles === null ||
            new Set(lines[i]!.map((n) => x.categories[n]!.categoryId)).size >=
              c.minimumRoles),
      ),
    ),
  'equal-groups': (c, x) =>
    c.groups.every(
      (g) =>
        g.every((i) => x.values[i] === x.values[g[0]!]) &&
        (c.minimumValue === null || x.values[g[0]!]! >= c.minimumValue),
    ) &&
    (!c.differentGroups ||
      new Set(c.groups.map((g) => x.values[g[0]!])).size === c.groups.length),
  'ordered-values': (c, x) =>
    quantify(
      c.require,
      c.groups.map((g) => {
        const steps = g
          .slice(1)
          .map((slot, i) => x.values[slot]! - x.values[g[i]!]!);
        return (
          steps.every(
            (step) =>
              step >= c.minimumStep &&
              (c.exactStep === null || step === c.exactStep),
          ) &&
          (!c.equalStep || new Set(steps).size === 1) &&
          x.values[g.at(-1)!]! - x.values[g[0]!]! >= c.minimumSpan
        );
      }),
    ),
  'center-extreme': (c, x) =>
    c.slots.every((i) =>
      c.extreme === 'minimum'
        ? x.values[i]! > x.values[c.center]!
        : x.values[i]! < x.values[c.center]!,
    ),
  'value-bands': (c, x) =>
    c.bands.every((b) =>
      b.slots.every(
        (i) =>
          (b.minimum === null || x.values[i]! >= b.minimum) &&
          (b.maximum === null || x.values[i]! <= b.maximum),
      ),
    ),
  'signed-line-sum': (c, x) =>
    c.groups.some(
      (g) =>
        sum(x.values, g) === c.sum &&
        g.some((i) => x.values[i]! < 0) &&
        g.some((i) => x.values[i]! > 0),
    ),
  'equal-sums': (c, x) =>
    new Set(c.groups.map((g) => sum(x.values, g))).size === 1 &&
    c.groups.every((g) => distinct(x.values, g) >= c.minimumDistinctPerGroup) &&
    distinct(x.values, c.distinctSlots) >= c.minimumDistinctSlots,
  'distinct-values': (c, x) => distinct(x.values, c.slots) >= c.minimum,
  'distinct-roles': (c, x) =>
    new Set(c.slots.map((i) => x.categories[i]!.categoryId)).size >= c.minimum,
  'ordinary-only': (c, x) =>
    c.slots.every((i) => x.categories[i]!.categoryId.startsWith('ordinary-')),
  'required-abilities': (c, x) =>
    c.abilities.every((a) =>
      x.categories.some((category) => category.ability === a),
    ),
  'copy-in-zero-line': (_c, x) =>
    x.score.copies.some((c) => x.score.zeroSlots.includes(c.slot)),
  'hidden-zero-line': (c, x) =>
    x.preReveal.filter(Boolean).length >= c.minimumFaceUp &&
    x.preReveal.filter((v) => !v).length >= c.minimumFaceDown &&
    x.matched.some(
      (i) =>
        lines[i]!.filter((n) => !x.preReveal[n]).length >=
        c.minimumHiddenInLine,
    ),
  'center-rings': (c, x) =>
    c.higherSlots.every((i) => x.values[i]! > x.values[c.center]!) &&
    c.lowerSlots.every((i) => x.values[i]! < x.values[c.center]!),
  'different-zero-values': (c, x) =>
    new Set(x.matched.map((i) => x.values[lines[i]![0]!])).size >=
      c.minimumDifferent &&
    x.matched.some((i) => x.values[lines[i]![0]!]! >= c.minimumHighValue) &&
    (!c.negativeOutsideZero ||
      x.values.some((v, i) => v < 0 && !x.score.zeroSlots.includes(i))),
};

export function matchesTask(
  id: string,
  board: readonly string[],
  score: Score,
  preReveal: readonly boolean[] = Array(9).fill(true),
  profile: RulesProfile = 'research-buffer-v2',
): boolean {
  const { condition } = researchDefinition(id, profile);
  return evaluateCondition(condition, {
    values: score.values,
    matched: score.matchedLines,
    categories: board.map((i) => card(i)),
    score,
    preReveal,
  });
}
