import { useLayoutEffect, useRef } from 'react';

const gap = 3;
const interactive =
  'a,button,input,select,textarea,summary,[tabindex],[role="button"],img,svg';

function bounds(rects: DOMRect[]) {
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    right: Math.max(...rects.map((rect) => rect.right)),
    top: Math.min(...rects.map((rect) => rect.top)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  };
}

function occupiedRects(scope: Element, notice: HTMLElement, limit: number) {
  const nodes = document.createTreeWalker(
    scope,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node === notice) return NodeFilter.FILTER_REJECT;
        if (node instanceof Element && node.matches(interactive))
          return NodeFilter.FILTER_ACCEPT;
        return node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    },
  );
  const text = document.createRange();
  const occupied: DOMRect[] = [];
  for (let node = nodes.nextNode(); node; node = nodes.nextNode()) {
    if (node instanceof Element) {
      const rect = node.getBoundingClientRect();
      if (rect.width && rect.height && rect.top < limit && rect.bottom > 0)
        occupied.push(rect);
    } else {
      text.selectNodeContents(node);
      for (const rect of text.getClientRects())
        if (rect.width && rect.height && rect.top < limit && rect.bottom > 0)
          occupied.push(rect);
    }
  }
  return occupied;
}

function findPosition(
  occupied: DOMRect[],
  corridor: { left: number; right: number; top: number; bottom: number },
  width: number,
  height: number,
  preferredY = (corridor.top + corridor.bottom - height) / 2,
) {
  const { left, right, top, bottom } = corridor;
  const rows = [
    preferredY,
    ...Array.from(
      { length: Math.max(0, Math.floor(bottom - top - height) + 1) },
      (_, offset) => top + offset,
    ),
  ];
  occupied.sort((a, b) => a.left - b.left);
  for (const y of rows) {
    if (y < top || y + height > bottom) continue;
    let x = left;
    for (const block of occupied) {
      if (block.top - gap >= y + height || block.bottom + gap <= y) continue;
      if (x + width <= block.left - gap) break;
      x = Math.max(x, block.right + gap);
    }
    if (x + width <= right) return { x, y };
  }
  return null;
}

/** Find space in the toolbar, then immediately below it on a crowded screen. */
export function useToolbarSavePosition(active: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const notice = ref.current;
    const header = notice?.closest('header');
    if (!active || !notice || !header) return;
    const scope = header.closest('main') ?? header;
    let frame = 0;
    const place = () => {
      const headerRect = header.getBoundingClientRect();
      // A wide Manila player uses display: contents on the header.
      const parts = Array.from(header.children)
        .filter((child) => child !== notice)
        .map((child) => child.getBoundingClientRect())
        .filter((rect) => rect.width && rect.height);
      const edges =
        headerRect.width && headerRect.height
          ? headerRect
          : parts.length
            ? bounds(parts)
            : null;
      if (!edges || edges.top < 0 || edges.top >= innerHeight) {
        delete notice.dataset.positioned;
        return;
      }
      const { width, height } = notice.getBoundingClientRect();
      const corridor = {
        top: edges.top,
        bottom: Math.min(edges.bottom, innerHeight),
        left: Math.max(gap, edges.left),
        right: Math.min(
          document.documentElement.clientWidth - gap,
          edges.right,
        ),
      };
      // Include controls positioned independently of the toolbar. A clipped
      // board graphic can have a DOM rectangle much larger than its viewport.
      const controls = [
        ...document.querySelectorAll('button,a,input,select,textarea,summary'),
      ]
        .filter((control) => !header.contains(control))
        .map((control) => control.getBoundingClientRect())
        .filter((rect) => rect.width && rect.height);
      const limit = Math.min(innerHeight, edges.bottom + 96);
      const fallbackTop = Math.max(edges.top, edges.bottom - height);
      const position =
        findPosition(
          [
            ...occupiedRects(header, notice, corridor.bottom + gap),
            ...controls,
          ],
          corridor,
          width,
          height,
        ) ??
        findPosition(
          [...occupiedRects(scope, notice, limit), ...controls],
          {
            ...corridor,
            top: fallbackTop,
            bottom: limit,
          },
          width,
          height,
          fallbackTop,
        );
      if (position) {
        notice.style.transform = `translate(${position.x}px, ${position.y}px)`;
        notice.dataset.positioned = '';
      } else {
        delete notice.dataset.positioned;
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(header);
    resize.observe(notice);
    const updates = new MutationObserver(schedule);
    updates.observe(header, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    place();
    return () => {
      resize.disconnect();
      updates.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      cancelAnimationFrame(frame);
      delete notice.dataset.positioned;
    };
  }, [active]);
  return ref;
}
