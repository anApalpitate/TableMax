import { useId, useLayoutEffect, useState, type CSSProperties } from 'react';

type Layout = 'H' | 'P' | 'L';
type Space = { layout: Layout; width: number; height: number };
type Insets = { left: number; right: number; top: number; bottom: number };

function measure(
  player: boolean,
  insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 },
): Space {
  const viewport = window.visualViewport;
  const width = Math.floor(
    Math.min(window.innerWidth, viewport?.width ?? window.innerWidth) -
      insets.left -
      insets.right,
  );
  const height = Math.floor(
    Math.min(window.innerHeight, viewport?.height ?? window.innerHeight) -
      insets.top -
      insets.bottom,
  );
  const { playerLayout, playerDisplay } = document.documentElement.dataset;
  const preference = playerLayout ?? playerDisplay;
  const layout: Layout = !player
    ? 'H'
    : preference === 'wide'
      ? 'L'
      : preference === 'portrait'
        ? 'P'
        : width > height
          ? 'L'
          : 'P';
  return { layout, width: Math.max(0, width), height: Math.max(0, height) };
}

/** Presentation measurements only; room identity and selection never depend on them. */
export function usePokemonViewport(player: boolean) {
  const id = useId();
  const [space, setSpace] = useState<Space>(() => measure(player));
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(
      `[data-pokemon-viewport="${id}"]`,
    );
    const update = () => {
      const rootStyle = root && getComputedStyle(root);
      const inset = (edge: string) =>
        Number.parseFloat(
          rootStyle?.getPropertyValue(`--pokemon-safe-${edge}`) ?? '',
        ) || 0;
      const next = measure(player, {
        left: inset('left'),
        right: inset('right'),
        top: inset('top'),
        bottom: inset('bottom'),
      });
      setSpace((previous) =>
        previous.layout === next.layout &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-player-layout', 'data-player-display'],
    });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [player, id]);
  const minimum =
    space.layout === 'H'
      ? [1280, 720]
      : space.layout === 'P'
        ? [360, 640]
        : [640, 360];
  return {
    id,
    ...space,
    belowMinimum: space.width < minimum[0]! || space.height < minimum[1]!,
    style: {
      '--pokemon-net-width': `${space.width}px`,
      '--pokemon-net-height': `${space.height}px`,
      '--pokemon-safe-top': 'env(safe-area-inset-top, 0px)',
      '--pokemon-safe-right': 'env(safe-area-inset-right, 0px)',
      '--pokemon-safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      '--pokemon-safe-left': 'env(safe-area-inset-left, 0px)',
    } as CSSProperties,
  };
}
