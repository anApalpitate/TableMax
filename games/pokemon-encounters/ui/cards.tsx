import type { Face, PokemonView } from '../rules/project';
import { cardArt } from '../../../assets/games/pokemon-encounters/catalog';
import { useContext, type CSSProperties } from 'react';
import { SavedMotion, ActionTargets } from './motion';

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
  const motionClass = (slotId: string) =>
    `${targets.includes(slotId) ? 'action-target' : ''} ${motion.includes(slotId) ? 'saved-motion' : ''} ${motion.includes(`reveal:${slotId}`) ? 'saved-reveal' : ''} ${motion.includes(`deal:${slotId}`) ? 'saved-deal' : ''}`;
  return (
    <div className="pokemon-board" aria-label="两行三列场地">
      {view.boards[seatId]!.map((slot, i) =>
        select ? (
          <button
            type="button"
            key={slot.slotId}
            className={`card-slot ${selected.includes(i) ? 'selected' : ''} ${motionClass(slot.slotId)}`}
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
            <CardFace card={slot.card} />
            <span className="slot-index">{i + 1}</span>
          </button>
        ) : (
          <div
            key={slot.slotId}
            className={`card-slot ${motionClass(slot.slotId)}`}
          >
            <CardFace card={slot.card} />
            <span className="slot-index">{i + 1}</span>
          </div>
        ),
      )}
    </div>
  );
}
