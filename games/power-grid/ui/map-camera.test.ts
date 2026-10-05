import { describe, expect, it } from 'vitest';
import {
  cameraScale,
  clampCamera,
  focusCamera,
  initialCamera,
  MAP_FRAME,
  NO_INSETS,
  panCamera,
  zoomCamera,
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
