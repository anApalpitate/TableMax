// Decorative extensions never move the classic board's world coordinates.
export const CLASSIC_MAP_FRAME = { x: 0, y: 0, width: 1200, height: 900 };
export const MAP_FRAME = { x: -300, y: -225, width: 1800, height: 1350 };
export type MapPoint = { x: number; y: number };
export type MapCamera = { center: MapPoint; zoom: number; follow: boolean };
export type MapInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};
export type MapSurface = { width: number; height: number; insets: MapInsets };
export const NO_INSETS: MapInsets = { left: 0, right: 0, top: 0, bottom: 0 };
export function initialCamera(): MapCamera {
  return {
    center: {
      x: MAP_FRAME.x + MAP_FRAME.width / 2,
      y: MAP_FRAME.y + MAP_FRAME.height / 2,
    },
    zoom: 1,
    follow: true,
  };
}
export function cameraScale(surface: MapSurface, zoom: number) {
  return (
    Math.max(
      surface.width / CLASSIC_MAP_FRAME.width,
      surface.height / CLASSIC_MAP_FRAME.height,
    ) *
    1.06 *
    zoom
  );
}
export function safeMapRect(surface: MapSurface) {
  const { width, height, insets } = surface;
  const left = Math.min(insets.left, Math.max(0, width - 96));
  const right = Math.max(left + 96, width - insets.right);
  const top = Math.min(insets.top, Math.max(0, height - 80));
  const bottom = Math.max(top + 80, height - insets.bottom);
  return {
    left,
    right: Math.min(width, right),
    top,
    bottom: Math.min(height, bottom),
  };
}
export function clampCamera(camera: MapCamera, surface: MapSurface): MapCamera {
  const zoom = Math.max(1, Math.min(4, camera.zoom));
  const scale = cameraScale(surface, zoom);
  const safe = {
    left: 0,
    top: 0,
    right: surface.width,
    bottom: surface.height,
  };
  const minX = MAP_FRAME.x + (surface.width / 2 - safe.left) / scale;
  const maxX =
    MAP_FRAME.x + MAP_FRAME.width - (safe.right - surface.width / 2) / scale;
  const minY = MAP_FRAME.y + (surface.height / 2 - safe.top) / scale;
  const maxY =
    MAP_FRAME.y + MAP_FRAME.height - (safe.bottom - surface.height / 2) / scale;
  return {
    ...camera,
    zoom,
    center: {
      x: Math.max(minX, Math.min(maxX, camera.center.x)),
      y: Math.max(minY, Math.min(maxY, camera.center.y)),
    },
  };
}
export function focusCamera(
  camera: MapCamera,
  surface: MapSurface,
  points: readonly MapPoint[],
): MapCamera {
  if (!points.length) return clampCamera(camera, surface);
  const safe = safeMapRect(surface);
  const x =
    (Math.min(...points.map((p) => p.x)) +
      Math.max(...points.map((p) => p.x))) /
    2;
  const y =
    (Math.min(...points.map((p) => p.y)) +
      Math.max(...points.map((p) => p.y))) /
    2;
  for (let zoom = camera.zoom; ; zoom = Math.min(4, zoom * 1.15)) {
    const scale = cameraScale(surface, zoom);
    const next = clampCamera(
      {
        ...camera,
        zoom,
        center: {
          x: x - (safe.left + safe.right - surface.width) / 2 / scale,
          y: y - (safe.top + safe.bottom - surface.height) / 2 / scale,
        },
      },
      surface,
    );
    if (
      points.length !== 1 ||
      focusVisible(next, surface, points[0]!) ||
      zoom >= 4
    )
      return next;
  }
}
export function panCamera(
  camera: MapCamera,
  surface: MapSurface,
  dx: number,
  dy: number,
): MapCamera {
  const scale = cameraScale(surface, camera.zoom);
  return clampCamera(
    {
      ...camera,
      follow: false,
      center: {
        x: camera.center.x - dx / scale,
        y: camera.center.y - dy / scale,
      },
    },
    surface,
  );
}
export function zoomCamera(
  camera: MapCamera,
  surface: MapSurface,
  zoom: number,
  anchor?: MapPoint,
): MapCamera {
  const next = Math.max(1, Math.min(4, zoom));
  const previousScale = cameraScale(surface, camera.zoom);
  const nextScale = cameraScale(surface, next);
  const dx = (anchor?.x ?? surface.width / 2) - surface.width / 2;
  const dy = (anchor?.y ?? surface.height / 2) - surface.height / 2;
  return clampCamera(
    {
      center: {
        x: camera.center.x + dx / previousScale - dx / nextScale,
        y: camera.center.y + dy / previousScale - dy / nextScale,
      },
      zoom: next,
      follow: false,
    },
    surface,
  );
}

export function focusVisible(
  camera: MapCamera,
  surface: MapSurface,
  point: MapPoint,
) {
  const rect = safeMapRect(surface),
    scale = cameraScale(surface, camera.zoom);
  const x = surface.width / 2 + (point.x - camera.center.x) * scale;
  const y = surface.height / 2 + (point.y - camera.center.y) * scale;
  return (
    x >= rect.left + 22 &&
    x <= rect.right - 22 &&
    y >= rect.top + 22 &&
    y <= rect.bottom - 22
  );
}
export function wheelZoomTarget(
  zoom: number,
  delta: number,
  mode: number,
  height: number,
) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? height : 1);
  return Math.max(
    1,
    Math.min(
      4,
      zoom * Math.exp(-Math.max(-240, Math.min(240, pixels)) * 0.0015),
    ),
  );
}
