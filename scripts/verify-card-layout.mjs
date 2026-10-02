import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/card-layout-'));
const output = resolve('artifacts/maintenance/v1.6.0/cards');
await mkdir(output, { recursive: true });
await build({
  stdin: {
    resolveDir: resolve('.'),
    sourcefile: 'card-layout-fixture.ts',
    loader: 'ts',
    contents: `
      import { RoomCoordinator } from './packages/platform-core/src/room';
      import { SqliteSaveRepository } from './apps/server/src/save-repository';
      import { rules, bot } from './games/pokemon-encounters';
      import { categories, instances } from './games/pokemon-encounters/rules/cards';
      // Geometry-only fixture: real saved state, complete unique deck and all
      // categories publicly face-up. It cannot be selected by the product UI.
      export async function prepare(dataDir: string) {
        const repository = new SqliteSaveRepository(dataDir);
        const game = { ...rules, initialize(input: Parameters<typeof rules.initialize>[0]) {
          const base = rules.initialize(input);
          const first = categories.map(card => instances.find(id => id.startsWith(card.categoryId + '#'))!);
          const ordered = [...first, ...instances.filter(id => !first.includes(id))];
          const used = ordered.slice(0, 36);
          const remaining = ordered.slice(36);
          return { ...base,
            boards: Object.fromEntries(input.seats.map((seat, index) => [seat,
              used.slice(index * 6, index * 6 + 6).map(instanceId => ({ instanceId, faceUp: true }))])),
            deck: remaining.slice(1), discard: remaining.slice(0, 1),
            initialDone: [...input.seats], phase: 'draw',
            winsBySeat: Object.fromEntries(input.seats.map((seat, index) => [seat, index % 3])),
          };
        }};
        const room = new RoomCoordinator(game, bot, repository);
        const players = [];
        const command = async (token: string, command: unknown) => {
          const v = room.view(token);
          const result = await room.command(token, { actionId: crypto.randomUUID(),
            instanceId: v.instanceId, revision: v.revision, branch: v.branch, command } as any);
          if (!result.ok) throw new Error(result.reason);
        };
        for (let index = 0; index < 6; index++) {
          const player = await room.join(index === 0 ? '长昵称朋友完整显示并保持卡面清楚' : '卡面朋友 ' + (index + 1));
          players.push({ ...player, seatId: room.view(player.token).self.seatId });
          await command(player.token, { type: 'ready', ready: true });
        }
        await command(room.hostToken, { type: 'start' });
        repository.close();
        return { players, categories: categories.map(card => card.categoryId) };
      }
    `,
  },
  outfile: join(work, 'prepare.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { prepare } = require(join(work, 'prepare.cjs'));
await mkdir(join(work, 'data'));
const { players, categories } = await prepare(join(work, 'data'));
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: join(work, 'data'),
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_PATH;
delete env.TABLEMAX_WEB_DEV_URL;
delete env.TABLEMAX_PLAY_MODE;
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual hidden Electron and production CardFace rendering from an isolated saved geometry fixture containing all 16 categories; independent phone partitions. No physical phone, TV or card authenticity claim.',
  screenshots: [],
  layouts: [],
  errors: [],
  external: [],
};
let desktop;
try {
  desktop = await _electron.launch({
    executablePath: require('electron'),
    args: [
      resolve('build/desktop'),
      '--foundation-test',
      '--tablemax-test-mode',
    ],
    env,
    timeout: 30000,
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  const origin = new URL(host.url()).origin;
  const observe = (page) => {
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => evidence.errors.push(error.message));
    page.on('request', (request) => {
      if (
        request.url().startsWith('http') &&
        new URL(request.url()).origin !== origin
      )
        evidence.external.push(request.url());
    });
  };
  observe(host);
  await host.goto(`${origin}/host/game`);
  await host.locator('.game-table[data-seats="6"]').waitFor();
  const open = async (route, index = 0) => {
    const next = desktop.waitForEvent('window');
    await desktop.evaluate(
      ({ BrowserWindow }, input) => {
        const window = new BrowserWindow({
          frame: false,
          show: false,
          width: 390,
          height: 844,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            offscreen: true,
            backgroundThrottling: false,
            partition: `card-layout-${input.route}-${input.index}`,
          },
        });
        void window.loadURL(input.url);
      },
      { route, index, url: `${origin}/${route}/game` },
    );
    const page = await next;
    observe(page);
    if (route === 'player') {
      await page.evaluate(
        (token) => localStorage.setItem('tablemax-player', token),
        players[index].token,
      );
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });
      await page.reload();
    }
    await page.getByText('本地连接已就绪', { exact: true }).waitFor();
    return page;
  };
  const publicPage = await open('public');
  const phones = [];
  for (const index of [0, 1, 2]) phones.push(await open('player', index));
  const inspect = async (page, name, width, height, mobile = false, seatId) => {
    const window = await desktop.browserWindow(page);
    assert.equal(await window.evaluate((w) => w.isVisible()), false);
    await window.evaluate(
      (w, size) => w.setContentSize(size.width, size.height),
      { width, height },
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await page.evaluate(() => {
      scrollTo(0, 0);
      document.activeElement?.blur();
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.pokemon-card.face > img')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    const selector = mobile
      ? `.game-seat[data-seat="${seatId}"] .pokemon-card.face`
      : '.game-seat .pokemon-card.face';
    const metrics = await page.locator(selector).evaluateAll((cards) =>
      cards.map((card) => {
        const bounds = (element) => {
          const r = element.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        const image = card.querySelector('img'),
          heading = card.querySelector('.card-heading'),
          name = card.querySelector('.card-name');
        const value = card.querySelector('.card-value'),
          ability = card.querySelector('.ability-mark');
        const slot = card.closest('.card-slot');
        const surface = slot.querySelector('.card-surface');
        const slotIndex = slot.querySelector('.slot-index');
        const context = document.createElement('canvas').getContext('2d');
        const style = getComputedStyle(name);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return {
          category: card.dataset.category,
          card: bounds(card),
          image: bounds(image),
          heading: bounds(heading),
          name: bounds(name),
          value: bounds(value),
          imageLoaded: image.complete && image.naturalWidth > 0,
          nameText: name.textContent,
          nameFont: parseFloat(style.fontSize),
          textWidth: context.measureText(name.textContent).width,
          ability: ability ? bounds(ability) : null,
          surface: bounds(surface),
          slotIndex: bounds(slotIndex),
          slotBorder: getComputedStyle(slot).borderTopWidth,
        };
      }),
    );
    const layout = {
      name,
      width,
      height,
      mobile,
      metrics,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    };
    evidence.layouts.push(layout);
    assert.ok(
      metrics.every(
        (item) =>
          item.slotIndex.y >= item.surface.bottom + 2 &&
          item.slotBorder === '0px',
      ),
      `${name}: selection surface excludes the slot number`,
    );
    const png = await window.evaluate(async (w) =>
      (
        await w.webContents.capturePage(undefined, {
          stayHidden: true,
          stayAwake: true,
        })
      )
        .toPNG()
        .toString('base64'),
    );
    await writeFile(join(output, `${name}.png`), Buffer.from(png, 'base64'));
    evidence.screenshots.push(`${name}.png`);
    assert.equal(
      layout.overflow,
      false,
      `${name}: no horizontal page overflow`,
    );
    assert.equal(
      metrics.length,
      mobile ? 6 : 36,
      `${name}: all saved open cards rendered`,
    );
    for (const m of metrics) {
      assert.ok(
        m.imageLoaded,
        `${name}/${m.category}: bundled illustration loaded`,
      );
      assert.ok(
        m.nameFont >= 12,
        `${name}/${m.category}: card name font >=12px`,
      );
      assert.ok(
        m.textWidth <= m.name.width + 1,
        `${name}/${m.category}: full name fits`,
      );
      assert.ok(
        m.image.height >= 25 && m.image.width >= 25,
        `${name}/${m.category}: artwork has visible area >=25px`,
      );
      for (const part of [
        m.image,
        m.name,
        m.heading,
        m.value,
        ...(m.ability ? [m.ability] : []),
      ]) {
        assert.ok(
          part.x >= m.card.x - 1 &&
            part.y >= m.card.y - 1 &&
            part.right <= m.card.right + 1 &&
            part.bottom <= m.card.bottom + 1,
          `${name}/${m.category}: image/name/value/ability remain inside card`,
        );
      }
      assert.ok(
        m.heading.bottom <= m.image.y + 1 && m.image.bottom <= m.name.y + 1,
        `${name}/${m.category}: three card regions do not overlap`,
      );
    }
    if (!mobile)
      assert.deepEqual(
        [...new Set(metrics.map((m) => m.category))].sort(),
        [...categories].sort(),
      );
  };
  for (const [width, height] of [
    [1080, 800],
    [1366, 768],
    [1920, 1080],
    [800, 900],
  ])
    await inspect(publicPage, `all-cards-public-${width}`, width, height);
  for (const [index, phone] of phones.entries())
    for (const [width, height] of [
      [360, 640],
      [390, 844],
      [844, 390],
    ])
      await inspect(
        phone,
        `cards-phone-${index + 1}-${width}`,
        width,
        height,
        true,
        players[index].seatId,
      );
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.external, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await writeFile(
    join(output, 'results.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}
console.log(
  JSON.stringify({
    result: evidence.result,
    output,
    layouts: evidence.layouts.length,
    categories: categories.length,
  }),
);
