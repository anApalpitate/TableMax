import type { ReactNode } from 'react';
import { topology, type BoardLayout } from '../shared/topology';

export type GridSlot = {
  id: string;
  label: string;
  content: ReactNode;
  className?: string;
};
export type GridMarker = {
  slots: readonly number[];
  label: string;
  accessibleLabel: string;
  className: string;
};

/** Rendering and local selection only; callers supply authorized faces and rule-derived markers. */
export function BoardGrid({
  layout,
  slots,
  selectable = [],
  selected = [],
  locked = false,
  select,
  markers = [],
  renderIndex,
}: {
  layout: BoardLayout;
  slots: readonly GridSlot[];
  selectable?: readonly number[];
  selected?: readonly number[];
  locked?: boolean;
  select?: ((slot: number) => void) | undefined;
  markers?: readonly GridMarker[];
  renderIndex?: ((index: number) => ReactNode) | undefined;
}) {
  const grid = topology(layout);
  if (slots.length !== grid.count) throw new Error('Invalid rendered board');
  return (
    <div
      className="pokemon-board"
      style={{
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
      }}
      aria-label={`${layout.rows} 行 ${layout.columns} 列场地`}
    >
      {slots.map((slot, index) => {
        const marked = markers.filter((marker) => marker.slots.includes(index));
        const className = `card-slot ${selected.includes(index) ? 'selected' : ''} ${marked.map((marker) => marker.className).join(' ')} ${slot.className ?? ''}`;
        const content = (
          <>
            {slot.content}
            <span className="slot-index">
              {renderIndex ? renderIndex(index) : index + 1}
            </span>
            {marked
              .filter((marker) => marker.slots[0] === index)
              .map((marker) => (
                <span
                  key={marker.accessibleLabel}
                  className="zero-column-badge"
                  aria-label={marker.accessibleLabel}
                >
                  {marker.label}
                </span>
              ))}
          </>
        );
        return select ? (
          <button
            type="button"
            key={slot.id}
            className={className}
            data-slot={slot.id}
            disabled={locked || !selectable.includes(index)}
            aria-label={slot.label}
            aria-pressed={selected.includes(index)}
            onClick={(event) => {
              select(index);
              const bar = document.querySelector('.submit-choice');
              const bounds = bar?.getBoundingClientRect();
              const rect = event.currentTarget.getBoundingClientRect();
              if (
                bar &&
                bounds &&
                rect.right > bounds.left &&
                rect.left < bounds.right &&
                ['fixed', 'sticky'].includes(getComputedStyle(bar).position) &&
                rect.bottom > bounds.top - 8
              )
                window.scrollBy({
                  top: rect.bottom - bounds.top + 8,
                  behavior: 'instant',
                });
            }}
          >
            {content}
          </button>
        ) : (
          <div key={slot.id} className={className} data-slot={slot.id}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
