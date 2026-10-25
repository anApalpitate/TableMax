import {
  canvasFits,
  type CanvasLayout,
  type CanvasPreference,
  type CanvasRect,
  type CanvasRole,
  type selectCanvasLayout,
} from './fixed-layout';

export interface FixedVisualViewport {
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
  scale: number;
}

/** Holding a focused composition never freezes its actual visibility status. */
export function fixedFocusedCanvasSelection(
  visible: Pick<CanvasRect, 'width' | 'height'>,
  role: CanvasRole,
  preference: CanvasPreference,
  held: CanvasLayout,
): ReturnType<typeof selectCanvasLayout> {
  const fits = canvasFits(visible, held);
  const preferred =
    preference === 'portrait'
      ? 'player-portrait'
      : preference === 'wide'
        ? 'player-landscape'
        : null;
  const fallback = role === 'player' && preferred && preferred !== held;
  return {
    layout: held,
    fitStatus: !fits ? 'overflow' : fallback ? 'fallback' : 'fits',
    selectionReason: !fits
      ? 'overflow'
      : role !== 'player'
        ? 'host'
        : fallback
          ? 'fallback'
          : preferred
            ? 'explicit'
            : 'automatic',
  };
}

/** Relative clipping only. Visual magnification remains the browser's job. */
export function fixedVisualViewportClip(
  layout: CanvasRect,
  visual: FixedVisualViewport | null,
): CanvasRect {
  const full = { x: 0, y: 0, width: layout.width, height: layout.height };
  if (
    !visual ||
    visual.scale !== 1 ||
    ![visual.offsetLeft, visual.offsetTop, visual.width, visual.height].every(
      Number.isFinite,
    )
  )
    return full;
  const left = Math.min(
    layout.x + layout.width,
    Math.max(layout.x, visual.offsetLeft),
  );
  const top = Math.min(
    layout.y + layout.height,
    Math.max(layout.y, visual.offsetTop),
  );
  const right = Math.min(
    layout.x + layout.width,
    visual.offsetLeft + Math.max(0, visual.width),
  );
  const bottom = Math.min(
    layout.y + layout.height,
    visual.offsetTop + Math.max(0, visual.height),
  );
  return {
    x: left - layout.x,
    y: top - layout.y,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}
