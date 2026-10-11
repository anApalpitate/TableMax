import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Tile } from '../types';
import type { Binding } from './draft';
import { ControlIcon } from './ControlIcon';
import { NumberTile } from './NumberTile';
import {
  moveRackTile,
  reconcileRackOrder,
  restoreRackOrder,
  restoreRackCache,
  sortRack,
  type RackSort,
} from './rack-order';

const storageKey = 'tablemax:rummikub:rack-order';
function readOrder(scope: string, tiles: Tile[]) {
  try {
    const cached: unknown = JSON.parse(
      sessionStorage.getItem(storageKey) ?? 'null',
    );
    return restoreRackCache(cached, scope, tiles);
  } catch {
    return restoreRackOrder(null, tiles);
  }
}

export function Rack({
  scope,
  authorized,
  visible = authorized.map((tile) => tile.id),
  bindings = {},
  selected = [],
  disabled = false,
  choose,
  headingId,
}: {
  scope: string;
  authorized: Tile[];
  visible?: string[];
  bindings?: Record<string, Binding>;
  selected?: string[];
  disabled?: boolean;
  choose?(id: string): void;
  headingId?: string;
}) {
  const [order, setOrder] = useState(() => readOrder(scope, authorized));
  const current = reconcileRackOrder(order, authorized);
  const serialized = JSON.stringify(current);
  const cache = JSON.stringify({ scope, order: current });
  if (JSON.stringify(order) !== serialized) setOrder(current);
  const [arranging, setArranging] = useState(false);
  const [drag, setDrag] = useState<{
    id: string;
    before: string | null;
  } | null>(null);
  const rack = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: string;
    before: string | null;
    x: number;
    y: number;
    viewport: HTMLElement | null;
  } | null>(null);
  const frame = useRef(0);
  const visibleSet = new Set(visible);
  const ids = current.ids.filter((id) => visibleSet.has(id));
  const byId = new Map(authorized.map((tile) => [tile.id, tile]));
  const cancel = () => {
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    setDrag(null);
  };
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, cache);
    } catch {
      /* Optional cache of this seat's authorized IDs and presentation mode. */
    }
  }, [cache]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const insertion = (x: number, y: number, id: string) => {
    const buttons = [
      ...(rack.current?.querySelectorAll<HTMLButtonElement>(
        'button[data-tile-id]',
      ) ?? []),
    ].filter((button) => button.dataset.tileId !== id);
    const nearest = buttons.reduce<HTMLButtonElement | null>((best, button) => {
      const distance = (entry: HTMLButtonElement) => {
        const rect = entry.getBoundingClientRect();
        return Math.hypot(
          x - (rect.left + rect.width / 2),
          y - (rect.top + rect.height / 2),
        );
      };
      return !best || distance(button) < distance(best) ? button : best;
    }, null);
    if (!nearest) return id;
    const rect = nearest.getBoundingClientRect();
    const index = buttons.indexOf(nearest);
    return x < rect.left + rect.width / 2 || y < rect.top
      ? nearest.dataset.tileId!
      : (buttons[index + 1]?.dataset.tileId ?? null);
  };
  const tick = () => {
    const pending = gesture.current;
    if (!pending) return;
    const viewport = pending.viewport;
    if (viewport) {
      const bounds = viewport.getBoundingClientRect();
      const edge =
        pending.y < bounds.top + 32
          ? -6
          : pending.y > bounds.bottom - 32
            ? 6
            : 0;
      if (edge) {
        viewport.scrollTop += edge;
        pending.before = insertion(pending.x, pending.y, pending.id);
        setDrag({ id: pending.id, before: pending.before });
      }
    }
    frame.current = requestAnimationFrame(tick);
  };
  const down = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (!arranging || event.button !== 0) return;
    event.preventDefault();
    cancel();
    event.currentTarget.setPointerCapture(event.pointerId);
    let viewport = rack.current?.parentElement ?? null;
    while (
      viewport &&
      !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)
    )
      viewport = viewport.parentElement;
    gesture.current = {
      id,
      before: id,
      x: event.clientX,
      y: event.clientY,
      viewport,
    };
    setDrag({ id, before: id });
    frame.current = requestAnimationFrame(tick);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const pending = gesture.current;
    if (!pending) return;
    event.preventDefault();
    pending.x = event.clientX;
    pending.y = event.clientY;
    pending.before = insertion(pending.x, pending.y, pending.id);
    setDrag({ id: pending.id, before: pending.before });
  };
  const up = () => {
    const pending = gesture.current;
    if (pending) {
      setOrder(moveRackTile(current, pending.id, pending.before));
    }
    cancel();
  };
  return (
    <>
      <div className="rk-section-heading rk-rack-heading">
        <h2 id={headingId}>我的牌架</h2>
        <div className="rk-rack-controls">
          <select
            aria-label="牌架排序"
            value={current.mode}
            onChange={(event) => {
              cancel();
              const mode = event.target.value as RackSort;
              setOrder({ mode, ids: sortRack(authorized, mode) });
            }}
          >
            <option value="color">按颜色</option>
            <option value="value">按数字</option>
            <option value="dealt">原顺序</option>
          </select>
          <button
            type="button"
            className="rk-icon-button"
            aria-label="整理牌架"
            title={
              arranging ? '完成牌架整理' : '整理牌架：拖动或用 Alt 加方向键移动'
            }
            aria-pressed={arranging}
            onClick={() => {
              cancel();
              setArranging(!arranging);
            }}
          >
            <ControlIcon name="arrange" />
          </button>
        </div>
      </div>
      <div
        className="rk-rack"
        ref={rack}
        data-own-rack
        data-rack-arranging={arranging}
      >
        {ids.map((id) => (
          <NumberTile
            key={id}
            tile={byId.get(id)!}
            {...(bindings[id] ? { binding: bindings[id] } : {})}
            selected={selected.indexOf(id) + 1}
            extraClass={`${drag?.id === id ? ' rk-tile--dragging' : ''}${drag?.before === id && drag.id !== id ? ' rk-tile--insert' : ''}`}
            onSelect={() => {
              if (!arranging && !disabled) choose?.(id);
            }}
            buttonProps={{
              'aria-disabled': Boolean(choose && disabled && !arranging),
              title: 'Alt 加方向键整理牌架',
              onPointerDown: (event) => down(event, id),
              onPointerMove: move,
              onPointerUp: up,
              onPointerCancel: cancel,
              onKeyDown: (event) => {
                if (
                  !event.altKey ||
                  !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                cancel();
                const columns = rack.current
                  ? getComputedStyle(rack.current).gridTemplateColumns.split(
                      ' ',
                    ).length
                  : 1;
                const delta =
                  event.key === 'ArrowLeft'
                    ? -1
                    : event.key === 'ArrowRight'
                      ? 1
                      : event.key === 'ArrowUp'
                        ? -columns
                        : columns;
                const at = ids.indexOf(id);
                const target = Math.max(
                  0,
                  Math.min(ids.length - 1, at + delta),
                );
                if (target === at) return;
                const neighbors = ids.filter((entry) => entry !== id);
                setOrder(moveRackTile(current, id, neighbors[target] ?? null));
              },
            }}
          />
        ))}
        {!ids.length && <p>牌架已清空</p>}
      </div>
    </>
  );
}
