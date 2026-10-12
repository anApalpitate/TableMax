import { expect, it } from 'vitest';
import {
  interactionSector,
  normalizedInteractionPoint,
  interactionWheel,
  clampInteractionOrb,
  restingInteractionOrb,
} from './model';
it('keeps the default control in the reserved edge when switching portrait to wide, without moving user-dragged preferences', () => {
  const initial = { x: 1 - 38 / 360, y: 0.67, defaultPosition: true };
  expect(restingInteractionOrb(initial, 1280, 720, 0)).toEqual({
    x: 1242,
    y: 30,
  });
  expect(restingInteractionOrb(initial, 320, 568, 0)).toEqual({
    x: 282,
    y: 30,
  });
  expect(restingInteractionOrb({ x: 0.25, y: 0.5 }, 1280, 720, 0)).toEqual({
    x: 320,
    y: 360,
  });
});
it('keeps the themed default orb with the scrolling title without moving a user-dragged orb', () => {
  const initial = { x: 0.9, y: 0.67, defaultPosition: true };
  expect(restingInteractionOrb(initial, 380, 720, 0, 160, true)).toEqual({
    x: 342,
    y: -130,
  });
  expect(restingInteractionOrb(initial, 380, 720, 0, 160, false)).toEqual({
    x: 342,
    y: 30,
  });
  expect(
    restingInteractionOrb({ x: 0.5, y: 0.5 }, 380, 720, 0, 160, true),
  ).toEqual({ x: 190, y: 360 });
});
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
it('keeps a dragged orb and its centered open wheel inside resized viewports', () => {
  expect(clampInteractionOrb(-50, 1000, 320, 568)).toEqual({ x: 30, y: 538 });
  expect(clampInteractionOrb(290, 538, 320, 568, 138)).toEqual({
    x: 182,
    y: 430,
  });
  expect(clampInteractionOrb(100, 100, 200, 220, 138)).toEqual({
    x: 100,
    y: 110,
  });
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
