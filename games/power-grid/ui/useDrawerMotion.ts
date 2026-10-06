import { useLayoutEffect, useState, type RefObject } from 'react';

const DRAWER_DURATION = 280;

/** Keep the closing surface mounted so a reversal continues from its current position. */
export function useDrawerMotion(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  animate: boolean,
) {
  const [initialHidden] = useState(!open);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (timer !== undefined) clearTimeout(timer);
      element.inert = !open;
      element.dataset.drawerAnimate = String(animate && !reduced.matches);
      if (!animate || reduced.matches) {
        element.dataset.drawerMotion = open ? 'open' : 'closed';
        element.hidden = !open;
        return;
      }
      if (open) {
        const wasHidden = element.hidden;
        element.hidden = false;
        // Flush the retained closed pose before starting a newly mounted transition.
        if (wasHidden) void element.offsetWidth;
        element.dataset.drawerMotion = 'open';
      } else {
        element.dataset.drawerMotion = 'closed';
        if (!element.hidden)
          timer = setTimeout(() => {
            element.hidden = true;
          }, DRAWER_DURATION);
      }
    };
    update();
    reduced.addEventListener('change', update);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      reduced.removeEventListener('change', update);
    };
  }, [ref, open, animate]);
  return initialHidden;
}
