import { INTERACTION_CATALOG } from '@tablemax/protocol';
export const interactionWheel = [
  ...INTERACTION_CATALOG.shots.map((shot) => ({
    id: shot.id,
    label: shot.label,
    image: shot.image,
  })),
  { id: 'speech', label: '发言', image: '' },
] as const;
/** Six equal clockwise sectors; the centre hole and outside are cancellation. */
export function interactionSector(x: number, y: number, radius = 126) {
  const distance = Math.hypot(x, y);
  if (distance < 35 || distance > radius + 18) return -1;
  return Math.floor(
    (((Math.atan2(y, x) * 180) / Math.PI + 120 + 360) % 360) / 60,
  );
}
export function normalizedInteractionPoint(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    x: Math.max(0, Math.min(1, x / Math.max(1, width))),
    y: Math.max(0, Math.min(1, y / Math.max(1, height))),
  };
}
