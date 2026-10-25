/** Presentation geometry only. No room role, authorization or saved state is inferred. */
export type CanvasLayout =
  'host-landscape' | 'player-portrait' | 'player-landscape';
export type CanvasPreference = 'auto' | 'portrait' | 'wide';
export type CanvasRole = 'host' | 'public' | 'player';
export interface CanvasPoint {
  x: number;
  y: number;
}
export interface CanvasRect extends CanvasPoint {
  width: number;
  height: number;
}
export const canvasSizes = {
  'host-landscape': { width: 1280, height: 720 },
  'player-portrait': { width: 360, height: 800 },
  'player-landscape': { width: 640, height: 360 },
} as const;
export const canvasPreferenceKey = 'tablemax-player-layout-v3';
const previousPreferenceKeys = [
  'tablemax-workspace-display-mode-v2',
  'tablemax-player-display-mode',
];
export function readCanvasPreference(
  storage: Pick<Storage, 'getItem'> | null,
): CanvasPreference {
  try {
    const current = storage?.getItem(canvasPreferenceKey);
    if (current === 'auto' || current === 'portrait' || current === 'wide')
      return current;
    for (const key of previousPreferenceKeys) {
      const stored = storage?.getItem(key);
      if (stored === 'portrait' || stored === 'wide') return stored;
    }
  } catch {
    // Unavailable storage never prevents play or the current session's choice.
  }
  return 'auto';
}
export function saveCanvasPreference(
  storage: Pick<Storage, 'setItem'> | null,
  value: CanvasPreference,
) {
  try {
    storage?.setItem(canvasPreferenceKey, value);
  } catch {
    // Keep the explicit choice in memory; automatic fallbacks are never saved.
  }
}
export function canvasFits(
  space: Pick<CanvasRect, 'width' | 'height'>,
  layout: CanvasLayout,
) {
  const size = canvasSizes[layout];
  return space.width >= size.width && space.height >= size.height;
}
export function selectCanvasLayout(
  space: Pick<CanvasRect, 'width' | 'height'>,
  role: CanvasRole,
  preference: CanvasPreference,
  previous?: CanvasLayout,
): {
  layout: CanvasLayout;
  fitStatus: 'fits' | 'fallback' | 'overflow';
  selectionReason: 'host' | 'explicit' | 'automatic' | 'fallback' | 'overflow';
} {
  if (role !== 'player')
    return {
      layout: 'host-landscape',
      fitStatus: canvasFits(space, 'host-landscape') ? 'fits' : 'overflow',
      selectionReason: 'host',
    };
  const portrait = canvasFits(space, 'player-portrait');
  const landscape = canvasFits(space, 'player-landscape');
  const preferred =
    preference === 'portrait'
      ? 'player-portrait'
      : preference === 'wide'
        ? 'player-landscape'
        : null;
  if (preferred && canvasFits(space, preferred))
    return {
      layout: preferred,
      fitStatus: 'fits',
      selectionReason: 'explicit',
    };
  if (portrait || landscape) {
    let layout: CanvasLayout;
    if (!portrait) layout = 'player-landscape';
    else if (!landscape) layout = 'player-portrait';
    else if (
      previous &&
      previous !== 'host-landscape' &&
      (previous === 'player-portrait'
        ? space.width < space.height * 1.05
        : space.height < space.width * 1.05)
    )
      layout = previous;
    else
      layout =
        space.width >= space.height ? 'player-landscape' : 'player-portrait';
    return {
      layout,
      fitStatus: preferred ? 'fallback' : 'fits',
      selectionReason: preferred ? 'fallback' : 'automatic',
    };
  }
  return {
    layout:
      preferred ??
      (previous && previous !== 'host-landscape'
        ? previous
        : space.width >= space.height
          ? 'player-landscape'
          : 'player-portrait'),
    fitStatus: 'overflow',
    selectionReason: 'overflow',
  };
}
export function clientPointToLogical(
  point: CanvasPoint,
  rendered: CanvasRect,
  logical: { width: number; height: number },
): CanvasPoint {
  return {
    x: ((point.x - rendered.x) * logical.width) / (rendered.width || 1),
    y: ((point.y - rendered.y) * logical.height) / (rendered.height || 1),
  };
}
export function logicalPointToClient(
  point: CanvasPoint,
  rendered: CanvasRect,
  logical: { width: number; height: number },
): CanvasPoint {
  return {
    x: rendered.x + (point.x * rendered.width) / logical.width,
    y: rendered.y + (point.y * rendered.height) / logical.height,
  };
}
