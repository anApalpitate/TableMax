import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { build } from 'esbuild';
import { mkdir, mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const verifyDeal = process.argv.includes('--verify-deal');
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
  output = resolve(
    'artifacts/maintenance/six-player-presentation/ui',
    ...(only
      ? [evidenceName ?? (verifyDeal ? 'round-deal' : 'additional')]
      : []),
  );
await mkdir(output, { recursive: true });
const audioFiles = (await readdir('build/desktop/web/assets')).filter((file) =>
  file.endsWith('.wav'),
);
assert.equal(audioFiles.length, 5);
await build({
  entryPoints: ['scripts/fixtures/prepare-pokemon.ts'],
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
    id: 'V00',
    actions: [
      [0, { type: 'initial-flip', slot: 0 }],
      [1, { type: 'initial-flip', slot: 0 }],
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'replace', slot: 1 }],
    ],
  },
  {
    id: 'V03',
    actions: [
      [0, { type: 'draw', source: 'deck' }],
      [0, { type: 'mew-target', target: 1, slot: 5 }],
      [0, { type: 'replace', slot: 1 }],
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
    'Actual production rules/UI/service loaded from specification saved fixtures, desktop 1920 and Chromium touch/360/390 simulation; audio decode and play-call observations, no physical phone/TV or listening claim',
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
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_PATH;
  delete env.TABLEMAX_WEB_DEV_URL;
  const desktop = await _electron.launch({
    executablePath: require('electron'),
    args: [
      resolve('build/desktop'),
      '--foundation-test',
      '--tablemax-test-mode',
    ],
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
          width: route === 'public' ? 1920 : index ? 390 : 360,
          height: route === 'public' ? 1080 : 844,
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
        await page.evaluate(
          (token) => localStorage.setItem('tablemax-player', token),
          players[index].token,
        );
      }
      await page.reload();
      await page.getByText('本地连接已就绪', { exact: true }).waitFor();
      return page;
    };
    await observe(host);
    await host.goto(`${origin}/host/game`);
    await host.reload();
    await host.getByText('本地连接已就绪', { exact: true }).waitFor();
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
      .getByRole('button', { name: '开启本屏提示音', exact: true })
      .click();
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
            return {
              file,
              seconds: decoded.duration,
              channels: decoded.numberOfChannels,
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
          audio.seconds > 0.2 && audio.seconds < 0.5 && audio.channels === 1,
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
    };
    const capture = async (page, name) => {
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
      const data = await window.evaluate(async (w) =>
        (
          await w.webContents.capturePage(undefined, {
            stayHidden: true,
            stayAwake: true,
          })
        )
          .toPNG()
          .toString('base64'),
      );
      await writeFile(join(output, name), Buffer.from(data, 'base64'));
      item.screenshots.push(name);
    };
    await capture(publicPage, `${scene.id}-before-public.png`);
    await capture(phones[0], `${scene.id}-before-360.png`);
    for (const [index, action] of scene.actions) {
      const page = phones[index];
      const before = await fetchView(players[index].token);
      item.phases.push(before.gameView.phase);
      await page.locator('.pokemon-player').waitFor();
      const landscapeChoice = !!scene.count && index === 0;
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
          .getByRole('button', { name: '已看完，关闭查看', exact: true })
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
        await page.locator('.confirm-action').click();
      }
      await page.waitForFunction(
        () =>
          document.querySelector('.feedback')?.textContent.trim() === '已保存',
      );
      const after = await fetchView(players[index].token);
      assert.equal(after.revision, before.revision + 1);
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
    await capture(phones[1], `${scene.id}-390.png`);
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
        name: '弃牌 · 底 → 顶',
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
        [1080, 800],
        [1366, 768],
        [800, 900],
        [1920, 1080],
      ]) {
        await publicWindow.evaluate(
          (window, size) => window.setContentSize(...size),
          [width, height],
        );
        await publicPage.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        const metrics = await publicPage.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
          boardCount: document.querySelectorAll('.game-seats .pokemon-board')
            .length,
          cards: [
            ...document.querySelectorAll('.game-seats .pokemon-card'),
          ].map((card) => ({
            width: card.getBoundingClientRect().width,
            height: card.getBoundingClientRect().height,
            bottom: card.getBoundingClientRect().bottom,
          })),
        }));
        assert.equal(metrics.overflow, false);
        assert.equal(metrics.boardCount, scene.count);
        assert.ok(
          metrics.cards.every((card) => card.width >= 52 && card.height >= 70),
          `${scene.count} seats at ${width}x${height}: ${JSON.stringify(metrics.cards)}`,
        );
        await capture(publicPage, `${scene.id}-${width}x${height}.png`);
        item.layouts.push(metrics);
        if (scene.count === 6 && [1080, 1366].includes(width)) {
          assert.ok(
            metrics.documentHeight <= height + 1 &&
              metrics.cards.every((card) => card.bottom <= height + 1),
            `Six-player play ${width}x${height}: all boards fit without page scrolling`,
          );
        }
      }
      const phoneWindow = await desktop.browserWindow(phones[0]);
      for (const [width, height] of [
        [360, 640],
        [844, 390],
      ]) {
        await phoneWindow.evaluate(
          (window, size) => window.setContentSize(...size),
          [width, height],
        );
        await capture(phones[0], `${scene.id}-phone-${width}x${height}.png`);
        assert.equal(
          await phones[0].evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
      }
      await phoneWindow.evaluate((window) => window.setContentSize(360, 844));
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
    await phone.getByText('本地连接已就绪', { exact: true }).waitFor();
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
        .getByRole('heading', { name: '翻开第一张牌', exact: true })
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
            'sparkle-flight',
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
    await publicPage.getByText('本地连接已就绪', { exact: true }).waitFor();
    assert.deepEqual(
      await publicPage.evaluate(() => window.tablemaxAudit.sounds),
      [],
    );
    assert.deepEqual(
      await publicPage.evaluate(() => window.tablemaxAudit.animations),
      [],
    );
    assert.ok(beforeSync > 1, 'Saved public events invoked local audio');
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
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(
  JSON.stringify({ result: 'passed', cases: evidence.cases.length, output }),
);
