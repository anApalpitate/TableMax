import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
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
const temporaryRoot = resolve(
  process.env.TABLEMAX_DISPLAY_TEST_TMP ?? join(tmpdir(), 'tablemax-display'),
);
const temporaryDirectories: string[] = [];
async function temporaryDirectory() {
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(join(temporaryRoot, 'case-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    if (!resolve(directory).startsWith(temporaryRoot + sep + 'case-'))
      throw new Error('Refusing to remove a non-test directory');
    await rm(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

it('executes current native geometry, document generations and host-only persistence', async () => {
  const directory = await temporaryDirectory();
  const harness = join(directory, 'DisplayHarness.cs');
  const executable = join(directory, 'DisplayHarness.exe');
  await writeFile(
    harness,
    `using System;
using System.Collections.Generic;
using System.IO;
using TableMax.Desktop;
internal static class DisplayHarness {
  static readonly List<string> checks = new List<string>();
  static void Check(bool ok, string name) { if (!ok) throw new Exception(name); checks.Add(name); }
  static Dictionary<string, object> Snapshot(double width, double height, int ui, double dpi, DisplayLayoutState state, string resolution = "auto") {
    return Json.Object(new System.Web.Script.Serialization.JavaScriptSerializer().DeserializeObject(Json.Encode(new DisplayGeometry { Width = width, Height = height, ScreenWidth = width, ScreenHeight = height, ScaleFactor = dpi }.Snapshot(new DisplayPreferences { Resolution = resolution, InterfaceScale = ui }, state))));
  }
  static object Selection(string profile, int generation, string document) { return Json.Decode(Json.Encode(new { profile, generation, documentId = document })); }
  static void Reject(DisplayLayoutState state, object input, string name) { var before = state.Profile; var generation = state.Generation; bool rejected = false; try { state.Select(input); } catch (ArgumentException) { rejected = true; } catch (InvalidOperationException) { rejected = true; } Check(rejected && before == state.Profile && generation == state.Generation, name); }
  static int Main(string[] args) {
    try {
      var state = new DisplayLayoutState();
      var firstDocument = state.DocumentId;
      Check(state.Profile == "legacy" && state.Generation == 0, "legacy by default");
      state.Select(Selection("fixed-host-1280-v1", 1, firstDocument));
      foreach (double dpi in new[] { 1.0, 1.25, 1.5, 2.0 }) foreach (int ui in new[] { 100, 125, 150 }) {
        var result = Snapshot(3840 / dpi, 2160 / dpi, ui, dpi, state);
        Check(Math.Abs(Json.Number(result, "zoomFactor") - 2 / dpi * ui / 100) < 1e-9 && !Json.Bool(result, "undersized"), "4K DIP/DPI/UI " + dpi + "/" + ui);
      }
      foreach (int ui in new[] { 100, 125, 150 }) Check(Math.Abs(Json.Number(Snapshot(1920, 1080, ui, 1, state), "zoomFactor") - ui / 100.0) < 1e-9, "1080p retains UI " + ui);
      var fixedLimit = Snapshot(1280, 800, 150, 1, state, "3840x2160");
      Check(Json.Number(fixedLimit, "zoomFactor") == 1 && Json.Bool(fixedLimit, "limited"), "fixed width limits preset without changing requested base");
      Check(!Json.Bool(Snapshot(1280, 720, 100, 1, state), "undersized"), "exact fixed boundary");
      Check(Json.Bool(Snapshot(1279, 720, 100, 1, state), "undersized"), "one CSS pixel short in width");
      Check(Json.Bool(Snapshot(1280, 719, 100, 1, state), "undersized"), "one CSS pixel short in height");
      Check(Json.Number(Snapshot(1000, 500, 150, 1, state), "zoomFactor") == 1, "never shrink below one");
      Check(Json.Number(Snapshot(5760, 3240, 150, 1, state), "zoomFactor") == 3, "maximum three");
      Reject(state, Selection("legacy", 1, firstDocument), "duplicate generation rejected");
      Reject(state, Selection("legacy", 0, firstDocument), "zero generation rejected");
      Reject(state, Selection("untrusted-size", 2, firstDocument), "unknown profile rejected");
      Reject(state, Selection("legacy", 2, "wrong"), "wrong document rejected");
      Reject(state, Json.Decode(Json.Encode(new { profile = "legacy", generation = 2, documentId = firstDocument, width = 1 })), "extra geometry rejected");
      state.Select(Selection("legacy", 3, firstDocument));
      var legacy = Snapshot(1280, 800, 150, 1, state, "3840x2160");
      Check(Math.Abs(Json.Number(legacy, "zoomFactor") - 800.0 / 720) < 1e-9, "legacy geometry unchanged");
      Reject(state, Selection("fixed-host-1280-v1", 2, firstDocument), "late lower generation rejected");
      state.Reset();
      Check(state.Profile == "legacy" && state.Generation == 0 && state.DocumentId != firstDocument, "navigation resets runtime state and token");
      Reject(state, Selection("fixed-host-1280-v1", 999, firstDocument), "old document cannot revive profile");
      state.Select(Selection("fixed-host-1280-v1", 1, state.DocumentId));
      var store = new DisplaySettingsStore(args[0]);
      var preferences = new DisplayPreferences { Resolution = "2560x1440", InterfaceScale = 125 };
      store.Save(preferences);
      var path = Path.Combine(args[0], "display-settings.json");
      var saved = File.ReadAllText(path);
      var savedObject = Json.Decode(saved);
      Check(savedObject.Count == 2 && Json.Number(savedObject, "version") == 2 && !saved.Contains("layout"), "profile excluded from host-only v2 preferences");
      state.Reset();
      Snapshot(3840, 2160, 100, 1, state);
      Check(File.ReadAllText(path) == saved && new DisplaySettingsStore(args[0]).Read().InterfaceScale == 125, "runtime changes never rewrite preferences");
      Console.WriteLine(Json.Encode(new { passed = true, checks })); return 0;
    } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
  }
}`,
  );
  const compiler = join(
    process.env.ProgramFiles ?? 'C:/Program Files',
    'dotnet/sdk/9.0.102/Roslyn/bincore/csc.dll',
  );
  const references = resolve(
    '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
  );
  const execute = promisify(execFile);
  const compilation = await execute(
    'dotnet',
    [
      compiler,
      '/nologo',
      '/target:exe',
      '/platform:x64',
      '/langversion:12',
      '/warnaserror+',
      '/nostdlib+',
      `/out:${executable}`,
      ...['mscorlib', 'System', 'System.Core', 'System.Web.Extensions'].map(
        (name) => `/reference:${join(references, name + '.dll')}`,
      ),
      resolve('apps/desktop/native/DisplaySettings.cs'),
      resolve('apps/desktop/native/Json.cs'),
      harness,
    ],
    { windowsHide: true, timeout: 30000 },
  );
  await writeFile(join(directory, 'compile.log'), compilation.stdout);
  const execution = await execute(executable, [directory], {
    windowsHide: true,
    timeout: 10000,
  });
  const report = JSON.parse(execution.stdout.trim()) as {
    passed: boolean;
    checks: string[];
  };
  expect(report.passed).toBe(true);
  expect(report.checks.length).toBeGreaterThanOrEqual(30);
  if (process.env.TABLEMAX_DISPLAY_TEST_EVIDENCE) {
    const evidence = resolve(process.env.TABLEMAX_DISPLAY_TEST_EVIDENCE);
    await mkdir(evidence, { recursive: true });
    const sources = await Promise.all(
      [
        'apps/desktop/native/DisplaySettings.cs',
        'apps/desktop/native/Json.cs',
        'apps/desktop/src/display-controller.test.ts',
      ].map(async (path) => {
        return [
          path,
          createHash('sha256')
            .update(await readFile(resolve(path)))
            .digest('hex'),
        ];
      }),
    );
    await writeFile(
      join(
        evidence,
        `native-unit-${process.env.TABLEMAX_TEST_HISTORY_RUN_ID ?? Date.now()}.json`,
      ),
      JSON.stringify({
        ...report,
        method: 'compiled-net48-native-display-geometry-state',
        sourceHashes: Object.fromEntries(sources),
        harnessSha256: createHash('sha256')
          .update(await readFile(harness))
          .digest('hex'),
        environment: {
          compiler,
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
        },
      }),
    );
  }
}, 45000);

type BridgeRequest = {
  id: number;
  method: string;
  params: unknown[];
};
async function nativeBridge(top = true) {
  const requests: BridgeRequest[] = [];
  let receive: (event: { data: unknown }) => void = () => {};
  const surface: Record<string, unknown> = {
    chrome: {
      webview: {
        postMessage: (message: BridgeRequest) => requests.push(message),
        addEventListener: (_event: string, handler: typeof receive) =>
          (receive = handler),
      },
    },
    addEventListener() {},
  };
  surface.top = top ? surface : {};
  runInNewContext(
    (await readFile(resolve('apps/desktop/native/bridge.js'), 'utf8'))
      .replace('__WINDOW_ID__', '1')
      .replace('__MANAGED__', 'true')
      .replace('__TESTING__', 'false')
      .replace('__UPDATE_ALLOWED__', 'false'),
    { window: surface, setTimeout, clearTimeout },
  );
  return {
    bridge: surface.tablemaxDisplay as NonNullable<Window['tablemaxDisplay']>,
    requests,
    reply(request: BridgeRequest, result: unknown) {
      receive({ data: { id: request.id, result } });
    },
  };
}

it('binds the actual native layout bridge to one document and rejects stale queued choices', async () => {
  const { bridge, requests, reply } = await nativeBridge();
  const first = bridge.setLayoutProfile!('fixed-host-1280-v1', 1).catch(
    (error: Error) => error.message,
  );
  const second = bridge.setLayoutProfile!('legacy', 2);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe('display.read');
  reply(requests[0]!, { layoutDocumentId: 'current-document' });
  await expect(first).resolves.toContain('过期');
  await vi.waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1]).toMatchObject({
    method: 'display.setLayoutProfile',
    params: [
      { profile: 'legacy', generation: 2, documentId: 'current-document' },
    ],
  });
  reply(requests[1]!, { layoutProfile: 'legacy' });
  await expect(second).resolves.toMatchObject({ layoutProfile: 'legacy' });
  const third = bridge.setLayoutProfile!('fixed-host-1280-v1', 3);
  await vi.waitFor(() => expect(requests).toHaveLength(3));
  expect(requests[2]?.params).toEqual([
    {
      profile: 'fixed-host-1280-v1',
      generation: 3,
      documentId: 'current-document',
    },
  ]);
  reply(requests[2]!, { layoutProfile: 'fixed-host-1280-v1' });
  await third;
  await expect(bridge.setLayoutProfile!('legacy', 2)).rejects.toThrow('过期');
  await expect(bridge.setLayoutProfile!('legacy', NaN)).rejects.toThrow('无效');
  expect(requests).toHaveLength(3);
  expect((await nativeBridge(false)).bridge).toBeUndefined();
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

it('reads v1 host without rewriting and writes host-only v2 on explicit save', async () => {
  const directory = await temporaryDirectory();
  const store = new DisplaySettingsStore(directory);
  const oldHostPreferences = {
    resolution: '2560x1440',
    interfaceScale: 125,
  } as const;
  const original = JSON.stringify({
    version: 1,
    host: oldHostPreferences,
    public: { ignored: true },
  });
  await writeFile(store.path, original);
  await store.load();
  expect(store.read('host')).toEqual(oldHostPreferences);
  expect(await readFile(store.path, 'utf8')).toBe(original);
  const controller = new DisplayController(store, origin, geometry);
  const host = new TestWindow();
  controller.register(host, 'host');
  expect(() =>
    controller.register(new TestWindow('public'), 'public' as 'host'),
  ).toThrow();
  const hostPreferences = {
    resolution: '1920x1080',
    interfaceScale: 125,
  } as const;
  await controller.update(host.request(), hostPreferences);
  expect(host.webContents.zoomFactor).toBe(1.25);
  controller.refreshAll();
  host.webContents.emit('did-finish-load');
  expect(host.webContents.zoomFactor).toBe(1.25);
  expect(host.webContents.modes).toEqual(['isolated']);
  const restored = new DisplaySettingsStore(directory);
  await restored.load();
  expect(restored.read('host')).toEqual(hostPreferences);
  expect(() => restored.read('public' as 'host')).toThrow();
  expect(JSON.parse(await readFile(store.path, 'utf8'))).toEqual({
    version: 2,
    host: hostPreferences,
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
      host: { resolution: 'auto', interfaceScale: 200 },
      public: { resolution: 'auto', interfaceScale: 100 },
    }),
  ]) {
    await writeFile(store.path, content);
    await store.load();
    expect(store.read('host')).toEqual({
      resolution: 'auto',
      interfaceScale: 100,
    });
    expect(await readFile(store.path, 'utf8')).toBe(content);
    expect(await readFile(database)).toEqual(gameSave);
  }
  await store.save('host', { resolution: '2560x1440', interfaceScale: 125 });
  const restored = new DisplaySettingsStore(directory);
  await restored.load();
  expect(restored.read('host')).toEqual({
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
  const queuedHost = new TestWindow();
  controller.register(host, 'host');
  controller.register(queuedHost, 'host');
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
  const queued = controller.update(queuedHost.request(), preferences);
  const queuedCheck = expect(queued).rejects.toThrow('桌面主窗口');
  queuedHost.webContents.mainFrame.url = `${origin}/public/game`;
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
  const closingHost = new TestWindow();
  controller.register(host, 'host');
  controller.register(closingHost, 'host');
  const contents = closingHost.webContents;
  const queuedResize = closingHost.listeners('resize')[0]!;
  const queuedLoad = contents.listeners('did-finish-load')[0]!;
  expect(() => closingHost.close()).not.toThrow();
  expect(() => closingHost.webContents).toThrow('Object has been destroyed');
  expect(() => closingHost.getBounds()).toThrow('Object has been destroyed');
  expect(() => closingHost.off('resize', () => undefined)).toThrow(
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
  const destroyedBeforeClosed = new TestWindow();
  controller.register(destroyedBeforeClosed, 'host');
  destroyedBeforeClosed.destroyed = true;
  destroyedBeforeClosed.contents.destroyed = true;
  expect(() => controller.refreshAll()).not.toThrow();
  const destroyedBeforeStop = new TestWindow();
  controller.register(destroyedBeforeStop, 'host');
  destroyedBeforeStop.destroyed = true;
  destroyedBeforeStop.contents.destroyed = true;
  expect(() => controller.stop()).not.toThrow();
  expect(() => controller.stop()).not.toThrow();
  expect(host.listenerCount('resize')).toBe(0);
  expect(host.webContents.listenerCount('did-finish-load')).toBe(0);
});
