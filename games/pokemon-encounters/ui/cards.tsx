import type { Face, PokemonView } from '../rules/project';
import back from '../assets/card-back-v1.webp';
import { useContext } from 'react';
import { SavedMotion } from './motion';

const images = import.meta.glob<string>('../assets/face/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
export function CardFace({ card }: { card: Face | null }) {
  const image = card
    ? images[`../assets/face/${card.categoryId}-v1.webp`]
    : back;
  return (
    <span
      className={`pokemon-card ${card ? 'face' : 'back'}`}
      title={
        card
          ? `${card.name} · ${card.value ?? '?'}${card.ability ? ` · ${card.ability}` : ''}`
          : '暗牌'
      }
    >
      {image && <img src={image} alt="" draggable={false} />}
      {card ? (
        <>
          <strong className="card-value">{card.value ?? '?'}</strong>
          <span className="card-name">{card.name.replace('外观', '')}</span>
          {card.ability && (
            <span className="ability-mark" aria-label="能力牌">
              ✦
            </span>
          )}
        </>
      ) : (
        <span className="back-label">TableMax</span>
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
  return (
    <div className="pokemon-board" aria-label="两行三列场地">
      {view.boards[seatId]!.map((slot, i) =>
        select ? (
          <button
            type="button"
            key={slot.slotId}
            className={`card-slot ${selected.includes(i) ? 'selected' : ''} ${motion.includes(slot.slotId) ? 'saved-motion' : ''}`}
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
            className={`card-slot ${motion.includes(slot.slotId) ? 'saved-motion' : ''}`}
          >
            <CardFace card={slot.card} />
            <span className="slot-index">{i + 1}</span>
          </div>
        ),
      )}
    </div>
  );
}
