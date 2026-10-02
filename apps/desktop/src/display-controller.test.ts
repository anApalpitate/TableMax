import { EventEmitter } from 'node:events';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import {
  calculateDisplaySnapshot,
  DisplayController,
  DisplaySettingsStore,
  parseDisplayPreferences,
  type DisplayGeometry,
  type DisplayRequest,
  type DisplayWindow,
} from './display-controller';
import { displayChannels, type DisplaySnapshot } from './display-types';

const origin = 'http://127.0.0.1:38473';
const temporaryDirectories: string[] = [];
async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'tablemax-display-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    if (
      !resolve(directory).startsWith(
        resolve(tmpdir()) + sep + 'tablemax-display-',
      )
    )
      throw new Error('Refusing to remove a non-test directory');
    await rm(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

class TestWebContents extends EventEmitter {
  mainFrame = { url: `${origin}/host` };
  destroyed = false;
  zoomFactor = 1;
  modes: string[] = [];
  snapshots: DisplaySnapshot[] = [];
  zoomWrites = 0;
  getURL() {
    if (this.destroyed) throw new Error('Object has been destroyed');
    return this.mainFrame.url;
  }
  isDestroyed() {
    return this.destroyed;
  }
  setZoomMode(mode: 'isolated') {
    this.modes.push(mode);
  }
  setZoomFactor(factor: number) {
    if (this.destroyed) throw new Error('WebContents is destroyed');
    this.zoomFactor = factor;
    this.zoomWrites++;
  }
  send(channel: string, snapshot: DisplaySnapshot) {
    if (this.destroyed) throw new Error('Object has been destroyed');
    expect(channel).toBe(displayChannels.changed);
    this.snapshots.push(snapshot);
  }
  override off(...arguments_: Parameters<EventEmitter['off']>): this {
    if (this.destroyed) throw new Error('Object has been destroyed');
    return super.off(...arguments_);
  }
}

class TestWindow extends EventEmitter implements DisplayWindow {
  readonly contents = new TestWebContents();
  destroyed = false;
  viewport = { width: 1920, height: 1080 };
  screen = { width: 3840, height: 2160, scaleFactor: 1 };
  get webContents() {
    if (this.destroyed) throw new Error('Object has been destroyed');
    return this.contents;
  }
  constructor(role: 'host' | 'public' = 'host') {
    super();
    this.webContents.mainFrame.url = `${origin}/${role}`;
  }
  getBounds() {
    return this.getContentBounds();
  }
  getContentBounds() {
    if (this.destroyed) throw new Error('Object has been destroyed');
    return { x: 0, y: 0, ...this.viewport };
  }
  isDestroyed() {
    return this.destroyed;
  }
  close() {
    this.destroyed = true;
    this.contents.destroyed = true;
    this.emit('closed');
  }
  override off(...arguments_: Parameters<EventEmitter['off']>): this {
    if (this.destroyed) throw new Error('Object has been destroyed');
    return super.off(...arguments_);
  }
  request(): DisplayRequest {
    return {
      sender: this.webContents,
      senderFrame: this.webContents.mainFrame,
    };
  }
}

function geometry(window: DisplayWindow): DisplayGeometry {
  const testWindow = window as TestWindow;
  return { viewport: testWindow.viewport, screen: testWindow.screen };
}

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

it('uses native DIP content bounds, physical presets and OS DPI without shrinking feedback', () => {
  const preferences = { resolution: 'auto', interfaceScale: 100 } as const;
  const large = {
    viewport: { width: 3840, height: 2160 },
    screen: { width: 3840, height: 2160, scaleFactor: 1 },
  };
  const snapshot = calculateDisplaySnapshot(preferences, large);
  expect(snapshot.zoomFactor).toBe(2);
  expect(snapshot.viewport).toEqual(large.viewport);
  expect(snapshot.limited).toBe(false);
  for (const scaleFactor of [1, 1.25, 1.5, 2]) {
    const result = calculateDisplaySnapshot(
      { resolution: '3840x2160', interfaceScale: 100 },
      { ...large, screen: { ...large.screen, scaleFactor } },
    );
    expect(result.zoomFactor).toBeCloseTo(2 / scaleFactor);
    expect(result.screen.scaleFactor).toBe(scaleFactor);
  }
  for (const resolution of ['1280x720', '1920x1080', '2560x1440'] as const) {
    const result = calculateDisplaySnapshot(
      { resolution, interfaceScale: 125 },
      large,
    );
    expect(result.zoomFactor).toBeCloseTo(
      Math.max(1, Number(resolution.split('x')[0]) / 1920) * 1.25,
    );
    expect(result.limited).toBe(false);
  }
  expect(calculateDisplaySnapshot(preferences, large)).toEqual(snapshot);
});

it('limits readability requests to the visible window and the overall 300% maximum', () => {
  for (const [width, height, expected, limited] of [
    [1280, 720, 1, true],
    [1920, 1080, 1.5, false],
    [3840, 2160, 3, false],
    [5760, 3240, 3, true],
  ] as const) {
    const result = calculateDisplaySnapshot(
      { resolution: 'auto', interfaceScale: 150 },
      {
        viewport: { width, height },
        screen: { width, height, scaleFactor: 1 },
      },
    );
    expect(result.zoomFactor).toBeCloseTo(expected);
    expect(result.limited).toBe(limited);
  }
  const result = calculateDisplaySnapshot(
    { resolution: '3840x2160', interfaceScale: 150 },
    {
      viewport: { width: 1280, height: 800 },
      screen: { width: 3840, height: 2160, scaleFactor: 1 },
    },
  );
  expect(result.zoomFactor).toBeCloseTo(800 / 720);
  expect(result.limited).toBe(true);
});

it('rejects malformed settings rather than accepting extra authority or coercing values', () => {
  for (const input of [
    null,
    undefined,
    [],
    {},
    { resolution: 'auto' },
    { resolution: 'auto', interfaceScale: '125' },
    { resolution: 'auto', interfaceScale: 200 },
    { resolution: 'auto', interfaceScale: NaN },
    { resolution: '4096x2160', interfaceScale: 100 },
    { resolution: 'auto', interfaceScale: 100, channel: 'room:command' },
    Object.create({ resolution: 'auto', interfaceScale: 100 }),
    Object.assign(new Date(), { resolution: 'auto', interfaceScale: 100 }),
    { resolution: ['auto'], interfaceScale: 100 },
    { resolution: 'auto', interfaceScale: 100, [Symbol('extra')]: true },
  ])
    expect(() => parseDisplayPreferences(input)).toThrow('参数无效');
  expect(
    parseDisplayPreferences({ resolution: '1920x1080', interfaceScale: 125 }),
  ).toEqual({ resolution: '1920x1080', interfaceScale: 125 });
});

it('only authorizes the managed corresponding role main frame on the exact local origin', async () => {
  const store = new DisplaySettingsStore(await temporaryDirectory());
  const controller = new DisplayController(store, origin, geometry);
  const host = new TestWindow();
  controller.register(host, 'host');
  expect(controller.read(host.request()).zoomFactor).toBe(1);
  for (const url of [
    `${origin}/player`,
    `${origin}/player/game`,
    `${origin}/public`,
    `${origin}/host/unknown`,
    `${origin}/hostname`,
    'http://localhost:38473/host',
    'https://127.0.0.1:38473/host',
    'about:blank',
  ]) {
    host.webContents.mainFrame.url = url;
    expect(() => controller.read(host.request())).toThrow('桌面主窗口');
    expect(() =>
      controller.update(host.request(), {
        resolution: 'auto',
        interfaceScale: 125,
      }),
    ).toThrow('桌面主窗口');
  }
  host.webContents.mainFrame.url = `${origin}/host/game?screen=1#test`;
  expect(controller.read(host.request()).zoomFactor).toBe(1);
  for (const senderFrame of [null, { url: `${origin}/host/game` }])
    expect(() =>
      controller.read({ sender: host.webContents, senderFrame }),
    ).toThrow('桌面主窗口');
  expect(() => controller.read(new TestWindow().request())).toThrow(
    '桌面主窗口',
  );
  expect(() => controller.read(host.request(), {})).toThrow('参数无效');
  expect(() =>
    controller.update(
      host.request(),
      { resolution: 'auto', interfaceScale: 100 },
      'extra',
    ),
  ).toThrow('参数无效');
  const closedRequest = host.request();
  host.close();
  expect(() => controller.read(closedRequest)).toThrow('桌面主窗口');
});

it('keeps each open window independent while saving role defaults for newly opened windows', async () => {
  const directory = await temporaryDirectory();
  const store = new DisplaySettingsStore(directory);
  const controller = new DisplayController(store, origin, geometry);
  const host = new TestWindow();
  const publicA = new TestWindow('public');
  const publicB = new TestWindow('public');
  for (const [window, role] of [
    [host, 'host'],
    [publicA, 'public'],
    [publicB, 'public'],
  ] as const)
    controller.register(window, role);
  const hostPreferences = {
    resolution: '1920x1080',
    interfaceScale: 125,
  } as const;
  const publicPreferences = {
    resolution: '1920x1080',
    interfaceScale: 150,
  } as const;
  await Promise.all([
    controller.update(host.request(), hostPreferences),
    controller.update(publicA.request(), publicPreferences),
  ]);
  expect(host.webContents.zoomFactor).toBe(1.25);
  expect(publicA.webContents.zoomFactor).toBe(1.5);
  expect(publicB.webContents.zoomFactor).toBe(1);
  controller.refreshAll();
  expect(controller.read(publicB.request()).preferences).toEqual({
    resolution: 'auto',
    interfaceScale: 100,
  });
  expect(publicB.webContents.zoomFactor).toBe(1);
  publicA.webContents.emit('did-finish-load');
  expect(publicA.webContents.zoomFactor).toBe(1.5);
  const newlyOpenedPublic = new TestWindow('public');
  controller.register(newlyOpenedPublic, 'public');
  expect(newlyOpenedPublic.webContents.zoomFactor).toBe(1.5);
  for (const window of [host, publicA, publicB, newlyOpenedPublic])
    expect(window.webContents.modes).toEqual(['isolated']);
  const restored = new DisplaySettingsStore(directory);
  await restored.load();
  expect(restored.read('host')).toEqual(hostPreferences);
  expect(restored.read('public')).toEqual(publicPreferences);
  expect(JSON.parse(await readFile(store.path, 'utf8'))).toEqual({
    version: 1,
    host: hostPreferences,
    public: publicPreferences,
  });
});

it('recalculates resize, fullscreen, screen movement and DPI with native bounds and cleans listeners', async () => {
  const store = new DisplaySettingsStore(await temporaryDirectory());
  const controller = new DisplayController(store, origin, geometry);
  const window = new TestWindow();
  controller.register(window, 'host');
  window.viewport = { width: 3840, height: 2160 };
  window.emit('resize');
  expect(window.webContents.zoomFactor).toBe(2);
  for (const event of ['move', 'enter-full-screen', 'leave-full-screen']) {
    window.emit(event);
    expect(window.webContents.zoomFactor).toBe(2);
  }
  await controller.update(window.request(), {
    resolution: '3840x2160',
    interfaceScale: 100,
  });
  window.screen = { width: 2560, height: 1440, scaleFactor: 1.5 };
  controller.refreshAll();
  expect(window.webContents.zoomFactor).toBeCloseTo(4 / 3);
  expect(window.webContents.snapshots.at(-1)?.screen).toEqual(window.screen);
  expect(window.viewport).toEqual({ width: 3840, height: 2160 });
  window.viewport = { width: 1280, height: 720 };
  window.emit('resize');
  expect(window.webContents.zoomFactor).toBe(1);
  expect(window.webContents.snapshots.at(-1)?.limited).toBe(true);
  controller.stop();
  const writes = window.webContents.zoomWrites;
  for (const event of [
    'resize',
    'move',
    'enter-full-screen',
    'leave-full-screen',
  ]) {
    expect(window.listenerCount(event)).toBe(0);
    window.emit(event);
  }
  expect(window.webContents.listenerCount('did-finish-load')).toBe(0);
  expect(window.webContents.zoomWrites).toBe(writes);
});

it('recovers damaged settings without changing room.sqlite or overwriting the original until a valid save', async () => {
  const directory = await temporaryDirectory();
  const database = join(directory, 'room.sqlite');
  const gameSave = Buffer.from('game-save must stay unchanged');
  await writeFile(database, gameSave);
  const store = new DisplaySettingsStore(directory);
  for (const content of [
    '{broken',
    JSON.stringify({ version: 2, host: {}, public: {} }),
    JSON.stringify({
      version: 1,
      host: { resolution: 'auto', interfaceScale: 100 },
      public: { resolution: 'auto', interfaceScale: 200 },
    }),
  ]) {
    await writeFile(store.path, content);
    await store.load();
    expect(store.read('host')).toEqual({
      resolution: 'auto',
      interfaceScale: 100,
    });
    expect(store.read('public')).toEqual({
      resolution: 'auto',
      interfaceScale: 100,
    });
    expect(await readFile(store.path, 'utf8')).toBe(content);
    expect(await readFile(database)).toEqual(gameSave);
  }
  await store.save('public', { resolution: '2560x1440', interfaceScale: 125 });
  const restored = new DisplaySettingsStore(directory);
  await restored.load();
  expect(restored.read('public')).toEqual({
    resolution: '2560x1440',
    interfaceScale: 125,
  });
  expect(await readFile(database)).toEqual(gameSave);
});

it('returns a save error without changing current preferences or zoom and can recover on the next update', async () => {
  const directory = await temporaryDirectory();
  const store = new DisplaySettingsStore(directory);
  await mkdir(store.path);
  const controller = new DisplayController(store, origin, geometry);
  const window = new TestWindow();
  controller.register(window, 'host');
  const before = controller.read(window.request());
  const writes = window.webContents.zoomWrites;
  const preferences = { resolution: '1920x1080', interfaceScale: 150 } as const;
  await expect(
    controller.update(window.request(), preferences),
  ).rejects.toThrow('显示设置保存失败');
  expect(window.webContents.zoomWrites).toBe(writes);
  expect(controller.read(window.request())).toEqual(before);
  expect(store.read('host')).toEqual(before.preferences);
  expect(await readdir(directory)).toEqual(['display-settings.json']);
  await rmdir(store.path);
  await expect(
    controller.update(window.request(), preferences),
  ).resolves.toMatchObject({
    preferences,
    zoomFactor: 1.5,
  });
});

it('rechecks queued frame authorization and does not report a committed save as failed if the window closes', async () => {
  const store = new DisplaySettingsStore(await temporaryDirectory());
  const controller = new DisplayController(store, origin, geometry);
  const host = new TestWindow();
  const publicWindow = new TestWindow('public');
  controller.register(host, 'host');
  controller.register(publicWindow, 'public');
  const started = gate();
  const release = gate();
  const originalSave = store.save.bind(store);
  vi.spyOn(store, 'save').mockImplementationOnce(async (role, preferences) => {
    started.open();
    await release.promise;
    await originalSave(role, preferences);
  });
  const preferences = { resolution: '1920x1080', interfaceScale: 125 } as const;
  const hostContents = host.webContents;
  const pending = controller.update(host.request(), preferences);
  await started.promise;
  const queued = controller.update(publicWindow.request(), preferences);
  const queuedCheck = expect(queued).rejects.toThrow('桌面主窗口');
  publicWindow.webContents.mainFrame.url = `${origin}/player/game`;
  host.close();
  const writes = hostContents.zoomWrites;
  release.open();
  await expect(pending).resolves.toMatchObject({
    preferences,
    zoomFactor: 1.25,
  });
  await queuedCheck;
  expect(hostContents.zoomWrites).toBe(writes);
  expect(store.read('host')).toEqual(preferences);
  expect(store.read('public')).toEqual({
    resolution: 'auto',
    interfaceScale: 100,
  });
});

it('cleans closed and destroyed native windows using cached contents without accessing invalid getters', async () => {
  const store = new DisplaySettingsStore(await temporaryDirectory());
  const nativeGeometry = vi.fn((window: DisplayWindow) => {
    const viewport = window.getContentBounds();
    return {
      viewport: { width: viewport.width, height: viewport.height },
      screen: { width: 1920, height: 1080, scaleFactor: 1 },
    };
  });
  const controller = new DisplayController(store, origin, nativeGeometry);
  const host = new TestWindow();
  const publicWindow = new TestWindow('public');
  controller.register(host, 'host');
  controller.register(publicWindow, 'public');
  const contents = publicWindow.webContents;
  const queuedResize = publicWindow.listeners('resize')[0]!;
  const queuedLoad = contents.listeners('did-finish-load')[0]!;
  expect(() => publicWindow.close()).not.toThrow();
  expect(() => publicWindow.webContents).toThrow('Object has been destroyed');
  expect(() => publicWindow.getBounds()).toThrow('Object has been destroyed');
  expect(() => publicWindow.off('resize', () => undefined)).toThrow(
    'Object has been destroyed',
  );
  expect(() => contents.off('did-finish-load', () => undefined)).toThrow(
    'Object has been destroyed',
  );
  const geometryCalls = nativeGeometry.mock.calls.length;
  const writes = contents.zoomWrites;
  expect(() => queuedResize()).not.toThrow();
  expect(() => queuedLoad()).not.toThrow();
  expect(nativeGeometry.mock.calls.length).toBe(geometryCalls);
  expect(contents.zoomWrites).toBe(writes);
  expect(() => controller.refreshAll()).not.toThrow();
  expect(controller.read(host.request()).zoomFactor).toBe(1);

  // Native teardown can precede delivery of the window's closed event.
  const destroyedBeforeClosed = new TestWindow('public');
  controller.register(destroyedBeforeClosed, 'public');
  destroyedBeforeClosed.destroyed = true;
  destroyedBeforeClosed.contents.destroyed = true;
  expect(() => controller.refreshAll()).not.toThrow();
  const destroyedBeforeStop = new TestWindow('public');
  controller.register(destroyedBeforeStop, 'public');
  destroyedBeforeStop.destroyed = true;
  destroyedBeforeStop.contents.destroyed = true;
  expect(() => controller.stop()).not.toThrow();
  expect(() => controller.stop()).not.toThrow();
  expect(host.listenerCount('resize')).toBe(0);
  expect(host.webContents.listenerCount('did-finish-load')).toBe(0);
});
