import {
  captureMatrixScreenshot,
  browserScreenshotMetrics,
} from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';
import { build } from 'esbuild';
import { mkdir, mkdtemp, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { verificationOutput } from '../support/verification-output.mjs';
const require = createRequire(import.meta.url);
const verifyDeal = process.argv.includes('--verify-deal');
const reviewStages = process.argv.includes('--review-stages');
const compactCheck = process.argv.includes('--compact-check');
const evidenceName = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.ok(!evidenceName || /^[a-z0-9-]{1,40}$/.test(evidenceName));
const only =
  process.argv
    .find((arg) => arg.startsWith('--only='))
    ?.slice(7)
    .split(',') ?? (verifyDeal ? ['V03'] : undefined);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/game-ui-')),
  output = verificationOutput(
    'ui',
    ...(only
      ? [evidenceName ?? (verifyDeal ? 'round-deal' : 'additional')]
      : []),
  );
await mkdir(output, { recursive: true });
const audioFiles = (await readdir('build/desktop/web/assets')).filter((file) =>
  /\.(wav|mp3)$/.test(file),
);
const audioManifest = JSON.parse(
  await readFile('assets/games/pokemon-encounters/audio/manifest.json', 'utf8'),
);
assert.equal(audioFiles.length, audioManifest.length);
await build({
  entryPoints: ['tools/test/fixtures/prepare-pokemon.ts'],
  outfile: join(work, 'prepare.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { prepare } = require(join(work, 'prepare.cjs'));
const scenes = [
  ...[2, 3, 4, 5, 6].map((count) => ({
    id: `L${count}`,
    fixture: 'layout',
    count,
    actions: Array.from({ length: count }, (_, index) => [
      index,
      { type: 'initial-flip', slot: 0 },
    ]),
  })),
  {
    id: 'L6-mew',
    count: 6,
    actions: [
      ...Array.from({ length: 6 }, (_, index) => [
        index,
        { type: 'initial-flip', slot: 0 },
      ]),
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'mew-target', target: 5, slot: 5 }],
      [0, { type: 'replace', slot: 5 }],
    ],
  },
  {
    id: 'V00',
    actions: [
      [0, { type: 'initial-flip', slot: 0 }],
      [1, { type: 'initial-flip', slot: 0 }],
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: compactCheck ? 5 : 1 }],
    ],
  },
  {
    id: 'V03',
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'mew-target', target: 1, slot: 5 }],
      [0, { type: 'replace', slot: compactCheck ? 5 : 1 }],
    ],
  },
  {
    id: 'V04',
    seed: 17,
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 5 }],
    ],
  },
  {
    id: 'V05',
    seed: 0x80000000,
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 5 }],
    ],
  },
  {
    id: 'V06',
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 5 }],
      [1, { type: 'replace', slot: 1 }],
      [2, { type: 'replace', slot: 2 }],
    ],
  },
  {
    id: 'V07',
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 1 }],
      [0, { type: 'swap', a: 1, b: 2 }],
    ],
  },
  {
    id: 'V08',
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 1 }],
      [0, { type: 'peek', slot: 2 }],
      [0, { type: 'close-peek' }],
    ],
  },
  {
    id: 'V07-skip',
    fixture: 'V07',
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 1 }],
      [0, { type: 'decline-ability' }],
    ],
  },
  {
    id: 'V08-skip',
    fixture: 'V08',
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 1 }],
      [0, { type: 'decline-ability' }],
    ],
  },
  {
    id: 'V00-discard',
    fixture: 'V00',
    actions: [
      [0, { type: 'initial-flip', slot: 0 }],
      [1, { type: 'initial-flip', slot: 0 }],
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'discard-held' }],
      [1, { type: 'draw', source: 'discard' }],
      [1, { type: 'replace', slot: 1 }],
    ],
  },
];
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual production rules/UI/service loaded from specification saved fixtures, desktop 1920 and Chromium touch phone viewport simulation; audio decode and play-call observations, no physical phone/TV or listening claim',
  compactCheck,
  phoneViewports: compactCheck
    ? [[360, 640]]
    : [
        [360, 844],
        [390, 844],
      ],
  cases: [],
  external: [],
  errors: [],
};
const selectedScenes = scenes.filter(
  (scene) => !only || only.includes(scene.id),
);
assert.ok(selectedScenes.length, 'At least one known scene must be selected');
for (const scene of selectedScenes) {
  const dataDir = join(work, scene.id);
  await mkdir(dataDir);
  const players = await prepare(
    scene.fixture ?? scene.id,
    dataDir,
    scene.seed,
    scene.count,
  );
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
  };
  delete env.NODE_PATH;
  delete env.TABLEMAX_WEB_DEV_URL;
  const desktop = await launchDesktop({
    executablePath: desktopExecutable,
    args: ['--foundation-test', '--tablemax-test-mode'],
    env,
    timeout: 30000,
  });
  let socket;
  try {
    const host = await desktop.firstWindow();
    await host.waitForURL('**/host');
    const origin = new URL(host.url()).origin;
    const token = await host.evaluate(() =>
      sessionStorage.getItem('tablemax-host'),
    );
    assert.ok(token);
    const fetchView = async (credential) =>
      (
        await (
          await fetch(`${origin}/api/session/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credential ? { token: credential } : {}),
          })
        ).json()
      ).view;
    const observe = async (page) => {
      page.setDefaultTimeout(10000);
      page.on('pageerror', (error) => evidence.errors.push(error.message));
      page.on('request', (r) => {
        if (new URL(r.url()).origin !== origin) evidence.external.push(r.url());
      });
      await page.addInitScript(() => {
        window.tablemaxAudit = { animations: [], sounds: [], motionStyles: [] };
        document.addEventListener('animationstart', (event) =>
          window.tablemaxAudit.animations.push(event.animationName),
        );
        new MutationObserver(() => {
          for (const element of document.querySelectorAll('.saved-motion')) {
            const style = getComputedStyle(element);
            if (style.animationName !== 'none')
              window.tablemaxAudit.motionStyles.push({
                name: style.animationName,
                duration: style.animationDuration,
              });
          }
        }).observe(document, {
          subtree: true,
          attributes: true,
          childList: true,
        });
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          window.tablemaxAudit.sounds.push(this.src);
          window.tablemaxAudit.lastAudio = this;
          return play.call(this);
        };
      });
    };
    const open = async (route, index = 0) => {
      const next = desktop.waitForEvent('window');
      await desktop.evaluate(
        ({ BrowserWindow }, config) => {
          const window = new BrowserWindow({
            frame: false,
            show: false,
            width: config.width,
            height: config.height,
            webPreferences: {
              sandbox: true,
              nodeIntegration: false,
              contextIsolation: true,
              partition: config.partition,
              backgroundThrottling: false,
              offscreen: true,
            },
          });
          window.setContentSize(config.width, config.height);
          void window.loadURL(config.url);
        },
        {
          width:
            route === 'public' ? 1920 : compactCheck ? 360 : index ? 390 : 360,
          height: route === 'public' ? 1080 : compactCheck ? 640 : 844,
          partition:
            route === 'public' ? 'public-scene' : `phone-scene-${index}`,
          url: `${origin}/${route}/game`,
        },
      );
      const page = await next;
      await observe(page);
      if (route === 'player') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setTouchEmulationEnabled', {
          enabled: true,
          maxTouchPoints: 5,
        });
        if (compactCheck)
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: 360,
            height: 640,
            deviceScaleFactor: 1,
            mobile: true,
          });
        await page.evaluate(
          (token) => localStorage.setItem('tablemax-player', token),
          players[index].token,
        );
      }
      await page.reload();
      await page.locator('.connection.online').waitFor();
      return page;
    };
    await observe(host);
    await host.goto(`${origin}/host/game`);
    await host.reload();
    await host.locator('.connection.online').waitFor();
    const publicPage = await open('public'),
      phones = [];
    await publicPage.emulateMedia({ reducedMotion: 'no-preference' });
    const publicWindow = await desktop.browserWindow(publicPage);

    for (let i = 0; i < players.length; i++)
      phones.push(await open('player', i));
    socket = io(origin, { auth: { token }, transports: ['websocket'] });
    await new Promise((r) => socket.once('room:view', r));
    const send = async (command) => {
      const view = await fetchView(token);
      const reply = await new Promise((r, reject) =>
        socket.timeout(5000).emit(
          'room:command',
          {
            actionId: crypto.randomUUID(),
            instanceId: view.instanceId,
            revision: view.revision,
            branch: view.branch,
            command,
          },
          (error, reply) => (error ? reject(error) : r(reply)),
        ),
      );
      assert.equal(reply.ok, true);
    };
    // Explicit production presentation exercises real animation/audio while
    // the remaining harnesses use test mode for fast Worker games.
    await send({ type: 'set-play-mode', mode: 'play' });
    await send({ type: 'resume' });
    await publicPage
      .getByRole('button', { name: '提示音已开启 · 静音', exact: true })
      .waitFor();
    const decodedAudio = await publicPage.evaluate(async (files) => {
      const context = new AudioContext();
      try {
        return await Promise.all(
          files.map(async (file) => {
            const response = await fetch(`/assets/${file}`);
            if (!response.ok) throw new Error(`Missing audio: ${file}`);
            const decoded = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            const samples = decoded.getChannelData(0);
            let peak = 0,
              energy = 0;
            for (const sample of samples) {
              peak = Math.max(peak, Math.abs(sample));
              energy += sample * sample;
            }
            return {
              file,
              seconds: decoded.duration,
              channels: decoded.numberOfChannels,
              decodedSampleRate: decoded.sampleRate,
              peak,
              rms: Math.sqrt(energy / samples.length),
            };
          }),
        );
      } finally {
        await context.close();
      }
    }, audioFiles);
    assert.ok(
      decodedAudio.every(
        (audio) =>
          audio.seconds > 0.1 &&
          audio.seconds < 4 &&
          audio.channels >= 1 &&
          audio.channels <= 2 &&
          audio.peak > 0.01 &&
          audio.rms > 0.001,
      ),
    );
    const item = {
      id: scene.id,
      phases: [],
      actions: 0,
      screenshots: [],
      soundCalls: 0,
      animations: 0,
      presentedActions: [],
      decodedAudio,
      narrowOverflow: false,
      compactLayouts: [],
      resultLayouts: [],
    };
    const capture = async (page, name, keepScroll = false) => {
      if (!keepScroll)
        await page.evaluate(() => {
          scrollTo(0, 0);
        });
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      const window = await desktop.browserWindow(page);
      assert.equal(
        await window.evaluate((window) => window.isVisible()),
        false,
        'Verification windows remain hidden',
      );
      const screenshot = await captureMatrixScreenshot(
        join(output, name),
        async () =>
          Buffer.from(
            await window.evaluate(async (w) =>
              (
                await w.webContents.capturePage(undefined, {
                  stayHidden: true,
                  stayAwake: true,
                })
              )
                .toPNG()
                .toString('base64'),
            ),
            'base64',
          ),
        await browserScreenshotMetrics(
          page,
          await window.evaluate((w) => w.webContents.getZoomFactor()),
        ),
        {
          purpose: /-step-/.test(name) ? 'preview' : 'representative',
          state: `${name}-scroll-${keepScroll}`,
          allowAlias: true,
        },
      );
      item.screenshots.push(screenshot.path);
    };
    const saveCaseProgress = async () => {
      await writeFile(
        join(output, 'results.json'),
        JSON.stringify(
          {
            ...evidence,
            cases: [...evidence.cases, item],
            result: 'in-progress',
          },
          null,
          2,
        ) + '\n',
      );
    };
    const settleFiniteMotion = async (page, selector) => {
      // Measure resting geometry, while leaving infinite actionable cues running.
      await page.evaluate(async (selector) => {
        const root = document.querySelector(selector);
        const animations = root
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.playState === 'running' &&
              Number.isFinite(animation.effect.getTiming().iterations),
          );
        await Promise.all(
          animations.map((animation) => animation.finished.catch(() => {})),
        );
        await new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        );
      }, selector);
    };
    const inspectPhone = async (page, phase, moment) => {
      if (!compactCheck) return;
      await settleFiniteMotion(page, '.pokemon-player');
      const geometry = await page.evaluate(() => {
        const bounds = (element) => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        };
        const visible = (element) => {
          const rect = bounds(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            getComputedStyle(element).visibility !== 'hidden'
          );
        };
        const hit = (element) => {
          const rect = bounds(element);
          const target = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return !!target && element.contains(target);
        };
        const boards = [
          ...document.querySelectorAll('.pokemon-player .pokemon-board'),
        ].filter(visible);
        return {
          viewport: { width: innerWidth, height: innerHeight },
          document: {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            scrollX,
            scrollY,
          },
          openDialogs: document.querySelectorAll('dialog[open]').length,
          scrollContainers: [
            ...document.querySelectorAll(
              '.pokemon-screen,.game-table,.pokemon-player,.target-board,.pokemon-board',
            ),
          ]
            .filter(visible)
            .map((element) => ({
              name: element.className,
              scrollTop: element.scrollTop,
            })),
          boards: boards.map((board) => ({
            bounds: bounds(board),
            scrollTop: board.scrollTop,
            slots: [...board.querySelectorAll('.card-slot')].map((slot) => ({
              label: slot.querySelector('.slot-index')?.textContent.trim(),
              bounds: bounds(slot),
              surface: bounds(slot.querySelector('.card-surface')),
              card: bounds(slot.querySelector('.pokemon-card')),
              number: bounds(slot.querySelector('.slot-index')),
              enabled: !slot.disabled,
              uncovered: hit(slot),
            })),
          })),
          controls: [
            ...document.querySelectorAll(
              '.pokemon-status .draw-pile,.pokemon-player .intent-actions button,.pokemon-player .submit-choice button,.pokemon-player .target-tabs button,.pokemon-player .private-peek button',
            ),
          ]
            .filter(visible)
            .map((button) => ({
              label:
                button.getAttribute('aria-label') ?? button.textContent.trim(),
              bounds: bounds(button),
              enabled: !button.disabled,
              uncovered: button.disabled || hit(button),
            })),
          targets: [
            ...document.querySelectorAll('.pokemon-player .target-tabs button'),
          ].map((button) => ({
            label: button.textContent.trim(),
            bounds: bounds(button),
            visible: visible(button),
            enabled: !button.disabled,
            uncovered: hit(button),
            textFits: button.scrollWidth <= button.clientWidth + 1,
            selected: button.getAttribute('aria-pressed') === 'true',
          })),
          privateCard: bounds(document.querySelector('.private-peek-card')),
        };
      });
      const label = `${scene.id} ${phase} ${moment}`;
      item.compactLayouts.push({ label, ...geometry });
      await saveCaseProgress();
      const inside = (rect) =>
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= -1 &&
        rect.top >= -1 &&
        rect.right <= geometry.viewport.width + 1 &&
        rect.bottom <= geometry.viewport.height + 1;
      assert.deepEqual(geometry.viewport, { width: 360, height: 640 }, label);
      assert.equal(geometry.openDialogs, 0, `${label}: normal main table`);
      assert.ok(
        geometry.document.width <= geometry.viewport.width + 1 &&
          geometry.document.height <= geometry.viewport.height + 1 &&
          Math.abs(geometry.document.scrollX) <= 1 &&
          Math.abs(geometry.document.scrollY) <= 1,
        `${label}: actions require no page scrolling`,
      );
      assert.ok(
        geometry.scrollContainers.every((element) => element.scrollTop === 0),
        `${label}: operation panels require no scrolling`,
      );
      assert.equal(
        geometry.boards.length,
        phase === 'charizard-view' ? 0 : 1,
        `${label}: one current decision board, except private peek`,
      );
      for (const board of geometry.boards) {
        assert.equal(board.slots.length, 6, `${label}: all six card positions`);
        assert.equal(
          board.scrollTop,
          0,
          `${label}: board requires no scrolling`,
        );
        for (const [index, slot] of board.slots.entries()) {
          assert.equal(slot.label, String(index + 1), `${label}: slot label`);
          assert.ok(
            [slot.bounds, slot.surface, slot.card, slot.number].every(inside),
            `${label}: card ${index + 1} and its number fit the first screen`,
          );
          assert.ok(
            slot.bounds.width >= 44 &&
              slot.bounds.height >= 44 &&
              slot.uncovered,
            `${label}: card ${index + 1} is an uncovered touch target`,
          );
        }
      }
      assert.ok(geometry.controls.length > 0, `${label}: main action controls`);
      for (const control of geometry.controls)
        assert.ok(
          inside(control.bounds) &&
            control.bounds.width >= 44 &&
            control.bounds.height >= 44 &&
            control.uncovered,
          `${label}: ${control.label} is visible, touchable and uncovered`,
        );
      if (phase === 'mew-other') {
        assert.equal(
          geometry.targets.length,
          players.length - 1,
          `${label}: every opponent has a target selector`,
        );
        assert.ok(
          geometry.targets.every(
            (target) =>
              target.label.length > 0 &&
              target.visible &&
              target.textFits &&
              inside(target.bounds) &&
              target.bounds.width >= 44 &&
              target.bounds.height >= 44 &&
              target.enabled &&
              target.uncovered,
          ),
          `${label}: all opponent labels are visible, readable and touchable`,
        );
        if (scene.id === 'L6-mew' && moment === 'before-confirmation')
          assert.equal(
            geometry.targets.at(-1).selected,
            true,
            `${label}: the last opponent is selected`,
          );
      }
      if (phase === 'charizard-view')
        assert.ok(
          inside(geometry.privateCard),
          `${label}: private card is visible`,
        );
    };
    await capture(publicPage, `${scene.id}-before-public.png`);
    await capture(phones[0], `${scene.id}-before-360.png`);
    assert.equal(
      await publicPage.locator('.decision-dashboard .current-actor').count(),
      1,
    );
    assert.equal(await publicPage.getByRole('progressbar').count(), 1);
    assert.equal(await publicPage.locator('.held-zone').count(), 1);
    for (const [index, action] of scene.actions) {
      let queuedAudio;
      const page = phones[index];
      const before = await fetchView(players[index].token);
      item.phases.push(before.gameView.phase);
      await page.locator('.pokemon-player').waitFor();
      if (reviewStages) {
        const stage = `${scene.id}-step-${item.actions + 1}-${before.gameView.phase}`;
        await capture(publicPage, `${stage}-public.png`);
        await capture(page, `${stage}-phone.png`);
        const board = page.locator('.pokemon-player .pokemon-board').last();
        if (await board.count()) {
          if (!compactCheck) await board.scrollIntoViewIfNeeded();
          await capture(page, `${stage}-phone-targets.png`, true);
          await page.evaluate(() => scrollTo(0, 0));
        }
      }
      await inspectPhone(page, before.gameView.phase, 'before-selection');
      const landscapeChoice = !compactCheck && !!scene.count && index === 0;
      const actionWindow = await desktop.browserWindow(page);
      if (landscapeChoice)
        await actionWindow.evaluate((window) =>
          window.setContentSize(844, 390),
        );
      if (!item.phases.slice(0, -1).includes(before.gameView.phase))
        await capture(page, `${scene.id}-${before.gameView.phase}-360.png`);
      const immediate = [
        'draw',
        'close-peek',
        'decline-ability',
        'discard-held',
      ].includes(action.type);
      if (action.type === 'draw')
        await page
          .getByRole('button', {
            name: action.source === 'deck' ? '从牌库取牌' : '从弃牌顶取牌',
            exact: true,
          })
          .click();
      else if (action.type === 'swap') {
        await page
          .locator('.pokemon-player > .pokemon-board button')
          .nth(action.a)
          .click();
        await page
          .locator('.pokemon-player > .pokemon-board button')
          .nth(action.b)
          .click();
      } else if (action.type === 'mew-target') {
        await page
          .locator('.target-tabs button')
          .nth(action.target - 1)
          .click();
        await page
          .locator('.target-board')
          .first()
          .locator('.pokemon-board button')
          .nth(action.slot)
          .click();
      } else if (action.type === 'close-peek')
        await page
          .getByRole('button', { name: '查看完成，关闭暗牌查看', exact: true })
          .click();
      else if (
        action.type === 'decline-ability' ||
        action.type === 'discard-held'
      )
        await page
          .getByRole('button', {
            name: action.type === 'decline-ability' ? '跳过能力' : '弃掉这张牌',
            exact: true,
          })
          .click();
      else
        await page
          .locator('.pokemon-player > .pokemon-board button')
          .nth(action.slot)
          .click();
      if (!immediate) {
        assert.equal(
          (await fetchView(players[index].token)).revision,
          before.revision,
          'Selection creates no authoritative action',
        );
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
        assert.equal(
          await page.evaluate(() => {
            const bar = document
              .querySelector('.submit-choice')
              .getBoundingClientRect();
            return [...document.querySelectorAll('.card-slot.selected')].some(
              (card) => {
                const rect = card.getBoundingClientRect();
                const center = rect.top + rect.height / 2;
                const centerX = rect.left + rect.width / 2;
                return (
                  center >= bar.top &&
                  center <= bar.bottom &&
                  centerX >= bar.left &&
                  centerX <= bar.right
                );
              },
            );
          }),
          false,
          'Selected card centers stay clear of confirmation bar',
        );
        if (landscapeChoice)
          await capture(page, `${scene.id}-selected-landscape.png`);
        await inspectPhone(page, before.gameView.phase, 'before-confirmation');
        if (
          compactCheck &&
          scene.id === 'L6-mew' &&
          action.type === 'mew-target'
        )
          await capture(
            page,
            'L6-mew-selected-last-opponent-360x640.png',
            true,
          );
        await page.locator('.confirm-action').click();
      }
      await page.waitForFunction(
        () =>
          document.querySelector('.feedback')?.textContent.trim() === '已保存',
      );
      const after = await fetchView(players[index].token);
      assert.equal(after.revision, before.revision + 1);
      if (scene.id === 'V04' && action.type === 'draw') {
        await publicPage.waitForFunction(
          () => window.tablemaxAudit.sounds.length > 0,
        );
        // Freeze the first cue before its ended event so the second cue stays queued.
        const playing = await publicPage.evaluate(() => {
          window.tablemaxAudit.lastAudio.pause();
          return [...window.tablemaxAudit.sounds];
        });
        assert.equal(
          playing.length,
          1,
          'Coin cry is still queued behind rocket cue',
        );
        queuedAudio = playing;
      }
      const latest = after.gameView.events.at(-1)?.action;
      assert.ok(
        latest,
        `${scene.id}: every saved choice has public action metadata`,
      );
      const announcement = publicPage.locator('.action-announcement');
      await publicPage.waitForFunction((action) => {
        const announcement = document.querySelector('.action-announcement');
        return (
          announcement?.dataset.verb === action.verb &&
          announcement.dataset.actor === (action.actor ?? '')
        );
      }, latest);
      assert.equal(
        await announcement.getAttribute('data-actor'),
        latest.actor ?? '',
      );
      if (latest.actor) {
        const name = after.seats.find((seat) => seat.id === latest.actor).name;
        assert.ok(
          (await announcement.locator('.action-kicker').textContent()).includes(
            name,
          ),
        );
      }
      assert.ok(
        (await announcement.locator('.action-title').textContent()).trim()
          .length >= 3,
      );
      const detail = await announcement.locator('.action-detail').textContent();
      for (const target of ['peek', 'close-peek'].includes(latest.verb)
        ? []
        : latest.targets) {
        const name = after.seats.find((seat) => seat.id === target.seat).name;
        assert.ok(
          detail.includes(name),
          `${scene.id}: saved target nickname is shown`,
        );
        for (const slot of target.slots)
          assert.ok(
            detail.includes(String(slot + 1)),
            `${scene.id}: target position uses one-based numbering`,
          );
      }
      if (['peek', 'close-peek'].includes(latest.verb)) {
        assert.equal(latest.cardCategory, 'special-charizard');
        assert.ok(latest.targets.every((target) => target.slots.length === 0));
        assert.equal(
          await publicPage.locator('.card-slot.action-target').count(),
          0,
        );
        assert.equal(
          detail.includes('号位'),
          false,
          'Public private-peek notice never identifies the hidden slot',
        );
      }
      assert.equal(JSON.stringify(latest).includes('#'), false);
      item.presentedActions.push({
        ...latest,
        title: await announcement.locator('.action-title').textContent(),
        detail,
      });
      if (!before.gameView.roundResult && after.gameView.roundResult) {
        await publicPage
          .locator('.result-effects')
          .waitFor({ state: 'attached' });
        await capture(publicPage, `${scene.id}-saved-result-effect.png`);
      } else if (
        before.gameView.coin !== after.gameView.coin &&
        after.gameView.coin
      ) {
        await publicPage.locator('.tossed-coin').waitFor({ state: 'attached' });
        await capture(publicPage, `${scene.id}-saved-coin-effect.png`);
      }
      if (queuedAudio) {
        await send({ type: 'pause' });
        await publicPage.getByText('游戏已暂停', { exact: true }).waitFor();
        await publicPage.evaluate(() => {
          window.tablemaxAudit.lastAudio.dispatchEvent(new Event('ended'));
        });
        assert.deepEqual(
          await publicPage.evaluate(() => window.tablemaxAudit.sounds),
          queuedAudio,
          'Clearing saved feedback on pause cancels queued coin cries',
        );
        item.pauseCancelsQueuedAudio = true;
        await send({ type: 'resume' });
      }
      if (landscapeChoice)
        await actionWindow.evaluate((window) =>
          window.setContentSize(360, 844),
        );
      item.actions++;
      if (after.gameView.phase === 'charizard-view') {
        assert.ok(after.gameView.peek);
        assert.equal((await fetchView(players[1].token)).gameView.peek, null);
        assert.equal((await fetchView()).gameView.peek, null);
        assert.equal(await publicPage.locator('.private-peek').count(), 0);
        assert.equal(await phones[1].locator('.private-peek').count(), 0);
        await capture(page, `${scene.id}-private-peek.png`);
      }
      item.narrowOverflow ||= await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      // Measure resting touch targets, separately from the audited card flip transform.
      await page.waitForTimeout(400);
      const sizes = await page
        .locator('.pokemon-player button:visible')
        .evaluateAll((buttons) =>
          buttons.map((button) => ({
            width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height,
          })),
        );
      assert.ok(sizes.every((s) => s.width >= 44 && s.height >= 44));
    }
    await capture(publicPage, `${scene.id}-public.png`);
    await capture(phones[0], `${scene.id}-360.png`);
    await capture(
      phones[1],
      `${scene.id}-${compactCheck ? '360-player-2' : '390'}.png`,
    );
    if (compactCheck && scene.id === 'V03') {
      await publicPage.locator('.result-table .round-banner').waitFor();
      for (const [width, height] of [
        [1280, 720],
        [1920, 1080],
      ]) {
        await publicWindow.evaluate(
          (window, size) => window.setContentSize(...size),
          [width, height],
        );
        await publicPage.evaluate(
          () =>
            new Promise((done) =>
              requestAnimationFrame(() => requestAnimationFrame(done)),
            ),
        );
        const geometry = await publicPage.evaluate(() => {
          const bounds = (element) => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            };
          };
          return {
            viewport: { width: innerWidth, height: innerHeight },
            document: {
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
            },
            panels: [
              ...document.querySelectorAll(
                '.game-seat,.round-banner,.score-detail,.game-toolbar',
              ),
            ].map(bounds),
            boards: [
              ...document.querySelectorAll('.game-seats .pokemon-board'),
            ].map((board) => {
              const rect = bounds(board);
              const slots = [...board.querySelectorAll('.card-slot')].map(
                (slot) => ({
                  bounds: bounds(slot),
                  card: bounds(slot.querySelector('.pokemon-card')),
                  number: bounds(slot.querySelector('.slot-index')),
                }),
              );
              return {
                bounds: rect,
                slots,
                cardFill:
                  slots.reduce(
                    (area, slot) => area + slot.card.width * slot.card.height,
                    0,
                  ) /
                  (rect.width * rect.height),
              };
            }),
          };
        });
        item.resultLayouts.push({ requested: [width, height], ...geometry });
        await capture(publicPage, `V03-result-${width}x${height}.png`);
        await saveCaseProgress();
        const inside = (rect) =>
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= -1 &&
          rect.top >= -1 &&
          rect.right <= geometry.viewport.width + 1 &&
          rect.bottom <= geometry.viewport.height + 1;
        assert.ok(
          geometry.document.width <= geometry.viewport.width + 1 &&
            geometry.document.height <= geometry.viewport.height + 1 &&
            geometry.panels.every(inside),
          `V03 result ${width}x${height}: cards, scores and winner fit the first screen`,
        );
        assert.equal(geometry.boards.length, 2, 'Two result boards are shown');
        for (const board of geometry.boards) {
          assert.equal(board.slots.length, 6, 'Six cards on each result board');
          assert.ok(
            board.slots.every(
              (slot) =>
                [slot.bounds, slot.card, slot.number].every(inside) &&
                slot.card.width + 1 >= (130 * width) / 1920,
            ),
            `V03 result ${width}x${height}: all card faces and numbers remain large and visible`,
          );
          assert.ok(
            board.cardFill >= 0.5,
            `V03 result ${width}x${height}: card faces fill at least half of each board`,
          );
        }
      }
    }
    await publicPage.locator('.recent-actions').click();
    const actionHistory = publicPage.locator(
      'dialog.action-history-panel[open]',
    );
    await actionHistory.waitFor();
    assert.ok(
      (await actionHistory.locator('.recent-action-list li').count()) > 0,
    );
    assert.ok(
      (await actionHistory.locator('.recent-action-list li').count()) <= 30,
    );
    await capture(publicPage, `${scene.id}-recent-actions.png`);
    await publicPage.keyboard.press('Escape');
    const publicView = await fetchView();
    if (
      !publicView.gameView.roundResult &&
      publicView.gameView.discard?.length
    ) {
      await publicPage.getByRole('button', { name: /^查看弃牌/ }).click();
      const gallery = publicPage.getByRole('dialog', {
        name: '弃牌 底 → 顶',
      });
      await gallery.waitFor();
      assert.equal(
        await gallery.locator('.pokemon-card').count(),
        publicView.gameView.discard.length,
      );
      await capture(publicPage, `${scene.id}-discard-gallery.png`);
      await publicPage.keyboard.press('Escape');
      assert.equal(await publicPage.locator('dialog[open]').count(), 0);
      assert.equal((await fetchView()).revision, publicView.revision);
    }
    item.cardLayout = await phones[0].evaluate(() =>
      [...document.querySelectorAll('.pokemon-card.face')].map((card) => {
        const heading = card
          .querySelector('.card-heading')
          .getBoundingClientRect();
        const value = card.querySelector('.card-value').getBoundingClientRect();
        const name = card.querySelector('.card-name');
        const image = card.querySelector('img').getBoundingClientRect();
        const ability = card
          .querySelector('.ability-mark')
          ?.getBoundingClientRect();
        return {
          name: name.textContent,
          font: parseFloat(getComputedStyle(name).fontSize),
          imageHeight: image.height,
          collision:
            !!ability &&
            value.left < ability.right &&
            value.right > ability.left,
          separated:
            image.top >= heading.bottom - 1 &&
            image.bottom <= name.getBoundingClientRect().top + 1,
        };
      }),
    );
    await saveCaseProgress();
    assert.ok(
      item.cardLayout.every(
        (card) =>
          card.font >= 12 &&
          card.imageHeight >= 25 &&
          !card.collision &&
          card.separated,
      ),
      'Card art and metadata stay in separate readable regions',
    );
    if (scene.count) {
      item.layouts = [];
      for (const [width, height] of [
        [1280, 720],
        [1080, 800],
        [1366, 768],
        [800, 900],
        [1920, 1080],
      ]) {
        await publicWindow.evaluate(
          (window, size) => window.setContentSize(...size),
          [width, height],
        );
        await settleFiniteMotion(publicPage, '.game-table');
        const metrics = await publicPage.evaluate(() => {
          const bounds = (element) => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            };
          };
          const seats = document.querySelector('.game-seats');
          const seatStyle = getComputedStyle(seats);
          const tableStyle = getComputedStyle(
            document.querySelector('.game-table'),
          );
          return {
            width: innerWidth,
            height: innerHeight,
            documentHeight: document.documentElement.scrollHeight,
            overflow: document.documentElement.scrollWidth > innerWidth,
            boardCount: document.querySelectorAll('.game-seats .pokemon-board')
              .length,
            dashboard: bounds(document.querySelector('.decision-dashboard')),
            currentActor: bounds(document.querySelector('.current-actor')),
            gameSeats: bounds(seats),
            computedGrid: {
              columns: seatStyle.gridTemplateColumns,
              rows: seatStyle.gridTemplateRows,
              tableColumns: tableStyle.gridTemplateColumns,
              tableRows: tableStyle.gridTemplateRows,
            },
            cards: [
              ...document.querySelectorAll('.game-seats .pokemon-card'),
            ].map(bounds),
          };
        });
        item.layouts.push(metrics);
        await capture(publicPage, `${scene.id}-${width}x${height}.png`);
        await saveCaseProgress();
        assert.equal(metrics.overflow, false);
        assert.equal(metrics.boardCount, scene.count);
        assert.ok(
          metrics.cards.every((card) => card.width >= 52 && card.height >= 70),
          `${scene.count} seats at ${width}x${height}: ${JSON.stringify(metrics.cards)}`,
        );
        if (scene.count === 6 && [1080, 1280, 1366].includes(width)) {
          assert.ok(
            metrics.documentHeight <= metrics.height + 1 &&
              metrics.cards.length === 36 &&
              metrics.cards.every(
                (card) =>
                  card.left >= -1 &&
                  card.top >= -1 &&
                  card.right <= metrics.width + 1 &&
                  card.bottom <= metrics.height + 1,
              ),
            `Six-player play ${width}x${height}: all boards fit without page scrolling`,
          );
        }
      }
      const phoneWindow = await desktop.browserWindow(phones[0]);
      const phoneMetrics = compactCheck
        ? await phones[0].context().newCDPSession(phones[0])
        : null;
      for (const [width, height] of [
        [360, 640],
        [844, 390],
      ]) {
        await phoneWindow.evaluate(
          (window, size) => window.setContentSize(...size),
          [width, height],
        );
        if (phoneMetrics)
          await phoneMetrics.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: true,
          });
        await capture(phones[0], `${scene.id}-phone-${width}x${height}.png`);
        assert.equal(
          await phones[0].evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
      }
      await phoneWindow.evaluate(
        (window, height) => window.setContentSize(360, height),
        compactCheck ? 640 : 844,
      );
      if (phoneMetrics)
        await phoneMetrics.send('Emulation.setDeviceMetricsOverride', {
          width: 360,
          height: 640,
          deviceScaleFactor: 1,
          mobile: true,
        });
      if (scene.count === 2) {
        await publicWindow.evaluate((window) =>
          window.webContents.setZoomFactor(2),
        );
        await capture(publicPage, 'L2-zoom200.png');
        assert.equal(
          await publicPage.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await publicWindow.evaluate((window) =>
          window.webContents.setZoomFactor(1),
        );
      }
    }
    for (const page of [publicPage, ...phones]) {
      assert.ok(new URL(page.url()).pathname.endsWith('/game'));
      assert.equal(
        await page.locator('.hero, .invite-friends, footer').count(),
        0,
      );
      assert.ok(
        await page
          .locator('.game-table')
          .evaluate(
            (element) =>
              element.getBoundingClientRect().width / innerWidth > 0.9,
          ),
        'Table uses almost all screen width',
      );
    }
    const phone = phones[0];
    const navigationView = await fetchView(players[0].token);
    await phone.getByRole('link', { name: '‹ 盒子', exact: true }).click();
    assert.equal(new URL(phone.url()).pathname, '/player');
    assert.equal(await phone.locator('.game-table').count(), 0);
    await phone.getByRole('link', { name: '进入牌桌', exact: true }).click();
    assert.equal(
      (await fetchView(players[0].token)).revision,
      navigationView.revision,
      'Navigation never changes game state',
    );
    await phone.reload();
    await phone.locator('.connection.online').waitFor();
    assert.equal(new URL(phone.url()).pathname, '/player/game');
    await phone.getByRole('button', { name: '菜单', exact: true }).click();
    await phone.getByRole('dialog', { name: '牌桌菜单' }).waitFor();
    await phone.keyboard.press('Escape');
    assert.equal(await phone.locator('dialog[open]').count(), 0);
    assert.equal(item.narrowOverflow, false);
    if (scene.id === 'V03') {
      const endedRound = await fetchView(token);
      assert.ok(endedRound.lifecycleActions.length);
      await send({ type: 'lifecycle', action: endedRound.lifecycleActions[0] });
      await publicPage
        .locator('.current-operation')
        .filter({ hasText: '翻开第一张牌' })
        .waitFor();
      await publicPage.waitForFunction(() =>
        window.tablemaxAudit.motionStyles.some(
          (style) => style.name === 'saved-deal' && style.duration === '0.36s',
        ),
      );
      await capture(publicPage, 'V03-next-round-public.png');
      item.nextRoundDealObserved = true;
    }
    const beforeSync = await publicPage.evaluate(
      () => window.tablemaxAudit.sounds.length,
    );
    item.animations = await publicPage.evaluate(
      () => window.tablemaxAudit.animations.length,
    );
    item.effects = await publicPage.evaluate(() => [
      ...new Set(
        window.tablemaxAudit.animations.filter((name) =>
          [
            'coin-toss',
            'effect-title-pop',
            'firework-flight',
            'mew-transfer',
            'zapdos-strike',
            'snorlax-swap',
            'rocket-impact',
            'saved-reveal',
          ].includes(name),
        ),
      ),
    ]);
    item.motionStyles = await publicPage.evaluate(
      () => window.tablemaxAudit.motionStyles,
    );
    assert.ok(
      item.motionStyles.some(
        (style) => style.name === 'saved-card' && style.duration === '0.22s',
      ),
      `${scene.id} saved changes use 220ms motion`,
    );
    await publicPage.reload();
    await publicPage.locator('.connection.online').waitFor();
    assert.deepEqual(
      await publicPage.evaluate(() => window.tablemaxAudit.sounds),
      [],
    );
    assert.deepEqual(
      await publicPage.evaluate(() => window.tablemaxAudit.animations),
      [],
    );
    assert.ok(
      beforeSync >= 1,
      'Saved public events invoked default-on local audio',
    );
    assert.equal(await phones[0].locator('.sound-control').count(), 0);
    item.soundCalls = beforeSync;
    const hostView = await fetchView(token);
    if (hostView.history.length) {
      await send({
        type: 'rollback',
        checkpointId: hostView.history.at(-1).id,
      });
      assert.deepEqual(
        await publicPage.evaluate(() => window.tablemaxAudit.sounds),
        [],
      );
      assert.equal(await publicPage.locator('.saved-motion').count(), 0);
    }
    await publicPage.emulateMedia({ reducedMotion: 'reduce' });
    const animation = await publicPage
      .locator('.card-slot')
      .first()
      .evaluate((element) => {
        element.classList.add('saved-motion');
        return getComputedStyle(element).animationName;
      });
    assert.equal(animation, 'none');
    for (const kind of ['saved-reveal', 'saved-deal']) {
      assert.equal(
        await publicPage
          .locator('.card-slot')
          .first()
          .evaluate((element, kind) => {
            element.classList.add(kind);
            return getComputedStyle(element).animationName;
          }, kind),
        'none',
      );
    }
    const coinAnimation = await publicPage
      .locator('.game-table')
      .evaluate((element) => {
        element.classList.add('saved-coin');
        return getComputedStyle(element).animationName;
      });
    assert.equal(coinAnimation, 'none');
    evidence.cases.push(item);
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify({ ...evidence, result: 'in-progress' }, null, 2) + '\n',
    );
    console.log(`Verified ${scene.id} UI and local saved-event feedback.`);
  } finally {
    socket?.disconnect();
    await desktop.close();
  }
}
assert.deepEqual(evidence.external, []);
assert.deepEqual(evidence.errors, []);
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ ...evidence, result: 'passed' }, null, 2) + '\n',
);
console.log(
  JSON.stringify({ result: 'passed', cases: evidence.cases.length, output }),
);
