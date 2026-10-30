import { join, relative, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

/** Compare the same authoritative result, with/without transient presentation. */
export async function auditOverlayLayout(
  page,
  surface,
  work,
  device,
  report,
  kinds = ['ability', 'event', 'coin', 'research', 'result'],
) {
  const checks = [];
  for (const reduced of [false, true]) {
    await page.emulateMedia({
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    for (const kind of kinds) {
      const settings = {
        role: 'player',
        scenario:
          kind === 'research' ? 'draw' : kind === 'result' ? 'result' : 'place',
        creature: kind === 'coin' ? 'team-rocket' : 'mewtwo',
        ...(kind === 'event' ? { event: 'rain' } : {}),
        ...(kind === 'research' ? { researchPublication: true } : {}),
        ...(kind === 'result' ? { terminal: true, ordinary: '6' } : {}),
        animate: false,
      };
      await surface.evaluate((s) => window.redesignShow(s), settings);
      await surface.waitForFunction(() =>
        [...document.images].every((i) => i.complete),
      );
      const id = `${device}-${reduced ? 'reduced' : 'normal'}-${kind}`;
      const capture = async (suffix) => {
        const path = join(work, `${id}-${suffix}.png`);
        await captureBrowserScreenshot(page, { path });
        const bytes = await readFile(path);
        report.screenshots.push({
          id: `${id}-${suffix}`,
          path: relative(resolve('.'), path).replaceAll('\\', '/'),
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      };
      await capture('baseline');
      const observation = surface.evaluate(
        async ({ settings, duration }) => {
          const snapshot = () => {
            const main = document.querySelector('main.expansion-screen');
            const nodes = {};
            for (const selector of [
              '.ex-toolbar',
              '.ex-round-banner',
              '.ex-actions',
              '.player-field',
              '.pokemon-board',
              '.player-decision-workbench',
              '.ex-submit',
              '.ex-victory',
              '.ex-score',
            ]) {
              const el = main.querySelector(selector);
              if (!el) continue;
              const r = el.getBoundingClientRect(),
                s = getComputedStyle(el);
              nodes[selector] = {
                x: r.x,
                y: r.y,
                w: r.width,
                h: r.height,
                display: s.display,
                opacity: s.opacity,
                filter: s.filter,
                transform: s.transform,
              };
            }
            return {
              nodes,
              scroll: [
                scrollX,
                scrollY,
                document.documentElement.scrollWidth,
                document.documentElement.scrollHeight,
              ],
            };
          };
          const baseline = snapshot(),
            changes = [],
            overlays = new Set(),
            blocked = new Set();
          window.redesignShow({ ...settings, animate: true });
          const start = performance.now();
          let samples = 0;
          while (performance.now() - start < duration) {
            await new Promise((done) => setTimeout(done, 50));
            samples++;
            const now = snapshot(),
              differences = [];
            for (const [selector, a] of Object.entries(baseline.nodes)) {
              const b = now.nodes[selector];
              if (
                !b ||
                Object.keys(a).some((k) =>
                  typeof a[k] === 'number'
                    ? Math.abs(a[k] - b[k]) > 1
                    : a[k] !== b[k],
                )
              )
                differences.push({ selector, before: a, during: b });
            }
            if (JSON.stringify(baseline.scroll) !== JSON.stringify(now.scroll))
              differences.push({
                selector: 'scroll',
                before: baseline.scroll,
                during: now.scroll,
              });
            if (differences.length && changes.length < 5)
              changes.push({
                ms: Math.round(performance.now() - start),
                differences,
              });
            for (const el of document.querySelectorAll(
              '.ex-cinematic,.ex-static-hero,.ex-event-entrance,.ex-research-reveal,.ex-original-effects',
            )) {
              const s = getComputedStyle(el);
              if (s.display === 'none') continue;
              overlays.add(el.classList[0]);
              if (s.pointerEvents !== 'none') blocked.add(el.className);
            }
          }
          return {
            baseline,
            changes,
            overlays: [...overlays],
            blocked: [...blocked],
            samples,
          };
        },
        {
          settings,
          duration:
            kind === 'result' ? (reduced ? 2600 : 4300) : reduced ? 1800 : 3200,
        },
      );
      await page.waitForTimeout(kind === 'event' ? 650 : 250);
      await capture('during');
      const result = await observation;
      await surface.evaluate(
        (s) => window.redesignShow({ ...s, animate: false }),
        settings,
      );
      result.restored = await surface
        .locator(
          '.ex-cinematic,.ex-static-hero,.ex-event-entrance,.ex-research-reveal,.ex-original-effects',
        )
        .count();
      checks.push({ id, ...result });
    }
  }
  return checks;
}
