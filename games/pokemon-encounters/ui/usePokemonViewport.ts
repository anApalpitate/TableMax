import { useId, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useViewportSnapshot } from '@tablemax/web-host';

type Layout = 'H' | 'P' | 'L';
function preference() {
  const { playerLayout, playerDisplay } = document.documentElement.dataset;
  return playerLayout ?? playerDisplay;
}

/** Presentation measurements only; room identity and selection never depend on them. */
export function usePokemonViewport(player: boolean) {
  const id = useId();
  const viewport = useViewportSnapshot(
    `[data-pokemon-viewport="${id}"]`,
    '--pokemon-safe-',
  );
  const [preferred, setPreferred] = useState(preference);
  useLayoutEffect(() => {
    const update = () => setPreferred(preference());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-player-layout', 'data-player-display'],
    });
    update();
    return () => observer.disconnect();
  }, []);
  const { width, height } = viewport.available;
  const layout: Layout = !player
    ? 'H'
    : preferred === 'wide'
      ? 'L'
      : preferred === 'portrait'
        ? 'P'
        : width > height
          ? 'L'
          : 'P';
  return {
    id,
    layout,
    width,
    height,
    // P390 is a representative test viewport, not a newly promised minimum.
    belowMinimum: layout === 'H' && (width < 1280 || height < 720),
    style: {
      '--pokemon-net-width': `${width}px`,
      '--pokemon-net-height': `${height}px`,
      '--pokemon-safe-top': 'env(safe-area-inset-top, 0px)',
      '--pokemon-safe-right': 'env(safe-area-inset-right, 0px)',
      '--pokemon-safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      '--pokemon-safe-left': 'env(safe-area-inset-left, 0px)',
    } as CSSProperties,
  };
}
