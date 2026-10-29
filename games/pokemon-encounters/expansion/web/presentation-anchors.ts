import type { AnchorRect } from './presentation-clock';
/** DOM adapter only: the presentation clock can run without a browser. */
export function measurePresentationAnchors(): Record<string, AnchorRect> {
  const anchors: Record<string, AnchorRect> = {};
  document
    .querySelectorAll<HTMLElement>(
      '.expansion-screen [data-slot], .expansion-screen [data-pile]',
    )
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      if (
        r.width <= 2 ||
        r.height <= 2 ||
        r.bottom <= 0 ||
        r.top >= innerHeight
      )
        return;
      const id =
        el.dataset.slot ??
        '@' +
          el.dataset.pile +
          (el.dataset.pile === 'buffer' ? ':' + el.dataset.seat : '');
      anchors[id] = {
        x: r.x + scrollX,
        y: r.y + scrollY,
        width: r.width,
        height: r.height,
      };
    });
  return anchors;
}
