import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Card } from '../types';
import { readOrder, reconcileOrder, sortedHand } from './hand-order';

export function useHandOrder(
  cards: Card[],
  legal: Set<string>,
  scope: string,
  boundary: string,
  locked: boolean,
) {
  const key = `uno-hand:${scope}`;
  const [order, setOrder] = useState(() => readOrder(key));
  const current = reconcileOrder(order, cards, legal);
  const serialized = JSON.stringify(current);
  if (JSON.stringify(order) !== serialized) setOrder(current);
  const scroll = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    id: string;
    before: string | null;
  } | null>(null);
  const gesture = useRef<{
    id: string;
    pointer: number;
    x: number;
    y: number;
    lastX: number;
    before: string | null;
    held: boolean;
    moved: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppress = useRef(0);
  const frame = useRef(0);
  const edge = useRef(0);
  const cancel = () => {
    if (gesture.current) {
      clearTimeout(gesture.current.timer);
      if (gesture.current.held || gesture.current.moved)
        suppress.current = Date.now() + 500;
    }
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    edge.current = 0;
    setDrag(null);
  };
  useEffect(() => {
    try {
      sessionStorage.setItem(key, serialized);
    } catch {
      /* Optional local cache. */
    }
  }, [key, serialized]); // Only this player's IDs and presentation preferences.
  useEffect(() => {
    queueMicrotask(cancel);
    return () => {
      if (gesture.current) {
        clearTimeout(gesture.current.timer);
        if (gesture.current.held || gesture.current.moved)
          suppress.current = Date.now() + 500;
      }
      gesture.current = null;
      cancelAnimationFrame(frame.current);
    };
    // Server decisions cancel gestures, but never reset committed manual order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary, locked, cards.map((card) => card.id).join('|')]);
  const insertion = (x: number, id: string) => {
    const buttons = [
      ...(scroll.current?.querySelectorAll<HTMLButtonElement>(
        '[data-card-id]',
      ) ?? []),
    ];
    return (
      buttons.find(
        (button) =>
          x < button.getBoundingClientRect().left + 22 &&
          button.dataset.cardId !== id,
      )?.dataset.cardId ?? null
    );
  };
  const tick = () => {
    if (!gesture.current?.held || !scroll.current) return;
    scroll.current.scrollLeft += edge.current;
    if (edge.current) {
      gesture.current.before = insertion(
        gesture.current.lastX,
        gesture.current.id,
      );
      setDrag({ id: gesture.current.id, before: gesture.current.before });
    }
    frame.current = requestAnimationFrame(tick);
  };
  const down = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (locked || event.button !== 0) return;
    cancel();
    const target = event.currentTarget;
    const pending = {
      id,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      before: id as string | null,
      held: false,
      moved: false,
      timer: setTimeout(() => {
        if (gesture.current !== pending || pending.moved) return;
        pending.held = true;
        target.setPointerCapture(pending.pointer);
        setDrag({ id, before: id });
        frame.current = requestAnimationFrame(tick);
      }, 320),
    };
    gesture.current = pending;
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const pending = gesture.current;
    if (!pending || !scroll.current) return;
    if (
      !pending.held &&
      Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 8
    ) {
      pending.moved = true;
      clearTimeout(pending.timer);
    }
    if (!pending.held) {
      if (pending.moved)
        scroll.current.scrollLeft -= event.clientX - pending.lastX;
      pending.lastX = event.clientX;
      return;
    }
    event.preventDefault();
    pending.lastX = event.clientX;
    pending.before = insertion(event.clientX, pending.id);
    setDrag({ id: pending.id, before: pending.before });
    const bounds = scroll.current.getBoundingClientRect();
    edge.current =
      event.clientX < bounds.left + 32
        ? -7
        : event.clientX > bounds.right - 32
          ? 7
          : 0;
  };
  const up = () => {
    const pending = gesture.current;
    if (pending?.held && pending.before !== pending.id) {
      const ids = current.ids.filter((id) => id !== pending.id);
      ids.splice(
        pending.before ? Math.max(0, ids.indexOf(pending.before)) : ids.length,
        0,
        pending.id,
      );
      setOrder({ ...current, ids, manual: true });
    }
    if (pending?.held || pending?.moved) suppress.current = Date.now() + 500;
    cancel();
  };
  return {
    ids: current.ids,
    mode: current.mode,
    attachScroll: (node: HTMLDivElement | null) => {
      scroll.current = node;
    },
    drag,
    down,
    move,
    up,
    cancel,
    canClick: () => Date.now() > suppress.current,
    sort: () => {
      cancel();
      const mode = current.mode === 'color' ? 'number' : 'color';
      setOrder({ mode, manual: false, ids: sortedHand(cards, legal, mode) });
    },
    shift: (id: string, delta: number) => {
      const ids = [...current.ids];
      const index = ids.indexOf(id);
      const target = Math.max(0, Math.min(ids.length - 1, index + delta));
      ids.splice(index, 1);
      ids.splice(target, 0, id);
      setOrder({ ...current, ids, manual: true });
    },
  };
}
