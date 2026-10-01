import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { build } from 'esbuild';
import { mkdir, mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/game-ui-')),
  output = resolve('artifacts/phase-06/verification/ui');
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
];
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual production rules/UI/service loaded from specification saved fixtures, desktop 1920 and Chromium touch/360/390 simulation; audio decode and play-call observations, no physical phone/TV or listening claim',
  cases: [],
  external: [],
  errors: [],
};
for (const scene of scenes) {
  const dataDir = join(work, scene.id);
  await mkdir(dataDir);
  const players = await prepare(scene.id, dataDir, scene.seed);
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
    args: [resolve('build/desktop'), '--foundation-test'],
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
            show: false,
            width: config.width,
            height: config.height,
            webPreferences: {
              sandbox: true,
              nodeIntegration: false,
              contextIsolation: true,
              partition: config.partition,
              backgroundThrottling: false,
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
          url: `${origin}/${route}`,
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
    await host.reload();
    await host.getByText('本地连接已就绪', { exact: true }).waitFor();
    const publicPage = await open('public'),
      phones = [];
    await publicPage.emulateMedia({ reducedMotion: 'no-preference' });
    const publicWindow = await desktop.browserWindow(publicPage);
    await publicWindow.evaluate((window) => window.showInactive());
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
      decodedAudio,
      narrowOverflow: false,
    };
    const capture = async (page, name) => {
      await page.evaluate(() => {
        document.activeElement?.blur();
        scrollTo(0, 0);
      });
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      const window = await desktop.browserWindow(page);
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
    for (const [index, action] of scene.actions) {
      const page = phones[index];
      const before = await fetchView(players[index].token);
      item.phases.push(before.gameView.phase);
      await page
        .getByRole('button', { name: '确认提交', exact: true })
        .waitFor();
      if (action.type === 'draw')
        await page
          .getByRole('button', { name: '从牌库取牌', exact: true })
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
      } else if (action.type === 'mew-target')
        await page
          .locator('.target-board')
          .nth(action.target - 1)
          .locator('.pokemon-board button')
          .nth(action.slot)
          .click();
      else if (action.type === 'close-peek')
        await page
          .getByRole('button', { name: '已看完，关闭查看', exact: true })
          .click();
      else
        await page
          .locator('.pokemon-player > .pokemon-board button')
          .nth(action.slot)
          .click();
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
              return center >= bar.top && center <= bar.bottom;
            },
          );
        }),
        false,
        'Selected card centers stay clear of confirmation bar',
      );
      await page.getByRole('button', { name: '确认提交', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('.feedback')?.textContent.trim() === '已保存',
      );
      const after = await fetchView(players[index].token);
      assert.equal(after.revision, before.revision + 1);
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
    assert.equal(item.narrowOverflow, false);
    const beforeSync = await publicPage.evaluate(
      () => window.tablemaxAudit.sounds.length,
    );
    item.animations = await publicPage.evaluate(
      () => window.tablemaxAudit.animations.length,
    );
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
