import { afterEach, describe, expect, it, vi } from 'vitest';
import { measureViewport, subscribeViewport } from './viewport';

afterEach(() => vi.unstubAllGlobals());

function environment() {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const flush = () => {
    const queued = [...frames.values()];
    frames.clear();
    for (const callback of queued) callback(0);
  };
  const visual = Object.assign(new EventTarget(), { width: 390, height: 800 });
  const window = Object.assign(new EventTarget(), {
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: visual,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  let root: object | null = null;
  const properties = new Map<string, string>();
  const mutations: (() => void)[] = [];
  const disconnect = vi.fn();
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', { documentElement: {}, querySelector: () => root });
  const computedStyle = vi.fn(() => ({
    getPropertyValue: (name: string) => properties.get(name) ?? '',
  }));
  vi.stubGlobal('getComputedStyle', computedStyle);
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        mutations.push(callback);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  return {
    window,
    visual,
    properties,
    disconnect,
    computedStyle,
    flush,
    frames,
    styleChanged: () => mutations[0]?.(),
    mount: () => {
      root = {};
      mutations[1]?.();
      flush();
    },
    unmount: () => {
      root = null;
      mutations[1]?.();
      flush();
    },
    mutate: () => mutations[1]?.(),
  };
}

describe('document-local CSS viewport', () => {
  it('subtracts supplied safe area once from this iframe, without parent margins or DPR', () => {
    const result = measureViewport(
      { width: 640, height: 720 },
      { width: 620, height: 610 },
      { top: 20, bottom: 30, left: 10, right: 10 },
    );
    expect(result.viewport).toEqual({ width: 620, height: 610 });
    expect(result.available).toEqual({ width: 600, height: 560 });
    expect(result.orientation).toBe('landscape');
  });

  it('uses visual keyboard height and bounds invalid/inordinate insets without negative content', () => {
    expect(
      measureViewport({ width: 390, height: 844 }, { width: 390, height: 350 })
        .available,
    ).toEqual({ width: 390, height: 350 });
    expect(
      measureViewport({ width: 100.8, height: 90.2 }, null, {
        top: 200,
        left: -10,
        right: Number.NaN,
      }).available,
    ).toEqual({ width: 100, height: 0 });
  });

  it('remeasures an initially missing root and its replacement without requiring a resize', () => {
    const f = environment(),
      changed = vi.fn();
    const stop = subscribeViewport('[data-root]', '--safe-', changed);
    expect(changed.mock.lastCall?.[0].available.height).toBe(800);
    f.properties.set('--safe-bottom', '34px');
    f.mount();
    expect(changed.mock.lastCall?.[0].available.height).toBe(766);
    f.unmount();
    expect(changed.mock.lastCall?.[0].available.height).toBe(800);
    f.properties.set('--safe-bottom', '20px');
    f.mount();
    expect(changed.mock.lastCall?.[0].available.height).toBe(780);
    stop();
  });

  it('deduplicates unrelated DOM mutations and removes both resize listeners on cleanup', () => {
    const f = environment(),
      changed = vi.fn();
    const removeWindow = vi.spyOn(f.window, 'removeEventListener');
    const removeVisual = vi.spyOn(f.visual, 'removeEventListener');
    const stop = subscribeViewport('[data-root]', '--safe-', changed);
    f.mutate();
    f.window.dispatchEvent(new Event('resize'));
    expect(changed).toHaveBeenCalledTimes(1);
    f.visual.height = 400;
    f.visual.dispatchEvent(new Event('resize'));
    f.flush();
    expect(changed).toHaveBeenCalledTimes(2);
    expect(changed.mock.lastCall?.[0].available.height).toBe(400);
    stop();
    f.window.innerWidth = 200;
    f.window.dispatchEvent(new Event('resize'));
    f.visual.height = 300;
    f.visual.dispatchEvent(new Event('resize'));
    f.mutate();
    expect(changed).toHaveBeenCalledTimes(2);
    expect(removeWindow).toHaveBeenCalledTimes(1);
    expect(removeVisual).toHaveBeenCalledTimes(1);
    expect(f.disconnect).toHaveBeenCalledTimes(2);
  });

  it('coalesces resize and ancestor styles, ignores unchanged-root child mutations, cancels queued reads', () => {
    const f = environment(),
      changed = vi.fn();
    const stop = subscribeViewport('[data-root]', '--safe-', changed);
    f.mount();
    f.computedStyle.mockClear();
    for (let index = 0; index < 20; index++) {
      f.mutate();
      f.styleChanged();
      f.window.dispatchEvent(new Event('resize'));
    }
    expect(f.computedStyle).not.toHaveBeenCalled();
    expect(f.frames.size).toBe(1);
    f.flush();
    expect(f.computedStyle).toHaveBeenCalledTimes(1);
    f.mutate();
    f.flush();
    expect(f.computedStyle).toHaveBeenCalledTimes(1);
    f.styleChanged();
    stop();
    f.flush();
    expect(f.frames.size).toBe(0);
    expect(f.computedStyle).toHaveBeenCalledTimes(1);
  });
});
