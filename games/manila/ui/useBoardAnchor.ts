import { useLayoutEffect, useRef, type RefObject } from 'react';

type Anchor = { node: HTMLElement; top: number };
type AnchorState = {
  anchor: Anchor[];
  blockedUntil: number;
  frame: number;
  finalFrame: number;
  expectedScroll: number | null;
  scrollIntentUntil: number;
  tail: number;
  touches: Map<number, { x: number; y: number; moved: boolean }>;
};

const editable = (active: EventTarget | null) => {
  return (
    active instanceof HTMLElement &&
    (active.matches('input, textarea, select') || active.isContentEditable)
  );
};

function capture(owner: HTMLElement): Anchor[] {
  const bounds = owner.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return [];
  // A lane is stable while its ship moves; never anchor to the moving ship.
  const candidates = (selector: string, includeOffscreen = false) =>
    [...owner.querySelectorAll<HTMLElement>(selector)]
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter(
        ({ box }) =>
          box.width > 0 &&
          box.height > 0 &&
          (includeOffscreen ||
            (box.bottom > bounds.top && box.top < bounds.bottom)) &&
          box.right > bounds.left &&
          box.left < bounds.right,
      )
      .sort(
        (a, b) =>
          Math.abs(a.box.top - bounds.top) - Math.abs(b.box.top - bounds.top),
      );
  // A vacant crew slot can become a summary; keep stable visible alternatives.
  const visible = [
    ...candidates('[data-mn-space]'),
    ...candidates('.mn-lane[data-mn-cargo]'),
  ];
  if (visible.length)
    return visible.map(({ node, box }) => ({ node, top: box.top }));
  if (
    getComputedStyle(owner).getPropertyValue('--mn-anchor-offscreen').trim() !==
    '1'
  )
    return [];
  // A short landscape decision can scroll the entire board above the viewport.
  // Retain its current position, including intentional scrolling to Cancel.
  return [
    ...candidates('[data-mn-space]', true).slice(0, 1),
    ...candidates('.mn-lane[data-mn-cargo]', true).slice(0, 1),
  ].map(({ node, box }) => ({ node, top: box.top }));
}

/** Preserve the visible board position once after a saved or draft update. */
export function useBoardAnchor(
  scrollRef: RefObject<HTMLElement | null>,
  updateKey: unknown,
): void {
  const state = useRef<AnchorState>({
    anchor: [],
    blockedUntil: 0,
    frame: 0,
    finalFrame: 0,
    expectedScroll: null,
    scrollIntentUntil: 0,
    tail: 0,
    touches: new Map(),
  });

  useLayoutEffect(() => {
    const owner = scrollRef.current;
    if (!owner) return;
    const current = state.current;
    const remember = () => {
      current.anchor = capture(owner);
    };
    const block = (duration = 250) => {
      current.blockedUntil = performance.now() + duration;
    };
    const clearTail = () => {
      if (!current.tail) return;
      current.tail = 0;
      owner.style.removeProperty('--mn-anchor-tail');
      current.expectedScroll = owner.scrollTop;
    };
    const userScroll = () => {
      block();
      current.scrollIntentUntil = performance.now() + 250;
      clearTail();
    };
    const scroll = () => {
      if (
        current.expectedScroll !== null &&
        Math.abs(owner.scrollTop - current.expectedScroll) < 1
      ) {
        current.expectedScroll = null;
      } else {
        current.expectedScroll = null;
        // Content shrinking can clamp scrollTop without user input. It must
        // remain eligible for the pending one-shot anchor restoration.
        if (performance.now() < current.scrollIntentUntil) userScroll();
      }
      remember();
    };
    const wheel = () => userScroll();
    const viewport = () => {
      block(400);
      clearTail();
      remember();
    };
    const focus = (event: FocusEvent) => {
      if (editable(event.target)) block(400);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
      current.touches.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        moved: false,
      });
    };
    const move = (event: PointerEvent) => {
      const touch = current.touches.get(event.pointerId);
      if (
        touch &&
        Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 7
      ) {
        touch.moved = true;
        userScroll();
      }
    };
    const up = (event: PointerEvent) => {
      const touch = current.touches.get(event.pointerId);
      if (touch && (touch.moved || event.type === 'pointercancel'))
        userScroll();
      current.touches.delete(event.pointerId);
    };
    const key = (event: KeyboardEvent) => {
      if (
        !editable(event.target) &&
        [
          'ArrowUp',
          'ArrowDown',
          'PageUp',
          'PageDown',
          'Home',
          'End',
          ' ',
        ].includes(event.key)
      )
        userScroll();
    };
    remember();
    owner.addEventListener('scroll', scroll, { passive: true });
    owner.addEventListener('wheel', wheel, { passive: true });
    owner.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    window.addEventListener('resize', viewport);
    window.addEventListener('orientationchange', viewport);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', focus);
    document.addEventListener('keydown', key);
    window.visualViewport?.addEventListener('resize', viewport);
    window.visualViewport?.addEventListener('scroll', viewport);
    return () => {
      cancelAnimationFrame(current.frame);
      cancelAnimationFrame(current.finalFrame);
      current.touches.clear();
      clearTail();
      owner.removeEventListener('scroll', scroll);
      owner.removeEventListener('wheel', wheel);
      owner.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('resize', viewport);
      window.removeEventListener('orientationchange', viewport);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', focus);
      document.removeEventListener('keydown', key);
      window.visualViewport?.removeEventListener('resize', viewport);
      window.visualViewport?.removeEventListener('scroll', viewport);
    };
  }, [scrollRef]);

  useLayoutEffect(() => {
    const owner = scrollRef.current;
    if (!owner) return;
    const current = state.current;
    const candidates = current.anchor;
    cancelAnimationFrame(current.frame);
    cancelAnimationFrame(current.finalFrame);
    // Let layout effects and confirmation ResizeObservers settle first. This
    // transaction has one final measurement and at most one scroll assignment.
    current.frame = requestAnimationFrame(() => {
      current.finalFrame = requestAnimationFrame(() => {
        if (scrollRef.current !== owner) return;
        const before = candidates.find(
          ({ node }) => node.isConnected && owner.contains(node),
        );
        if (
          before?.node.isConnected &&
          owner.contains(before.node) &&
          current.touches.size === 0 &&
          performance.now() >= current.blockedUntil &&
          !editable(document.activeElement)
        ) {
          const bounds = owner.getBoundingClientRect();
          const box = before.node.getBoundingClientRect();
          const delta = box.top - before.top;
          if (bounds.height > 0 && box.height > 0) {
            const desired = Math.max(0, owner.scrollTop + delta);
            const naturalMax = Math.max(
              0,
              owner.scrollHeight - owner.clientHeight - current.tail,
            );
            // This precise scroll-range repair lives outside the board. It is
            // replaced, never accumulated, and disappears with the next user
            // scroll or as soon as natural content can support this view.
            const tail = Math.max(0, Math.ceil(desired - naturalMax));
            if (tail !== current.tail) {
              current.tail = tail;
              if (tail)
                owner.style.setProperty('--mn-anchor-tail', `${tail}px`);
              else owner.style.removeProperty('--mn-anchor-tail');
            }
            // scrollHeight is clamped to clientHeight when content is short.
            // Fill that hidden deficit before the single scroll assignment.
            const deficit = Math.ceil(
              desired - (owner.scrollHeight - owner.clientHeight),
            );
            if (tail > 0 && deficit > 0) {
              current.tail += deficit;
              owner.style.setProperty('--mn-anchor-tail', `${current.tail}px`);
            }
            const next = Math.max(
              0,
              Math.min(owner.scrollHeight - owner.clientHeight, desired),
            );
            if (Math.abs(next - owner.scrollTop) > 0.75) {
              current.expectedScroll = next;
              owner.scrollTop = next;
            }
          }
        }
        current.anchor = capture(owner);
      });
    });
    return () => {
      cancelAnimationFrame(current.frame);
      cancelAnimationFrame(current.finalFrame);
    };
  }, [scrollRef, updateKey]);
}
