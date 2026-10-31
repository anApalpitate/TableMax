import { useEffect, useRef, useState, type RefObject } from 'react';

/** Navigation guidance describes the current decision, never a saved event. */
export function useActionGuidance({
  boundary,
  enabled,
  revision,
  scrollRef,
}: {
  boundary: string;
  enabled: boolean;
  revision: number | undefined;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [seen, setSeen] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled || seen === boundary) return;
    const owner = scrollRef.current;
    const area = owner?.querySelector<HTMLElement>('#mn-action-area');
    const heading =
      area?.querySelector<HTMLElement>('h2:not(.mn-sr-only)') ??
      area?.querySelector<HTMLElement>('[data-mn-primary-control]');
    if (!owner || !area || !heading) return;
    const visible = (node: HTMLElement) => {
      const root = owner.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        Math.min(box.bottom, root.bottom, window.innerHeight) -
          Math.max(box.top, root.top, 0) >=
          Math.min(box.height / 2, 22) &&
        Math.min(box.right, root.right) > Math.max(box.left, root.left)
      );
    };
    const inspect = () => {
      const control =
        area.querySelector<HTMLElement>(
          '[data-mn-primary-control]:not(:disabled)',
        ) ??
        area.querySelector<HTMLElement>(
          'input:not(:disabled), select:not(:disabled), button:not(:disabled)',
        );
      if (control && visible(heading) && visible(control)) setSeen(boundary);
    };
    const intersection = new IntersectionObserver(inspect, {
      root: owner,
      threshold: [0, 0.5, 1],
    });
    const resize = new ResizeObserver(inspect);
    intersection.observe(heading);
    resize.observe(owner);
    resize.observe(area);
    const mutation = new MutationObserver(inspect);
    mutation.observe(area, { childList: true, subtree: true });
    owner.addEventListener('scroll', inspect, { passive: true });
    inspect();
    return () => {
      intersection.disconnect();
      resize.disconnect();
      mutation.disconnect();
      owner.removeEventListener('scroll', inspect);
    };
  }, [boundary, enabled, revision, scrollRef, seen]);
  useEffect(
    () => () => {
      if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
    },
    [],
  );
  const goToAction = () => {
    const owner = scrollRef.current;
    const target = owner?.querySelector<HTMLElement>('#mn-action-area');
    if (!owner || !target || !enabled) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    setSeen(boundary);
    const anchor =
      target.querySelector<HTMLElement>('h2:not(.mn-sr-only)') ??
      target.querySelector<HTMLElement>('[data-mn-primary-control]');
    anchor?.focus({ preventScroll: true });
    owner.scrollTo({
      top:
        owner.scrollTop +
        target.getBoundingClientRect().top -
        owner.getBoundingClientRect().top -
        8,
      behavior: reduced ? 'instant' : 'smooth',
    });
    if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
    setArrival(boundary);
    arrivalTimer.current = setTimeout(() => setArrival(null), 1200);
  };
  return {
    highlighted: enabled,
    pulsing: enabled && seen !== boundary,
    arrived: enabled && arrival === boundary,
    goToAction,
  };
}
