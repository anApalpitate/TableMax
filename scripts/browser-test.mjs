import { chromium } from 'playwright';

// Keep verification output quiet without suppressing media decode/play events.
export function launchTestBrowser({ soundEnabled = false, ...options } = {}) {
  const enabled = soundEnabled === true;
  return chromium.launch({
    ...options,
    // Playwright itself mutes headless Chromium; opt-in must remove that default.
    ignoreDefaultArgs:
      enabled && options.ignoreDefaultArgs !== true
        ? [...(options.ignoreDefaultArgs ?? []), '--mute-audio']
        : options.ignoreDefaultArgs,
    args: [...(options.args ?? []), ...(!enabled ? ['--mute-audio'] : [])],
  });
}
