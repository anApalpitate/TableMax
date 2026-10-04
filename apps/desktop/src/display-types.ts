export type DisplayResolution =
  'auto' | '1280x720' | '1920x1080' | '2560x1440' | '3840x2160';

export interface DisplayPreferences {
  resolution: DisplayResolution;
  interfaceScale: 100 | 125 | 150;
}

export interface DisplaySnapshot {
  preferences: DisplayPreferences;
  /** Unzoomed window content size in device-independent pixels. */
  viewport: { width: number; height: number };
  /** Current display bounds in device-independent pixels and OS pixel ratio. */
  screen: { width: number; height: number; scaleFactor: number };
  zoomFactor: number;
  limited: boolean;
}

export interface TablemaxDisplay {
  read(): Promise<DisplaySnapshot>;
  update(preferences: DisplayPreferences): Promise<DisplaySnapshot>;
  subscribe(listener: (snapshot: DisplaySnapshot) => void): () => void;
}

export const displayChannels = {
  read: 'tablemax:display:read',
  update: 'tablemax:display:update',
  changed: 'tablemax:display:changed',
} as const;

export interface WindowSnapshot {
  fullscreen: boolean;
}

export interface TablemaxWindow {
  read(): Promise<WindowSnapshot>;
  setFullscreen(fullscreen: boolean): Promise<WindowSnapshot>;
  subscribe(listener: (snapshot: WindowSnapshot) => void): () => void;
}

declare global {
  interface Window {
    tablemaxDisplay?: TablemaxDisplay;
    tablemaxWindow?: TablemaxWindow;
  }
}
