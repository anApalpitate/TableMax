import type { Face, View } from '../project';

export type EventKind = NonNullable<View['currentEvent']>['kind'];
export const eventLabels: Record<EventKind, string> = {
  mega: 'Mega 进化',
  rain: '雨天',
  sandstorm: '沙暴',
  sun: '晴天',
  snow: '雪天',
  'trick-room': '戏法空间',
};
export const eventSummaries: Record<EventKind, string> = {
  mega: '效果待设计，本次只展示事件主题',
  rain: '场地明牌：水系 −2，火系 ＋2',
  sandstorm: '场地明牌：岩石、地面、钢系 −2，其余固定数值牌 ＋1',
  sun: '场地明牌：火系、草系 −2，水系 ＋2',
  snow: '场地明牌：原始值 ≥8 减2，≤3 加1，4–7不变',
  'trick-room': '全桌场地普通角色按固定映射互换，明暗和位置保留',
};
/** The face is already authorized; this helper never infers a hidden card. */
export function scoreEffectText(face: Pick<Face, 'scoreEffect'>) {
  const effect = face.scoreEffect;
  if (!effect) return null;
  return `${effect.inherited ? '复制继承 · ' : ''}${eventLabels[effect.kind]} ${effect.delta >= 0 ? '＋' : '−'}${Math.abs(effect.delta)}`;
}

/** Only an authorized face supplies the physical and effective role/value. */
export function roleEffectText(
  face: Pick<
    Face,
    'originalCategoryId' | 'categoryId' | 'printedValue' | 'effectiveValue'
  >,
) {
  if (!face.originalCategoryId || face.originalCategoryId === face.categoryId)
    return null;
  return `戏法空间 · 原值${face.printedValue ?? '复制'}→${face.effectiveValue ?? '复制'}`;
}
export function faceEffectText(face: Face) {
  return (
    [scoreEffectText(face), roleEffectText(face)].filter(Boolean).join('，') ||
    null
  );
}

// Explicit runtime-only allowlist: source originals and audit metadata stay local.
const files = import.meta.glob<string>(
  [
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/event-rain.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/event-sandstorm.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/event-sun.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/event-snow.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/event-trick-room.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R01.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R06.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R08.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R11.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R14.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R15.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R16.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R17.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R19.webp',
    '../../../../assets/games/pokemon-encounters/expansion/events/runtime/research-R23.webp',
  ],
  { eager: true, query: '?url', import: 'default' },
);
export function runtimePicture(name: string) {
  return files[
    `../../../../assets/games/pokemon-encounters/expansion/events/runtime/${name}.webp`
  ];
}
