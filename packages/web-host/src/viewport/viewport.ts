export type ViewportSize = { width: number; height: number };
export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type ViewportMeasurement = {
  viewport: ViewportSize;
  safeInsets: SafeInsets;
  available: ViewportSize;
  orientation: 'portrait' | 'landscape';
};
export type ViewportSnapshot = ViewportMeasurement & { revision: number };
const nonnegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/** All dimensions are CSS pixels in this document, never parent or device pixels. */
export function measureViewport(
  layout: ViewportSize,
  visual: ViewportSize | null,
  insets: Partial<SafeInsets> = {},
): ViewportMeasurement {
  const viewport = {
    width: Math.min(
      nonnegative(layout.width),
      nonnegative(visual?.width ?? layout.width),
    ),
    height: Math.min(
      nonnegative(layout.height),
      nonnegative(visual?.height ?? layout.height),
    ),
  };
  const safeInsets = {
    top: nonnegative(insets.top ?? 0),
    right: nonnegative(insets.right ?? 0),
    bottom: nonnegative(insets.bottom ?? 0),
    left: nonnegative(insets.left ?? 0),
  };
  return {
    viewport,
    safeInsets,
    available: {
      width: Math.floor(
        Math.max(0, viewport.width - safeInsets.left - safeInsets.right),
      ),
      height: Math.floor(
        Math.max(0, viewport.height - safeInsets.top - safeInsets.bottom),
      ),
    },
    orientation: viewport.width > viewport.height ? 'landscape' : 'portrait',
  };
}

export function sameViewport(a: ViewportMeasurement, b: ViewportMeasurement) {
  return (
    a.viewport.width === b.viewport.width &&
    a.viewport.height === b.viewport.height &&
    a.safeInsets.top === b.safeInsets.top &&
    a.safeInsets.right === b.safeInsets.right &&
    a.safeInsets.bottom === b.safeInsets.bottom &&
    a.safeInsets.left === b.safeInsets.left
  );
}

export function readViewport(
  rootSelector: string,
  safeAreaPrefix: string,
): ViewportMeasurement {
  // Resolve on every read: a root may appear later or be replaced without a resize.
  const root = document.querySelector<HTMLElement>(rootSelector);
  const style = root ? getComputedStyle(root) : null;
  const inset = (edge: string) =>
    Number.parseFloat(
      style?.getPropertyValue(`${safeAreaPrefix}${edge}`) ?? '',
    ) || 0;
  return measureViewport(
    { width: window.innerWidth, height: window.innerHeight },
    window.visualViewport,
    {
      top: inset('top'),
      right: inset('right'),
      bottom: inset('bottom'),
      left: inset('left'),
    },
  );
}

/** The returned cleanup owns every listener; snapshots contain no DOM references. */
export function subscribeViewport(
  rootSelector: string,
  safeAreaPrefix: string,
  notify: (value: ViewportMeasurement) => void,
) {
  let active = true;
  let pendingFrame: number | undefined;
  let ancestors: HTMLElement[] = [];
  let previous: ViewportMeasurement | undefined;
  const update = () => {
    pendingFrame = undefined;
    if (!active) return;
    const next = readViewport(rootSelector, safeAreaPrefix);
    if (!previous || !sameViewport(previous, next)) {
      previous = next;
      notify(next);
    }
  };
  const schedule = () => {
    if (active && pendingFrame === undefined)
      pendingFrame = window.requestAnimationFrame(update);
  };
  const styles = new MutationObserver(schedule);
  const bindRoot = () => {
    const next: HTMLElement[] = [];
    for (
      let node = document.querySelector<HTMLElement>(rootSelector);
      node;
      node = node.parentElement
    )
      next.push(node);
    if (
      next.length === ancestors.length &&
      next.every((node, index) => node === ancestors[index])
    )
      return;
    ancestors = next;
    styles.disconnect();
    // Ancestor theme changes can affect inherited CSS variables. Descendant
    // animations cannot: do not watch their class/style changes or force layout.
    for (const node of ancestors)
      styles.observe(node, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    schedule();
  };
  const visual = window.visualViewport;
  window.addEventListener('resize', schedule);
  visual?.addEventListener('resize', schedule);
  const observer = new MutationObserver(bindRoot);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  bindRoot();
  if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
  update();
  return () => {
    active = false;
    observer.disconnect();
    styles.disconnect();
    if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
    window.removeEventListener('resize', schedule);
    visual?.removeEventListener('resize', schedule);
  };
}
