import { describe, expect, it } from 'vitest';
import {
  canvasPreferenceKey,
  clientPointToLogical,
  logicalPointToClient,
  readCanvasPreference,
  saveCanvasPreference,
  selectCanvasLayout,
} from './fixed-layout';

describe('fixed canvas presentation contract', () => {
  it('keeps management in its public landscape composition at and below minimum', () => {
    expect(
      selectCanvasLayout({ width: 1280, height: 720 }, 'host', 'auto'),
    ).toMatchObject({ layout: 'host-landscape', fitStatus: 'fits' });
    for (const space of [
      { width: 1279, height: 720 },
      { width: 1280, height: 719 },
    ])
      expect(selectCanvasLayout(space, 'host', 'wide')).toMatchObject({
        layout: 'host-landscape',
        fitStatus: 'overflow',
      });
  });
  it('falls back at a one-pixel shortage without altering the explicit preference', () => {
    const preference = 'wide';
    expect(
      selectCanvasLayout({ width: 640, height: 640 }, 'player', preference),
    ).toMatchObject({ layout: 'player-landscape', fitStatus: 'fits' });
    expect(
      selectCanvasLayout({ width: 639, height: 640 }, 'player', preference),
    ).toMatchObject({ layout: 'player-portrait', fitStatus: 'fallback' });
    expect(
      selectCanvasLayout({ width: 640, height: 360 }, 'player', preference),
    ).toMatchObject({ layout: 'player-landscape', fitStatus: 'fits' });
  });
  it('does not claim a subminimum phone fits by shrinking it', () => {
    for (const space of [
      { width: 359, height: 640 },
      { width: 360, height: 639 },
    ])
      expect(selectCanvasLayout(space, 'player', 'portrait')).toMatchObject({
        layout: 'player-portrait',
        fitStatus: 'overflow',
      });
  });
  it('selects only a composition that fits instead of relying on orientation alone', () => {
    expect(
      selectCanvasLayout({ width: 600, height: 650 }, 'player', 'auto'),
    ).toMatchObject({ layout: 'player-portrait', fitStatus: 'fits' });
    expect(
      selectCanvasLayout({ width: 650, height: 400 }, 'player', 'auto'),
    ).toMatchObject({ layout: 'player-landscape', fitStatus: 'fits' });
  });
  it('keeps the previous auto composition within the direction deadband', () => {
    expect(
      selectCanvasLayout(
        { width: 810, height: 800 },
        'player',
        'auto',
        'player-portrait',
      ).layout,
    ).toBe('player-portrait');
    expect(
      selectCanvasLayout(
        { width: 850, height: 800 },
        'player',
        'auto',
        'player-portrait',
      ).layout,
    ).toBe('player-landscape');
  });
  it('maps actual client rectangles once, including offset and externally scaled output', () => {
    const rect = { x: 130, y: -20, width: 1280, height: 720 };
    const logical = { width: 640, height: 360 };
    for (const point of [
      { x: 0, y: 0 },
      { x: 640, y: 360 },
      { x: 319.5, y: 177.25 },
    ])
      expect(
        clientPointToLogical(
          logicalPointToClient(point, rect, logical),
          rect,
          logical,
        ),
      ).toEqual(point);
    expect(clientPointToLogical({ x: 1410, y: 700 }, rect, logical)).toEqual({
      x: 640,
      y: 360,
    });
  });
  it('imports only existing explicit legacy choices and never persists automatic fallback', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(readCanvasPreference(storage)).toBe('auto');
    values.set('tablemax-player-display-mode', 'wide');
    expect(readCanvasPreference(storage)).toBe('wide');
    values.set('tablemax-workspace-display-mode-v2', 'portrait');
    expect(readCanvasPreference(storage)).toBe('portrait');
    saveCanvasPreference(storage, 'auto');
    expect(readCanvasPreference(storage)).toBe('auto');
    expect(values.get(canvasPreferenceKey)).toBe('auto');
    expect(values.get('tablemax-workspace-display-mode-v2')).toBe('portrait');
  });
  it('remains usable when local storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readCanvasPreference(storage)).toBe('auto');
    expect(() => saveCanvasPreference(storage, 'wide')).not.toThrow();
  });
});
