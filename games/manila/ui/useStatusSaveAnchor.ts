import { useLayoutEffect, type RefObject } from 'react';

/** Find existing whitespace without letting the receipt reserve layout space. */
export function useStatusSaveAnchor(
  statusRef: RefObject<HTMLElement | null>,
  updateKey: string,
) {
  useLayoutEffect(() => {
    const status = statusRef.current;
    const copy = status?.querySelector<HTMLElement>('.mn-current-turn-copy');
    const anchor = status?.querySelector<HTMLElement>('.mn-status-save');
    const label = anchor?.querySelector<HTMLElement>('.session-save-overlay');
    if (!status || !copy || !anchor || !label) return;
    const visible = (node: Element) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    };
    const position = () => {
      const labelBox = label.getBoundingClientRect();
      if (!labelBox.width || !labelBox.height) return;
      const labelRange = document.createRange();
      labelRange.selectNodeContents(label);
      const ink = labelRange.getBoundingClientRect();
      if (!ink.width || !ink.height) return;
      const inkTop = ink.top - labelBox.top;
      const inkRight = ink.right - labelBox.right;
      const bounds = status.getBoundingClientRect();
      const origin = (anchor.offsetParent ?? copy).getBoundingClientRect();
      const obstacles: DOMRect[] = [];
      const walker = document.createTreeWalker(status, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const parent = text.parentElement;
        if (
          !parent ||
          !text.textContent?.trim() ||
          anchor.contains(parent) ||
          parent.closest('.sr-only,.mn-sr-only') ||
          !visible(parent)
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        obstacles.push(...range.getClientRects());
      }
      status
        .querySelectorAll<HTMLElement>('button,img,svg,.decision-countdown')
        .forEach((node) => {
          if (visible(node)) obstacles.push(node.getBoundingClientRect());
        });
      const preferred =
        status.querySelector<HTMLElement>('.mn-turn-hint') ??
        status.querySelector<HTMLElement>('.mn-status-detail');
      const preferredBox = preferred?.getBoundingClientRect();
      const phase = status
        .querySelector<HTMLElement>('.mn-phase-name')
        ?.getBoundingClientRect();
      const rows = [
        preferredBox &&
          preferredBox.top + (preferredBox.height - ink.height) / 2,
        phase && phase.top + (phase.height - ink.height) / 2,
        bounds.bottom - ink.height - 2,
        bounds.top + 2,
      ].filter((value): value is number => typeof value === 'number');
      for (let y = bounds.top + 2; y + ink.height <= bounds.bottom - 2; y += 4)
        rows.push(y);
      for (const top of rows) {
        if (top < bounds.top || top + ink.height > bounds.bottom) continue;
        const occupied = obstacles
          .filter(
            (box) =>
              box.width &&
              box.height &&
              box.right > bounds.left &&
              box.left < bounds.right &&
              box.bottom + 3 > top &&
              box.top - 3 < top + ink.height,
          )
          .map((box) => [
            Math.max(bounds.left + 2, box.left - 4),
            Math.min(bounds.right - 2, box.right + 4),
          ])
          .sort((a, b) => a[0]! - b[0]!);
        const gaps: [number, number][] = [];
        let left = bounds.left + 2;
        for (const [start, end] of occupied) {
          if (start! > left) gaps.push([left, start!]);
          left = Math.max(left, end!);
        }
        gaps.push([left, bounds.right - 2]);
        const gap = gaps
          .reverse()
          .find(([start, end]) => end - start >= ink.width);
        if (!gap) continue;
        anchor.style.left = `${gap[1] - origin.left - inkRight}px`;
        anchor.style.right = 'auto';
        anchor.style.top = `${top - origin.top - inkTop}px`;
        return;
      }
    };
    const resize = new ResizeObserver(position);
    resize.observe(status);
    resize.observe(copy);
    resize.observe(label);
    const mutation = new MutationObserver(position);
    mutation.observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.addEventListener('resize', position);
    position();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener('resize', position);
    };
  }, [statusRef, updateKey]);
}
