import type { Face, PokemonView } from '../rules/project';
import { cardArt } from '../../../assets/games/pokemon-encounters/catalog';
import { useContext, type CSSProperties } from 'react';
import { SavedMotion, ActionTargets, EffectTargets } from './motion';
import { publicZeroColumns } from './presentation-state';
import { original } from '../variants/original';
import { topology, type BoardLayout } from '../shared/topology';

export function CardFace({ card }: { card: Face | null }) {
  const art = card ? cardArt(card.categoryId) : null;
  return (
    <span
      className={`pokemon-card ${card ? 'face' : 'back'}`}
      style={art ? ({ '--card-frame': art.frame } as CSSProperties) : undefined}
      data-category={card?.categoryId}
      title={
        card
          ? `${card.name} · ${card.value ?? '?'}${card.ability ? ` · ${card.ability}` : ''}`
          : '暗牌'
      }
    >
      {card ? (
        <>
          <span className="card-heading">
            <strong className="card-value">{card.value ?? '?'}</strong>
            {card.ability && (
              <span className="ability-mark" aria-label="能力牌">
                ✦
              </span>
            )}
          </span>
          {art?.image && (
            <img
              src={art.image}
              alt=""
              draggable={false}
              width={475}
              height={475}
            />
          )}
          <span className="card-name">{card.name.replace('外观', '')}</span>
        </>
      ) : (
        <>
          <span className="pokeball-mark" aria-hidden="true" />
        </>
      )}
    </span>
  );
}
export function Board({
  view,
  seatId,
  slots = [],
  selected = [],
  locked = false,
  select,
  layout = original.layout,
}: {
  view: PokemonView;
  seatId: string;
  slots?: number[];
  selected?: number[];
  locked?: boolean;
  select?(slot: number): void;
  layout?: BoardLayout;
}) {
  const motion = useContext(SavedMotion);
  const targets = useContext(ActionTargets);
  const effects = useContext(EffectTargets);
  const zeroColumns = publicZeroColumns(view, seatId);
  const grid = topology(layout);
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
      <span className="slot-index">{index + 1}</span>
      {index < layout.columns && zeroColumns.includes(index) && (
        <span
          className="zero-column-badge"
          aria-label={`第 ${index + 1} 列公开确定为零分`}
        >
          0 分列
        </span>
      )}
    </>
  );
  return (
    <div
      className="pokemon-board"
      style={{
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
      }}
      aria-label={`${layout.rows} 行 ${layout.columns} 列场地`}
    >
      {view.boards[seatId]!.map((slot, i) =>
        select ? (
          <button
            type="button"
            key={slot.slotId}
            className={`card-slot ${selected.includes(i) ? 'selected' : ''} ${zeroColumns.includes(grid.column(i)) ? 'zero-column' : ''} ${motionClass(slot.slotId)}`}
            data-slot={slot.slotId}
            disabled={locked || !slots.includes(i)}
            aria-label={`位置 ${i + 1}：${slot.card ? `${slot.card.name}，${slot.card.value ?? '?'}` : '暗牌'}`}
            aria-pressed={selected.includes(i)}
            onClick={(event) => {
              select(i);
              const bar = document
                .querySelector('.submit-choice')
                ?.getBoundingClientRect();
              const rect = event.currentTarget.getBoundingClientRect();
              if (
                bar &&
                rect.right > bar.left &&
                rect.left < bar.right &&
                ['fixed', 'sticky'].includes(
                  getComputedStyle(document.querySelector('.submit-choice')!)
                    .position,
                ) &&
                rect.bottom > bar.top - 8
              )
                window.scrollBy({
                  top: rect.bottom - bar.top + 8,
                  behavior: 'instant',
                });
            }}
          >
            {contents(slot, i)}
          </button>
        ) : (
          <div
            key={slot.slotId}
            className={`card-slot ${zeroColumns.includes(grid.column(i)) ? 'zero-column' : ''} ${motionClass(slot.slotId)}`}
            data-slot={slot.slotId}
          >
            {contents(slot, i)}
          </div>
        ),
      )}
    </div>
  );
}
