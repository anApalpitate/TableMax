import { describe, expect, it } from 'vitest';
import { discardLanding } from './discard-feedback';

const target = { x: 80, y: 40, width: 60, height: 84 };
const viewport = { width: 320, height: 568 };

describe('reduced-motion saved discard landing', () => {
  it('keeps one bounded target ring for a real discard even with multiple public sources', () => {
    expect(
      discardLanding(['@held', { seat: 'S1', slot: 3 }], target, viewport),
    ).toEqual({
      x: 82,
      y: 42,
      width: 56,
      height: 80,
    });
  });
  it('never substitutes a cached target or invents a landing for a relay, old event or restoration', () => {
    expect(discardLanding([], target, viewport)).toBeNull();
    expect(discardLanding(undefined, target, viewport)).toBeNull();
    expect(discardLanding(['@held'], null, viewport)).toBeNull();
  });
  it.each([
    { x: -60, y: 40, width: 60, height: 84 },
    { x: 320, y: 40, width: 60, height: 84 },
    { x: 80, y: -84, width: 60, height: 84 },
    { x: 80, y: 568, width: 60, height: 84 },
    { x: 80, y: 40, width: 0, height: 84 },
    { x: NaN, y: 40, width: 60, height: 84 },
  ])('omits an offscreen or invalid visible target: %j', (rect) => {
    expect(discardLanding(['@held'], rect, viewport)).toBeNull();
  });
});
