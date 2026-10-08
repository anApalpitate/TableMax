import type { Face, PokemonView } from '../rules/project';
import { cardArt } from '../../../assets/games/pokemon-encounters/catalog';
import { useContext } from 'react';
import { CardSkin } from './CardSkin';
import { SavedMotion, ActionTargets, EffectTargets } from './motion';
import { publicZeroColumns } from './presentation-state';
import { original } from '../variants/original';
import { topology } from '../shared/topology';
import { BoardGrid } from './BoardGrid';

export function CardFace({ card }: { card: Face | null }) {
  const art = card ? cardArt(card.categoryId) : null;
  return <CardSkin face={card} image={art?.image} frame={art?.frame} />;
}

export function Board({
  view,
  seatId,
  slots = [],
  selected = [],
  locked = false,
  select,
}: {
  view: PokemonView;
  seatId: string;
  slots?: number[];
  selected?: number[];
  locked?: boolean;
  select?(slot: number): void;
}) {
  const motion = useContext(SavedMotion);
  const targets = useContext(ActionTargets);
  const effects = useContext(EffectTargets);
  const zeroColumns = publicZeroColumns(view, seatId);
  const grid = topology(original.layout);
  const motionClass = (slotId: string) =>
    `${targets.includes(slotId) ? 'action-target' : ''} ${motion.includes(slotId) ? 'saved-motion' : ''} ${motion.includes(`reveal:${slotId}`) ? 'saved-reveal' : ''} ${motion.includes(`deal:${slotId}`) ? 'saved-deal' : ''} ${effects.slots.includes(slotId) && effects.theme ? `theme-${effects.theme}` : ''} ${effects.rocketReturns.includes(slotId) ? 'rocket-return' : ''}`;
  const contents = (
    slot: PokemonView['boards'][string][number],
    index: number,
  ) => (
    <>
      <span className="card-surface">
        <CardFace card={slot.card} />
        {effects.slots.includes(slot.slotId) && effects.theme && (
          <span className="card-theme-mark" aria-hidden="true">
            {effects.theme === 'zapdos'
              ? 'ϟ'
              : effects.theme === 'snorlax'
                ? '⇄'
                : effects.theme === 'mew'
                  ? '✧'
                  : '✦'}
          </span>
        )}
        {effects.rocketReturns.includes(slot.slotId) && (
          <>
            <span className="rocket-return-mark" aria-hidden="true">
              R
            </span>
            <span className="saved-placement-caption">
              已换入 {index + 1} 号位
            </span>
          </>
        )}
      </span>
    </>
  );
  return (
    <BoardGrid
      layout={original.layout}
      selectable={slots}
      selected={selected}
      locked={locked}
      select={select}
      markers={zeroColumns.map((column) => ({
        slots: grid.columns[column]!,
        label: '归零',
        accessibleLabel: '第 ' + (column + 1) + ' 列同值归零',
        className: 'zero-column',
      }))}
      slots={view.boards[seatId]!.map((slot, index) => ({
        id: slot.slotId,
        label:
          '位置 ' +
          (index + 1) +
          '：' +
          (slot.card
            ? slot.card.name + '，' + (slot.card.value ?? '?')
            : '暗牌'),
        className: motionClass(slot.slotId),
        content: contents(slot, index),
      }))}
    />
  );
}
