/** Only same-origin player navigation may update the outer browser address. */
export function playerFramePath(url: URL, origin: string): string | null {
  if (url.origin !== origin || !/^\/(?:player(?:\/game)?)?$/.test(url.pathname))
    return null;
  return url.pathname + url.search + url.hash;
}

export type PlayerDisplay = 'portrait' | 'wide';
export const playerDisplayKey = 'tablemax-player-display-mode';

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
