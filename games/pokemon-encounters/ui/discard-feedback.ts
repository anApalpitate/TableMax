import type { DiscardSource } from '../shared/discard-trails';

export type DiscardTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A static reduced-motion landing requires an actual saved discard and a live visible target. */
export function discardLanding(
  savedSources: readonly DiscardSource[] | undefined,
  visibleTarget: DiscardTargetRect | null,
  viewport: { width: number; height: number },
): DiscardTargetRect | null {
  if (!savedSources?.length || !visibleTarget) return null;
  const { x, y, width, height } = visibleTarget;
  if (
    ![x, y, width, height, viewport.width, viewport.height].every(
      Number.isFinite,
    ) ||
    width <= 4 ||
    height <= 4 ||
    x + width <= 0 ||
    y + height <= 0 ||
    x >= viewport.width ||
    y >= viewport.height
  )
    return null;
  return { x: x + 2, y: y + 2, width: width - 4, height: height - 4 };
}
