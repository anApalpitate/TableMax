import { describe, expect, it } from 'vitest';
import {
  cameraScale,
  CLASSIC_MAP_FRAME,
  clampCamera,
  focusCamera,
  initialCamera,
  MAP_FRAME,
  NO_INSETS,
  panCamera,
  zoomCamera,
  wheelZoomTarget,
  focusVisible,
} from './map-camera';
describe('cropped map camera', () => {
  const surface = { width: 1280, height: 620, insets: NO_INSETS };
  it('allows four-direction movement at minimum zoom and bounds large drags', () => {
    const camera = initialCamera();
    for (const [dx, dy] of [
      [40, 0],
      [-40, 0],
      [0, 40],
      [0, -40],
    ]) {
      const moved = panCamera(camera, surface, dx!, dy!);
      expect(moved.center).not.toEqual(camera.center);
      expect(moved.follow).toBe(false);
    }
    const moved = panCamera(camera, surface, 100000, -100000);
    const scale = cameraScale(surface, moved.zoom);
    expect(moved.center.x - surface.width / (2 * scale)).toBeCloseTo(
      MAP_FRAME.x,
    );
    expect(moved.center.y + surface.height / (2 * scale)).toBeCloseTo(
      MAP_FRAME.y + MAP_FRAME.height,
    );
  });
  it('places a target inside the area not covered by drawers', () => {
    const covered = {
      ...surface,
      insets: { left: 400, right: 300, top: 0, bottom: 190 },
    };
    const target = { x: 650, y: 450 };
    const camera = focusCamera(initialCamera(), covered, [target]);
    const scale = cameraScale(covered, camera.zoom);
    expect(
      surface.width / 2 + (target.x - camera.center.x) * scale,
    ).toBeCloseTo((400 + 980) / 2);
    expect(
      surface.height / 2 + (target.y - camera.center.y) * scale,
    ).toBeCloseTo(215);
  });
  it('keeps the point under the zoom anchor stationary and clamps zoom', () => {
    const camera = initialCamera();
    const anchor = { x: 800, y: 300 };
    const worldX =
      camera.center.x +
      (anchor.x - surface.width / 2) / cameraScale(surface, 1);
    const next = zoomCamera(camera, surface, 2, anchor);
    expect(
      next.center.x +
        (anchor.x - surface.width / 2) / cameraScale(surface, next.zoom),
    ).toBeCloseTo(worldX);
    expect(clampCamera({ ...camera, zoom: 100 }, surface).zoom).toBe(4);
  });
});

it('uses full-image hard edges even when drawers cover most of the viewport', () => {
  for (const [width, height] of [
    [854, 350],
    [1280, 600],
    [3840, 1900],
    [320, 320],
    [844, 220],
  ]) {
    const surface = {
      width: width!,
      height: height!,
      insets: { left: 700, right: 240, top: 0, bottom: 250 },
    };
    for (const zoom of [1, 2, 4])
      for (const dx of [-100000, 100000])
        for (const dy of [-100000, 100000]) {
          const camera = panCamera(
              { ...initialCamera(), zoom },
              surface,
              dx,
              dy,
            ),
            scale = cameraScale(surface, zoom);
          expect(camera.center.x - width! / (2 * scale)).toBeGreaterThanOrEqual(
            MAP_FRAME.x - 0.00001,
          );
          expect(camera.center.x + width! / (2 * scale)).toBeLessThanOrEqual(
            MAP_FRAME.x + MAP_FRAME.width + 0.00001,
          );
          expect(
            camera.center.y - height! / (2 * scale),
          ).toBeGreaterThanOrEqual(MAP_FRAME.y - 0.00001);
          expect(camera.center.y + height! / (2 * scale)).toBeLessThanOrEqual(
            MAP_FRAME.y + MAP_FRAME.height + 0.00001,
          );
        }
    expect(width! / cameraScale(surface, 1)).toBeLessThan(1200);
  }
});
it('normalizes pixel/line/page wheel deltas and respects zoom limits', () => {
  expect(wheelZoomTarget(2, 16, 0, 500)).toBe(wheelZoomTarget(2, 1, 1, 500));
  expect(wheelZoomTarget(2, 500, 0, 500)).toBe(wheelZoomTarget(2, 1, 2, 500));
  expect(wheelZoomTarget(1, 500, 0, 500)).toBe(1);
  expect(wheelZoomTarget(4, -500, 0, 500)).toBe(4);
});
it('uses decorative side terrain to reveal edge targets behind drawers', () => {
  const surface = {
    width: 1280,
    height: 600,
    insets: { left: 920, right: 52, top: 0, bottom: 190 },
  };
  const point = { x: 131, y: 324 };
  const camera = focusCamera(initialCamera(), surface, [point]);
  expect(camera.zoom).toBeLessThanOrEqual(4);
  expect(focusVisible(camera, surface, point)).toBe(true);
});
it('preserves classic scale and center while adding exactly 25 percent per side', () => {
  expect(MAP_FRAME.x).toBe(-CLASSIC_MAP_FRAME.width / 4);
  expect(MAP_FRAME.width).toBe(CLASSIC_MAP_FRAME.width * 1.5);
  expect(MAP_FRAME.y).toBe(-CLASSIC_MAP_FRAME.height / 4);
  expect(MAP_FRAME.height).toBe(CLASSIC_MAP_FRAME.height * 1.5);
  expect(initialCamera().center).toEqual({ x: 600, y: 450 });
  const surface = { width: 1280, height: 620, insets: NO_INSETS };
  expect(cameraScale(surface, 1)).toBe(
    Math.max(surface.width / 1200, surface.height / 900) * 1.06,
  );
  const covered = { ...surface, insets: { ...NO_INSETS, left: 322 } };
  const leftCity = { x: 40, y: 450 };
  const next = focusCamera(initialCamera(), covered, [leftCity]);
  expect(next.zoom).toBe(1);
  expect(focusVisible(next, covered, leftCity)).toBe(true);
});
