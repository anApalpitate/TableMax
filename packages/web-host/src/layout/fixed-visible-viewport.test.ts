import { describe, expect, it } from 'vitest';
import { selectCanvasLayout } from './fixed-layout';
import {
  fixedFocusedCanvasSelection,
  fixedVisualViewportClip,
} from './fixed-visible-viewport';

const layout = { x: 0, y: 0, width: 360, height: 800 };
const visual = {
  offsetLeft: 0,
  offsetTop: 0,
  width: 360,
  height: 800,
  scale: 1,
};

describe('fixed visual viewport geometry', () => {
  it('keeps the full layout for absent or unshortened visual viewports', () => {
    expect(fixedVisualViewportClip(layout, null)).toEqual(layout);
    expect(fixedVisualViewportClip(layout, visual)).toEqual(layout);
  });

  it('moves and shortens the actual scrollport without shrinking its canvas', () => {
    expect(
      fixedVisualViewportClip(layout, {
        ...visual,
        offsetTop: 30,
        height: 400,
      }),
    ).toEqual({ x: 0, y: 30, width: 360, height: 400 });
    expect(
      fixedVisualViewportClip(
        { x: 12, y: 20, width: 360, height: 800 },
        { ...visual, width: 1000, offsetTop: 30, height: 400 },
      ),
    ).toEqual({ x: 0, y: 10, width: 360, height: 400 });
  });

  it('intersects side and fully occluded boundaries without negative sizes', () => {
    expect(
      fixedVisualViewportClip(layout, {
        ...visual,
        offsetLeft: 20,
        width: 200,
      }),
    ).toEqual({ x: 20, y: 0, width: 200, height: 800 });
    expect(
      fixedVisualViewportClip(layout, {
        ...visual,
        offsetTop: 900,
        height: 100,
      }),
    ).toEqual({ x: 0, y: 800, width: 360, height: 0 });
  });

  it('does not compensate for pinch or focused-input visual magnification', () => {
    for (const scale of [0.8, 1.25, 1.5, 2])
      expect(
        fixedVisualViewportClip(layout, { ...visual, height: 400, scale }),
      ).toEqual(layout);
  });

  it('uses the already zoomed CSS layout dimensions for real page zoom', () => {
    const pageZoomLayout = { x: 0, y: 0, width: 720, height: 600 };
    expect(
      fixedVisualViewportClip(pageZoomLayout, {
        ...visual,
        width: 720,
        height: 600,
        scale: 1,
      }),
    ).toEqual(pageZoomLayout);
  });
});

describe('focused fixed canvas visibility', () => {
  it('recovers after a short viewport was committed during submit blur and input refocuses', () => {
    for (const preference of ['auto', 'portrait'] as const) {
      const blurred = selectCanvasLayout(
        { width: 360, height: 400 },
        'player',
        preference,
        'player-portrait',
      );
      expect(blurred.fitStatus).toBe('overflow');
      const restored = fixedFocusedCanvasSelection(
        layout,
        'player',
        preference,
        blurred.layout,
      );
      expect(restored.layout).toBe('player-portrait');
      expect(restored.fitStatus).toBe('fits');
    }
  });

  it('holds the focused composition and reports overflow even if the other composition fits', () => {
    expect(
      fixedFocusedCanvasSelection(
        { width: 640, height: 400 },
        'player',
        'auto',
        'player-portrait',
      ),
    ).toMatchObject({ layout: 'player-portrait', fitStatus: 'overflow' });
    expect(
      fixedFocusedCanvasSelection(layout, 'player', 'auto', 'player-landscape'),
    ).toMatchObject({ layout: 'player-landscape', fitStatus: 'overflow' });
  });

  it('reports fallback against the explicit preference while holding composition', () => {
    expect(
      fixedFocusedCanvasSelection(layout, 'player', 'wide', 'player-portrait'),
    ).toEqual({
      layout: 'player-portrait',
      fitStatus: 'fallback',
      selectionReason: 'fallback',
    });
    expect(
      fixedFocusedCanvasSelection(
        { width: 900, height: 800 },
        'player',
        'wide',
        'player-landscape',
      ),
    ).toEqual({
      layout: 'player-landscape',
      fitStatus: 'fits',
      selectionReason: 'explicit',
    });
  });

  it('reports host shortage and recovery without changing composition', () => {
    expect(
      fixedFocusedCanvasSelection(
        { width: 1280, height: 400 },
        'host',
        'auto',
        'host-landscape',
      ),
    ).toMatchObject({ layout: 'host-landscape', fitStatus: 'overflow' });
    expect(
      fixedFocusedCanvasSelection(
        { width: 1280, height: 720 },
        'host',
        'auto',
        'host-landscape',
      ),
    ).toEqual({
      layout: 'host-landscape',
      fitStatus: 'fits',
      selectionReason: 'host',
    });
  });
});
