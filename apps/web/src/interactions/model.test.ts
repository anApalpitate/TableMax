import { expect, it } from 'vitest';
import {
  interactionSector,
  normalizedInteractionPoint,
  interactionWheel,
} from './model';
it('provides six equal sectors with a cancellation hole, outside and every direction reachable', () => {
  expect(interactionWheel).toHaveLength(6);
  expect(interactionSector(0, 0)).toBe(-1);
  expect(interactionSector(500, 0)).toBe(-1);
  for (let index = 0; index < 6; index++) {
    const angle = ((-90 + index * 60) * Math.PI) / 180;
    expect(interactionSector(Math.cos(angle) * 90, Math.sin(angle) * 90)).toBe(
      index,
    );
  }
});
it('maps clicks to viewport proportions independently of display size and clamps edge coordinates', () => {
  expect(normalizedInteractionPoint(80, 142, 320, 568)).toEqual({
    x: 0.25,
    y: 0.25,
  });
  expect(normalizedInteractionPoint(-10, 2000, 320, 568)).toEqual({
    x: 0,
    y: 1,
  });
});
