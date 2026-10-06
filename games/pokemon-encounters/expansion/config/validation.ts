import {
  abilities,
  type CardDefinition,
  type DeckProfile,
  type ResearchCondition,
  type ResearchDefinition,
} from './types';

const fail = (): never => {
  throw new Error('Invalid expansion configuration');
};
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) =>
  Object.keys(v).sort().join(',') === [...names].sort().join(',');
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
const number = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  number(v) && Number.isInteger(v) && v >= min && v <= max;
const optionalNumber = (v: unknown) => v === null || number(v);
const members = (v: unknown, max: number, empty = false): v is number[] =>
  Array.isArray(v) &&
  (empty || v.length > 0) &&
  v.every((n) => integer(n, 0, max)) &&
  new Set(v).size === v.length;
const slots = (v: unknown, empty = false) => members(v, 8, empty);
const groups = (v: unknown): v is number[][] =>
  Array.isArray(v) && v.length > 0 && v.every((g) => slots(g) && g.length >= 2);
const conditionKeys = (v: Record<string, unknown>, names: string[]) =>
  keys(v, ['type', ...names]);

export function validateCards(input: unknown): CardDefinition[] {
  if (
    !object(input) ||
    !keys(input, ['schemaVersion', 'cards']) ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.cards) ||
    !input.cards.length
  )
    return fail();
  const ids = new Set<string>();
  const active = new Set<string>();
  for (const c of input.cards) {
    if (
      !object(c) ||
      !keys(c, [
        'categoryId',
        'name',
        'value',
        'ability',
        'copy',
        'abilityText',
        'presentation',
      ]) ||
      !text(c.categoryId) ||
      !/^(ordinary|special)-[A-Za-z0-9-]+$/.test(c.categoryId) ||
      ids.has(c.categoryId) ||
      !text(c.name) ||
      !(c.value === null || integer(c.value, -100, 100)) ||
      !(c.ability === null || abilities.some((a) => a === c.ability)) ||
      ![null, 'horizontal', 'vertical'].includes(c.copy as null | string) ||
      (c.copy !== null
        ? c.value !== null || c.ability !== null
        : c.value === null) ||
      (c.ability === null
        ? c.abilityText !== null
        : !text(c.abilityText) || active.has(c.ability as string)) ||
      !object(c.presentation) ||
      !keys(c.presentation, ['creature', 'frame', 'abilitySummary']) ||
      !text(c.presentation.creature) ||
      !/^[A-Za-z][A-Za-z0-9-]*$/.test(c.presentation.creature) ||
      typeof c.presentation.frame !== 'string' ||
      !/^#[0-9a-fA-F]{6}$/.test(c.presentation.frame) ||
      typeof c.presentation.abilitySummary !== 'string' ||
      ((c.ability !== null || c.copy !== null) &&
        !text(c.presentation.abilitySummary))
    )
      return fail();
    ids.add(c.categoryId);
    if (c.ability !== null) active.add(c.ability as string);
  }
  if (abilities.some((a) => !active.has(a))) return fail();
  return input.cards as CardDefinition[];
}

export function validateDecks(
  input: unknown,
  cards: readonly CardDefinition[],
): DeckProfile[] {
  if (
    !object(input) ||
    !keys(input, ['schemaVersion', 'profiles']) ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.profiles) ||
    input.profiles.length !== 2
  )
    return fail();
  const profiles = input.profiles;
  const categoryIds = cards.map((c) => c.categoryId);
  for (const p of profiles) {
    if (
      !object(p) ||
      !keys(p, ['id', 'minSeats', 'maxSeats', 'total', 'counts']) ||
      !['small', 'standard'].includes(p.id as string) ||
      !integer(p.minSeats, 2, 6) ||
      !integer(p.maxSeats, p.minSeats, 6) ||
      !integer(p.total, 1, 1000) ||
      !object(p.counts) ||
      !keys(p.counts, categoryIds) ||
      Object.values(p.counts).some((n) => !integer(n, 1, 99)) ||
      Object.values(p.counts).reduce<number>(
        (sum, n) => sum + (n as number),
        0,
      ) !== p.total
    )
      return fail();
  }
  if (new Set(profiles.map((p) => p.id)).size !== 2) return fail();
  for (let seats = 2; seats <= 6; seats++)
    if (
      profiles.filter((p) => seats >= p.minSeats && seats <= p.maxSeats)
        .length !== 1
    )
      return fail();
  return profiles as DeckProfile[];
}

export function validateCondition(input: unknown): ResearchCondition {
  if (!object(input)) return fail();
  const c = input;
  const require = () => ['any', 'all'].includes(c.require as string);
  let valid = false;
  switch (c.type) {
    case 'zero-lines':
      valid =
        conditionKeys(c, [
          'lines',
          'require',
          'minimumValue',
          'minimumRoles',
        ]) &&
        members(c.lines, 7) &&
        require() &&
        optionalNumber(c.minimumValue) &&
        (c.minimumRoles === null || integer(c.minimumRoles, 1, 3));
      break;
    case 'equal-groups':
      valid =
        conditionKeys(c, ['groups', 'minimumValue', 'differentGroups']) &&
        groups(c.groups) &&
        optionalNumber(c.minimumValue) &&
        typeof c.differentGroups === 'boolean';
      break;
    case 'ordered-values':
      valid =
        conditionKeys(c, [
          'groups',
          'require',
          'minimumStep',
          'equalStep',
          'exactStep',
          'minimumSpan',
        ]) &&
        groups(c.groups) &&
        require() &&
        integer(c.minimumStep, 1, 200) &&
        typeof c.equalStep === 'boolean' &&
        (c.exactStep === null || integer(c.exactStep, c.minimumStep, 200)) &&
        integer(c.minimumSpan, 0, 200);
      break;
    case 'center-extreme':
      valid =
        conditionKeys(c, ['center', 'slots', 'extreme']) &&
        integer(c.center, 0, 8) &&
        slots(c.slots) &&
        !(c.slots as number[]).includes(c.center) &&
        ['minimum', 'maximum'].includes(c.extreme as string);
      break;
    case 'value-bands':
      valid =
        conditionKeys(c, ['bands']) &&
        Array.isArray(c.bands) &&
        c.bands.length > 0 &&
        c.bands.every(
          (b) =>
            object(b) &&
            keys(b, ['slots', 'minimum', 'maximum']) &&
            slots(b.slots) &&
            optionalNumber(b.minimum) &&
            optionalNumber(b.maximum) &&
            (b.minimum === null ||
              b.maximum === null ||
              (b.minimum as number) <= (b.maximum as number)),
        );
      break;
    case 'signed-line-sum':
      valid =
        conditionKeys(c, ['groups', 'sum']) &&
        groups(c.groups) &&
        number(c.sum);
      break;
    case 'equal-sums':
      valid =
        conditionKeys(c, [
          'groups',
          'minimumDistinctPerGroup',
          'distinctSlots',
          'minimumDistinctSlots',
        ]) &&
        groups(c.groups) &&
        integer(c.minimumDistinctPerGroup, 0, 9) &&
        slots(c.distinctSlots, true) &&
        integer(
          c.minimumDistinctSlots,
          0,
          (c.distinctSlots as number[]).length,
        );
      break;
    case 'distinct-values':
    case 'distinct-roles':
      valid =
        conditionKeys(c, ['slots', 'minimum']) &&
        slots(c.slots) &&
        integer(c.minimum, 1, (c.slots as number[]).length);
      break;
    case 'ordinary-only':
      valid = conditionKeys(c, ['slots']) && slots(c.slots);
      break;
    case 'required-abilities':
      valid =
        conditionKeys(c, ['abilities']) &&
        Array.isArray(c.abilities) &&
        c.abilities.length > 0 &&
        new Set(c.abilities).size === c.abilities.length &&
        c.abilities.every((a) => abilities.some((b) => b === a));
      break;
    case 'copy-in-zero-line':
      valid = conditionKeys(c, []);
      break;
    case 'hidden-zero-line':
      valid =
        conditionKeys(c, [
          'minimumFaceUp',
          'minimumFaceDown',
          'minimumHiddenInLine',
        ]) &&
        integer(c.minimumFaceUp, 0, 9) &&
        integer(c.minimumFaceDown, 0, 9) &&
        (c.minimumFaceUp as number) + (c.minimumFaceDown as number) <= 9 &&
        integer(c.minimumHiddenInLine, 1, 3);
      break;
    case 'center-rings':
      valid =
        conditionKeys(c, ['center', 'higherSlots', 'lowerSlots']) &&
        integer(c.center, 0, 8) &&
        slots(c.higherSlots) &&
        slots(c.lowerSlots) &&
        new Set([
          c.center,
          ...(c.higherSlots as number[]),
          ...(c.lowerSlots as number[]),
        ]).size ===
          1 +
            (c.higherSlots as number[]).length +
            (c.lowerSlots as number[]).length;
      break;
    case 'different-zero-values':
      valid =
        conditionKeys(c, [
          'minimumDifferent',
          'minimumHighValue',
          'negativeOutsideZero',
        ]) &&
        integer(c.minimumDifferent, 2, 8) &&
        number(c.minimumHighValue) &&
        typeof c.negativeOutsideZero === 'boolean';
      break;
  }
  return valid ? (c as ResearchCondition) : fail();
}

export function validateResearch(
  input: unknown,
  cards: readonly CardDefinition[],
  profile: DeckProfile,
): ResearchDefinition[] {
  if (
    !object(input) ||
    !keys(input, ['schemaVersion', 'tasks']) ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.tasks) ||
    !input.tasks.length
  )
    return fail();
  const instances = new Set(
    cards.flatMap((c) =>
      Array.from(
        { length: profile.counts[c.categoryId]! },
        (_, i) => `${c.categoryId}#${String(i + 1).padStart(2, '0')}`,
      ),
    ),
  );
  const ids = new Set<string>();
  for (const t of input.tasks) {
    if (
      !object(t) ||
      !keys(t, [
        'id',
        'name',
        'description',
        'reward',
        'pool',
        'condition',
        'illustrationId',
        'diagram',
        'presentation',
      ]) ||
      !text(t.id) ||
      !/^[RH]\d{2}$/.test(t.id) ||
      ids.has(t.id) ||
      !text(t.name) ||
      !text(t.description) ||
      !integer(t.reward, 1, 100) ||
      !['opening', 'hoenn'].includes(t.pool as string) ||
      (t.id.startsWith('R') ? t.pool !== 'opening' : t.pool !== 'hoenn') ||
      t.illustrationId !== t.id
    )
      return fail();
    validateCondition(t.condition);
    const p = t.presentation;
    if (
      !object(p) ||
      !keys(p, ['flavor', 'subjects']) ||
      !text(p.flavor) ||
      !Array.isArray(p.subjects) ||
      p.subjects.length < 1 ||
      p.subjects.length > 3 ||
      p.subjects.some(
        (id) =>
          typeof id !== 'string' || !cards.some((c) => c.categoryId === id),
      )
    )
      return fail();
    const d = t.diagram;
    if (
      !object(d) ||
      !keys(d, [
        'kind',
        'sample',
        'highlightSlots',
        'highlightLines',
        'arrows',
        'annotations',
        'caption',
      ]) ||
      !['lines', 'positions', 'values', 'roles', 'copy', 'visibility'].includes(
        d.kind as string,
      ) ||
      !text(d.caption) ||
      !object(d.sample) ||
      !keys(d.sample, ['instances', 'preReveal']) ||
      !Array.isArray(d.sample.instances) ||
      d.sample.instances.length !== 9 ||
      d.sample.instances.some(
        (id) => typeof id !== 'string' || !instances.has(id),
      ) ||
      new Set(d.sample.instances).size !== 9 ||
      !Array.isArray(d.sample.preReveal) ||
      d.sample.preReveal.length !== 9 ||
      d.sample.preReveal.some((v) => typeof v !== 'boolean') ||
      !slots(d.highlightSlots, true) ||
      !members(d.highlightLines, 7, true) ||
      !Array.isArray(d.arrows) ||
      d.arrows.some(
        (a) =>
          !object(a) ||
          !keys(a, ['from', 'to']) ||
          !integer(a.from, 0, 8) ||
          !integer(a.to, 0, 8) ||
          a.from === a.to,
      ) ||
      !Array.isArray(d.annotations) ||
      d.annotations.some(
        (a) =>
          !object(a) ||
          !keys(a, ['slots', 'text']) ||
          !slots(a.slots) ||
          !text(a.text),
      )
    )
      return fail();
    ids.add(t.id);
  }
  return input.tasks as ResearchDefinition[];
}
