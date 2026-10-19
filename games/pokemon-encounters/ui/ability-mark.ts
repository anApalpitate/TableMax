export type AbilityMarkKind = 'mandatory' | 'optional' | 'mixed';

const optional = new Set([
  'special-charizard',
  'special-snorlax',
  'special-arceus',
  'special-greninja',
  'special-lucario',
  'special-groudon',
  'special-kyogre',
  'special-rayquaza',
]);

/** Called only with an authorized face, including its public usage mark. */
export function abilityMark(
  face: {
    categoryId: string;
    ability: unknown;
    abilityUsed?: boolean;
  } | null,
): { kind: AbilityMarkKind; label: string } | null {
  if (!face?.ability || face.abilityUsed) return null;
  if (face.categoryId === 'special-ditto')
    return { kind: 'mandatory', label: '被动复制能力' };
  if (face.categoryId === 'special-mewtwo')
    return { kind: 'mixed', label: '先私看，再选择交换或放弃' };
  return optional.has(face.categoryId)
    ? { kind: 'optional', label: '可选择发动的能力' }
    : { kind: 'mandatory', label: '必须发动的能力' };
}
