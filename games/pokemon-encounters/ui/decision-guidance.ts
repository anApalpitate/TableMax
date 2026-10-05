import type { Action } from '../rules';
import type { Face, PokemonView } from '../rules/project';
import {
  abilityGuides,
  abilityPhases,
  decisionInstructions,
} from '../variants/original-guidance';

export type AbilitySummary = {
  name: string;
  summary: string;
  trigger: string;
  chapter: string;
};

/** Receives authorized faces only. Selection is local, never a simulated successful command. */
export function decisionGuidance(
  view: PokemonView,
  actions: readonly Action[],
  selection: Action | null,
  firstSlot: number | null = null,
) {
  const active = abilityPhases[view.phase] ?? view.held?.categoryId;
  const ownSeat = view.actorSeat ?? view.turnSeat;
  const summary = (
    card: Face | null | undefined,
    category = card?.categoryId,
    moved = false,
  ): AbilitySummary | null => {
    const guide = category ? abilityGuides[category] : undefined;
    if (!guide) return null;
    const trigger =
      guide.trigger === 'scoring'
        ? '结算自动'
        : moved
          ? '此次不触发'
          : view.phase === 'charizard-view'
            ? '本人私看'
            : guide.trigger === 'required'
              ? '必须执行'
              : view.phase === 'place'
                ? '换入后可选'
                : '可不发动';
    const name =
      card?.name ??
      (
        {
          'special-mew': '梦幻',
          'special-team-rocket': '火箭队',
          'special-zapdos': '闪电鸟',
          'special-snorlax': '卡比兽',
          'special-charizard': '喷火龙',
        } as Record<string, string>
      )[category!] ??
      '百变怪';
    return { name, summary: guide.summary, trigger, chapter: guide.chapter };
  };
  const ability = summary(
    view.held?.categoryId === active ? view.held : null,
    active,
  );
  const positions =
    selection?.type === 'mew-target'
      ? [{ seat: selection.seat, slot: selection.slot }]
      : selection?.type === 'swap'
        ? [
            { seat: ownSeat, slot: selection.a },
            { seat: ownSeat, slot: selection.b },
          ]
        : selection && 'slot' in selection
          ? [{ seat: ownSeat, slot: selection.slot }]
          : firstSlot !== null
            ? [{ seat: ownSeat, slot: firstSlot }]
            : [];
  const target =
    positions
      .flatMap(({ seat, slot }) => {
        const card = view.boards[seat]?.[slot]?.card;
        return card && card.categoryId !== active
          ? [summary(card, card.categoryId, true)]
          : [];
      })
      .find((item) => item !== null) ??
    (view.held && view.held.categoryId !== active
      ? summary(view.held, view.held.categoryId, true)
      : null);
  let instruction = decisionInstructions[view.phase] ?? '按当前步骤完成操作。';
  if (view.phase === 'place')
    instruction = actions.some((action) => action.type === 'discard-held')
      ? '可换入一格或弃掉；换入牌朝上，换出的牌公开弃掉。'
      : '弃牌顶取到的牌必须换入；换出的牌公开弃掉。';
  const endsRound =
    view.phase === 'place' &&
    selection?.type === 'replace' &&
    view.boards[ownSeat]?.filter((slot) => !slot.faceUp).length === 1 &&
    !view.boards[ownSeat]?.[selection.slot]?.faceUp;
  const notice = endsRound
    ? '这次换入会让你的牌全明；能力处理完后立即结算。'
    : abilityPhases[view.phase]
      ? '完整能力处理后，才检查是否有人全明并结算。'
      : null;
  return { instruction, ability, target, notice };
}
