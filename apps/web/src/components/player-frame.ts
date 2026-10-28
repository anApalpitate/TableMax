/** Only same-origin player navigation may update the outer browser address. */
export function playerFramePath(url: URL, origin: string): string | null {
  if (url.origin !== origin || !/^\/(?:player(?:\/game)?)?$/.test(url.pathname))
    return null;
  return url.pathname + url.search + url.hash;
}

export type PlayerDisplay = 'portrait' | 'wide';

/** A narrow window or a touch screen alone does not identify a phone. */
export function isPhonePlayer(device: {
  userAgent: string;
  userAgentData?: { mobile: boolean };
}): boolean {
  if (/iPad|Tablet/i.test(device.userAgent)) return false;
  return (
    /iPhone|iPod|Android.*Mobile/i.test(device.userAgent) ||
    device.userAgentData?.mobile === true
  );
}

/** Screen orientation is independent of the visual viewport reduced by a keyboard. */
export function phoneIsLandscape(
  type: string | undefined,
  width: number,
  height: number,
): boolean {
  if (type?.startsWith('portrait')) return false;
  if (type?.startsWith('landscape')) return true;
  return width > height;
}
export const playerDisplayKey = 'tablemax-player-display-mode';

export type WorkspacePreference = PlayerDisplay;
// The button-based workspace starts in portrait instead of inheriting v1 auto/wide.
export const workspaceDisplayKey = 'tablemax-workspace-display-mode-v2';
export function workspaceSpace(width: number, height: number) {
  return { width: Math.max(0, width - 72), height: Math.max(0, height - 16) };
}
export function workspaceLayout(
  width: number,
  height: number,
  preference: WorkspacePreference,
): PlayerDisplay {
  const fits = width >= 640 && height >= 320;
  return preference === 'wide' && fits ? 'wide' : 'portrait';
}

export function readWorkspaceDisplay(
  storage: Pick<Storage, 'getItem'> | null,
): PlayerDisplay {
  try {
    return storage?.getItem(workspaceDisplayKey) === 'wide'
      ? 'wide'
      : 'portrait';
  } catch {
    return 'portrait';
  }
}

export function saveWorkspaceDisplay(
  storage: Pick<Storage, 'setItem'> | null,
  mode: PlayerDisplay,
) {
  try {
    storage?.setItem(workspaceDisplayKey, mode);
  } catch {
    // The current button choice still works when storage is unavailable.
  }
}

/** Presentation only; never infer a room role from hardware or viewport size. */
export function isDesktopPlayer(device: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  userAgentData?: { mobile: boolean; platform: string };
}): boolean {
  if (
    device.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(device.userAgent)
  )
    return false;
  const platform = device.userAgentData?.platform || device.platform;
  // iPad Safari can advertise MacIntel and a desktop user agent.
  if (/Mac/i.test(platform + device.userAgent) && device.maxTouchPoints > 1)
    return false;
  return /Windows|Win32|Win64|Mac|Linux|CrOS|Chrome OS/i.test(
    platform + device.userAgent,
  );
}

export function readPlayerDisplay(
  storage: Pick<Storage, 'getItem'> | null,
): PlayerDisplay {
  try {
    return storage?.getItem(playerDisplayKey) === 'wide' ? 'wide' : 'portrait';
  } catch {
    return 'portrait';
  }
}

export function savePlayerDisplay(
  storage: Pick<Storage, 'setItem'> | null,
  mode: PlayerDisplay,
) {
  try {
    storage?.setItem(playerDisplayKey, mode);
  } catch {
    // Private/blocked storage must not disable this session's layout control.
  }
}
