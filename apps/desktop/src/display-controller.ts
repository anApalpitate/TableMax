import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  displayChannels,
  type DisplayPreferences,
  type DisplaySnapshot,
} from './display-types';

type DisplayRole = 'host' | 'public';
interface DisplaySettings {
  version: 1;
  host: DisplayPreferences;
  public: DisplayPreferences;
}

export interface DisplayGeometry {
  viewport: DisplaySnapshot['viewport'];
  screen: DisplaySnapshot['screen'];
}

interface DisplayFrame {
  readonly url: string;
}

export interface DisplayWebContents {
  readonly mainFrame: DisplayFrame;
  isDestroyed(): boolean;
  getURL(): string;
  setZoomMode(mode: 'isolated'): void;
  setZoomFactor(factor: number): void;
  send(channel: string, snapshot: DisplaySnapshot): void;
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
}

export interface DisplayWindow {
  readonly webContents: DisplayWebContents;
  getBounds(): { x: number; y: number; width: number; height: number };
  getContentBounds(): { x: number; y: number; width: number; height: number };
  isDestroyed(): boolean;
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
}

export interface DisplayRequest {
  sender: DisplayWebContents;
  senderFrame: DisplayFrame | null;
}

const defaultPreferences = (): DisplayPreferences => ({
  resolution: 'auto',
  interfaceScale: 100,
});

export function parseDisplayPreferences(input: unknown): DisplayPreferences {
  if (
    typeof input !== 'object' ||
    input === null ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null) ||
    Reflect.ownKeys(input).length !== 2 ||
    !Object.hasOwn(input, 'resolution') ||
    !Object.hasOwn(input, 'interfaceScale')
  )
    throw new Error('显示设置参数无效。');
  const values = input as Record<string, unknown>;
  if (
    typeof values.resolution !== 'string' ||
    !['auto', '1280x720', '1920x1080', '2560x1440', '3840x2160'].includes(
      values.resolution,
    ) ||
    typeof values.interfaceScale !== 'number' ||
    ![100, 125, 150].includes(values.interfaceScale as number)
  )
    throw new Error('显示设置参数无效。');
  return {
    resolution: values.resolution as DisplayPreferences['resolution'],
    interfaceScale:
      values.interfaceScale as DisplayPreferences['interfaceScale'],
  };
}

export function calculateDisplaySnapshot(
  preferences: DisplayPreferences,
  geometry: DisplayGeometry,
): DisplaySnapshot {
  const { viewport, screen } = geometry;
  const target =
    preferences.resolution === 'auto'
      ? viewport
      : (() => {
          const [width, height] = preferences.resolution.split('x').map(Number);
          return {
            width: width! / screen.scaleFactor,
            height: height! / screen.scaleFactor,
          };
        })();
  const base = Math.max(1, Math.min(target.width / 1920, target.height / 1080));
  const requested = base * (preferences.interfaceScale / 100);
  const visibleLimit = Math.max(
    1,
    Math.min(viewport.width / 1100, viewport.height / 720),
  );
  const zoomFactor = Math.min(requested, visibleLimit, 3);
  return {
    preferences: { ...preferences },
    viewport: { ...viewport },
    screen: { ...screen },
    zoomFactor,
    limited: zoomFactor + 1e-9 < requested,
  };
}

/** Separate desktop preferences; never opens or changes the game database. */
export class DisplaySettingsStore {
  private settings: DisplaySettings = {
    version: 1,
    host: defaultPreferences(),
    public: defaultPreferences(),
  };
  readonly path: string;

  constructor(private readonly dataDir: string) {
    this.path = join(dataDir, 'display-settings.json');
  }

  async load(): Promise<void> {
    try {
      const input: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      if (
        typeof input !== 'object' ||
        input === null ||
        Reflect.ownKeys(input).length !== 3 ||
        !('version' in input) ||
        input.version !== 1 ||
        !('host' in input) ||
        !('public' in input)
      )
        throw new Error('Invalid display settings file');
      this.settings = {
        version: 1,
        host: parseDisplayPreferences(input.host),
        public: parseDisplayPreferences(input.public),
      };
    } catch {
      // Missing, damaged or unreadable settings must not prevent playing.
      this.settings = {
        version: 1,
        host: defaultPreferences(),
        public: defaultPreferences(),
      };
    }
  }

  read(role: DisplayRole): DisplayPreferences {
    return { ...this.settings[role] };
  }

  async save(
    role: DisplayRole,
    preferences: DisplayPreferences,
  ): Promise<void> {
    const settings = {
      ...this.settings,
      [role]: parseDisplayPreferences(preferences),
    };
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      await mkdir(this.dataDir, { recursive: true });
      await writeFile(temporary, JSON.stringify(settings, null, 2) + '\n', {
        flag: 'wx',
      });
      await rename(temporary, this.path);
      this.settings = settings;
    } catch (cause) {
      await unlink(temporary).catch(() => undefined);
      throw new Error(
        '显示设置保存失败，请检查数据目录的写入权限或磁盘空间。',
        {
          cause,
        },
      );
    }
  }
}

interface ManagedDisplay {
  window: DisplayWindow;
  contents: DisplayWebContents;
  role: DisplayRole;
  preferences: DisplayPreferences;
  snapshot: DisplaySnapshot;
  refresh: () => void;
  closed: () => void;
}

/** Uses unzoomed native geometry, not a renderer's shrinking innerWidth. */
export class DisplayController {
  private readonly managed = new Map<DisplayWebContents, ManagedDisplay>();
  private updates: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: DisplaySettingsStore,
    private readonly origin: string,
    private readonly geometry: (window: DisplayWindow) => DisplayGeometry,
  ) {}

  register(window: DisplayWindow, role: DisplayRole): void {
    if (window.isDestroyed()) throw new Error('Display window is destroyed');
    const contents = window.webContents;
    if (contents.isDestroyed())
      throw new Error('Display contents are destroyed');
    const preferences = this.store.read(role);
    const entry: ManagedDisplay = {
      window,
      contents,
      role,
      preferences,
      snapshot: calculateDisplaySnapshot(preferences, this.geometry(window)),
      refresh: () => this.apply(entry),
      closed: () => this.unregister(contents),
    };
    this.managed.set(contents, entry);
    contents.setZoomMode('isolated');
    for (const event of [
      'resize',
      'move',
      'enter-full-screen',
      'leave-full-screen',
    ])
      window.on(event, entry.refresh);
    window.on('closed', entry.closed);
    contents.on('did-finish-load', entry.refresh);
    contents.on('zoom-changed', entry.refresh);
    this.apply(entry);
  }

  read(request: DisplayRequest, ...arguments_: unknown[]): DisplaySnapshot {
    if (arguments_.length !== 0) throw new Error('显示设置参数无效。');
    const entry = this.authorize(request);
    return this.apply(entry);
  }

  update(
    request: DisplayRequest,
    input: unknown,
    ...arguments_: unknown[]
  ): Promise<DisplaySnapshot> {
    if (arguments_.length !== 0) throw new Error('显示设置参数无效。');
    this.authorize(request);
    const preferences = parseDisplayPreferences(input);
    const update = this.updates.then(async () => {
      const entry = this.authorize(request);
      const snapshot = calculateDisplaySnapshot(
        preferences,
        this.geometry(entry.window),
      );
      await this.store.save(entry.role, preferences);
      entry.preferences = preferences;
      // A completed save stays successful even if its requesting frame has closed.
      if (
        this.managed.get(request.sender) === entry &&
        !entry.window.isDestroyed() &&
        !request.sender.isDestroyed() &&
        this.allowedURL(request.sender.getURL(), entry.role)
      )
        return this.apply(entry);
      return snapshot;
    });
    this.updates = update.then(
      () => undefined,
      () => undefined,
    );
    return update;
  }

  refreshAll(): void {
    for (const entry of this.managed.values()) this.apply(entry);
  }

  stop(): void {
    for (const entry of [...this.managed.values()])
      this.unregister(entry.contents);
  }

  private allowedURL(url: string, role: DisplayRole): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.origin === this.origin &&
        [`/${role}`, `/${role}/game`].includes(parsed.pathname)
      );
    } catch {
      return false;
    }
  }

  private authorize(request: DisplayRequest): ManagedDisplay {
    const entry = this.managed.get(request.sender);
    if (
      !entry ||
      entry.window.isDestroyed() ||
      request.sender.isDestroyed() ||
      request.senderFrame !== request.sender.mainFrame ||
      !request.senderFrame ||
      !this.allowedURL(request.senderFrame.url, entry.role) ||
      !this.allowedURL(request.sender.getURL(), entry.role)
    )
      throw new Error('仅 TableMax 桌面主窗口可以设置显示。');
    return entry;
  }

  private apply(entry: ManagedDisplay): DisplaySnapshot {
    const { window, contents } = entry;
    if (this.managed.get(contents) !== entry) return entry.snapshot;
    // Electron's webContents/getBounds getters throw after native destruction.
    if (window.isDestroyed() || contents.isDestroyed()) {
      this.unregister(contents);
      return entry.snapshot;
    }
    const snapshot = calculateDisplaySnapshot(
      entry.preferences,
      this.geometry(window),
    );
    entry.snapshot = snapshot;
    contents.setZoomFactor(snapshot.zoomFactor);
    if (this.allowedURL(contents.getURL(), entry.role))
      contents.send(displayChannels.changed, snapshot);
    return snapshot;
  }

  private unregister(contents: DisplayWebContents): void {
    const entry = this.managed.get(contents);
    if (!entry) return;
    this.managed.delete(contents);
    // Destroyed native surfaces no longer dispatch events and need no API calls.
    if (!entry.window.isDestroyed()) {
      for (const event of [
        'resize',
        'move',
        'enter-full-screen',
        'leave-full-screen',
      ])
        entry.window.off(event, entry.refresh);
      entry.window.off('closed', entry.closed);
    }
    if (!contents.isDestroyed()) {
      contents.off('did-finish-load', entry.refresh);
      contents.off('zoom-changed', entry.refresh);
    }
  }
}
