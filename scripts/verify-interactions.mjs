import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { launchDesktop } from './desktop-test.mjs';
import { launchTestBrowser } from './browser-test.mjs';
import { playerFrame, playerUi } from './player-test.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const output = resolve(
  'artifacts/maintenance/v1.0.5/interaction-ui',
  process.argv.find((a) => a.startsWith('--run='))?.slice(6) ??
    String(Date.now()),
);
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/interaction-ui-'));
const report = {
  status: 'running',
  checks: [],
  errors: [],
  external: [],
  screenshots: [],
  scope:
    'Actual production WinForms/WebView2 and muted Edge browser iframe on loopback; simulated viewports, no physical phone or human audio listening claim.',
};
let desktop,
  browser,
  socket,
  playerSocket,
  origin,
  host,
  publicPage,
  player,
  hostToken,
  token;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const save = () =>
  writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
const checked = async (text) => {
  report.checks.push(text);
  console.log(text);
  await save();
};
function observe(page) {
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('request', (request) => {
    if (
      request.url().startsWith('http') &&
      new URL(request.url()).origin !== origin
    )
      report.external.push(request.url());
  });
}
async function view(credential = hostToken) {
  const reply = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: credential }),
    })
  ).json();
  assert.ok(reply.ok);
  return reply.view;
}
async function command(command) {
  const state = await view();
  const reply = await socket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: state.instanceId,
    branch: state.branch,
    revision: state.revision,
    command,
  });
  assert.ok(reply.ok, JSON.stringify(reply));
}
async function select(index) {
  const frame = await playerFrame(player);
  const orb = frame.locator('.interaction-orb');
  const rect = await orb.boundingBox();
  assert.ok(rect);
  await player.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await player.mouse.down();
  await frame.locator('.interaction-wheel').waitFor();
  assert.equal(
    await frame.locator('.interaction-wheel__sectors path').count(),
    6,
  );
  const ring = await frame.locator('.interaction-wheel').boundingBox();
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  await player.mouse.move(
    ring.x + ring.width / 2 + Math.cos(angle) * 86,
    ring.y + ring.height / 2 + Math.sin(angle) * 86,
    { steps: 4 },
  );
  await player.mouse.up();
  await frame.locator('.interaction-wheel').waitFor({ state: 'detached' });
}
async function shot(id, index) {
  await select(index);
  const frame = await playerFrame(player);
  await frame.locator('.interaction-aim').waitFor();
  const before = await view();
  await frame.evaluate(() => {
    window.__interactionUnderlyingClicks = 0;
    document
      .querySelector('.room-root')
      .addEventListener('click', () => window.__interactionUnderlyingClicks++);
  });
  const rect = await frame.locator('body').boundingBox();
  await player.mouse.click(rect.x + rect.width * 0.32, rect.y + 210);
  await host.locator(`[data-effect="${id}"]`).waitFor();
  await publicPage.locator(`[data-effect="${id}"]`).waitFor();
  await frame.locator(`[data-effect="${id}"]`).waitFor();
  assert.equal(await frame.locator('.interaction-aim').count(), 0);
  assert.equal(
    await frame.evaluate(() => window.__interactionUnderlyingClicks),
    0,
  );
  assert.equal((await view()).revision, before.revision);
  assert.equal(
    await frame
      .locator('.interaction-shot img')
      .evaluateAll((images) =>
        images.every((i) => i.complete && i.naturalWidth > 0),
      ),
    true,
  );
  await wait(650);
  await player.screenshot({ path: join(output, id + '.png') });
  report.screenshots.push(id + '.png');
  await checked(
    id +
      ': one-shot interception, unchanged revision, three-end playback and local images',
  );
  await host.locator('.interaction-shot').waitFor({ state: 'detached' });
  await wait(250);
}
try {
  desktop = await launchDesktop({
    env: {
      ...process.env,
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: join(work, 'data'),
    },
  });
  host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  socket = io(origin, {
    auth: { token: hostToken },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    socket.once('connect', done);
    socket.once('connect_error', reject);
  });
  await command({ type: 'select-game', gameId: 'modern-art' });
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()
      .items[0].submenu.items.find((i) => i.label === '打开公共屏')
      .click(),
  );
  publicPage = await next;
  observe(publicPage);
  await publicPage.locator('.interaction-block').waitFor();
  assert.equal(await host.locator('.interaction-orb').count(), 0);
  assert.equal(await publicPage.locator('.interaction-orb').count(), 0);
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  player = await context.newPage();
  observe(player);
  await player.goto(origin);
  await playerUi(player)
    .getByLabel('你的昵称', { exact: true })
    .fill('互动验收');
  await playerUi(player)
    .getByRole('button', { name: '加入', exact: true })
    .click();
  await playerUi(player).locator('.interaction-orb').waitFor();
  token = await (
    await playerFrame(player)
  ).evaluate(() => localStorage.getItem('tablemax-player'));
  playerSocket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    playerSocket.once('connect', done);
    playerSocket.once('connect_error', reject);
  });
  await checked(
    'Only seated human player receives the orb; host/public receive a block control',
  );
  for (const [index, id] of [
    'egg',
    'cappuccino',
    'tomato',
    'flower',
    'poop',
  ].entries())
    await shot(id, index);
  await select(5);
  const frame = await playerFrame(player);
  const speech = frame.getByRole('dialog', { name: '发言', exact: true });
  await speech.waitFor();
  assert.equal(await speech.locator('.interaction-phrases button').count(), 6);
  assert.equal(await speech.locator('input,textarea').count(), 0);
  await speech.getByRole('button', { name: '干得漂亮', exact: true }).click();
  await host.locator('.interaction-speech').waitFor();
  await host.getByRole('button', { name: '屏蔽互动', exact: true }).click();
  assert.equal(await host.locator('.interaction-speech').count(), 0);
  assert.equal(await publicPage.locator('.interaction-speech').count(), 1);
  await host.getByRole('button', { name: '恢复互动', exact: true }).click();
  assert.equal(await host.locator('.interaction-speech').count(), 0);
  await checked(
    'Six fixed speech slots; block immediately removes local playback and restoring does not replay',
  );
  await wait(4250);
  const claims = await Promise.all([
    host.evaluate(() =>
      window.tablemaxInteractionAudio.claimEvent('ui-priority-a'),
    ),
    publicPage.evaluate(() =>
      window.tablemaxInteractionAudio.claimEvent('ui-priority-a'),
    ),
  ]);
  assert.deepEqual(claims, [false, true]);
  await publicPage
    .getByRole('button', { name: '屏蔽互动', exact: true })
    .click();
  await wait(250);
  assert.equal(
    await host.evaluate(() =>
      window.tablemaxInteractionAudio.claimEvent('ui-priority-b'),
    ),
    true,
  );
  assert.equal(
    await publicPage.evaluate(() =>
      window.tablemaxInteractionAudio.claimEvent('ui-priority-b'),
    ),
    false,
  );
  await publicPage
    .getByRole('button', { name: '恢复互动', exact: true })
    .click();
  assert.equal(
    await frame.evaluate(() => typeof window.tablemaxInteractionAudio),
    'undefined',
  );
  await checked(
    'Independent native interaction ownership: public priority, host fallback, no player bridge',
  );
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    await player.setViewportSize(viewport);
    await frame.getByRole('button', { name: '更换头像', exact: true }).click();
    const panel = frame.getByRole('dialog', { name: '选择头像', exact: true });
    await panel
      .locator('input[type=file]')
      .setInputFiles('assets/platform/avatar-1.webp');
    await panel.locator('.avatar-upload__editor').waitFor();
    await wait(200);
    const metrics = await panel
      .locator('.avatar-upload__editor')
      .evaluate((el) => ({
        height: innerHeight,
        buttons: Array.from(el.querySelectorAll('button')).map((b) => ({
          text: b.textContent.trim(),
          top: b.getBoundingClientRect().top,
          bottom: b.getBoundingClientRect().bottom,
        })),
        directions: el.querySelectorAll('[aria-label*="移"]').length,
      }));
    assert.deepEqual(
      metrics.buttons.map((b) => b.text),
      ['取消', '确定'],
    );
    assert.ok(
      metrics.buttons.every((b) => b.top >= 0 && b.bottom <= metrics.height),
      JSON.stringify({ viewport, metrics }),
    );
    assert.equal(metrics.directions, 0);
    // The interactive orb must stay in the real modal top layer.
    assert.equal(await panel.locator('.interaction-orb').count(), 1);
    await player.screenshot({
      path: join(output, `avatar-${viewport.width}x${viewport.height}.png`),
    });
    report.screenshots.push(`avatar-${viewport.width}x${viewport.height}.png`);
    await panel.getByRole('button', { name: '取消', exact: true }).click();
    await panel.getByRole('button', { name: '关闭面板', exact: true }).click();
  }
  await checked(
    'Avatar crop first-screen buttons at short portrait, landscape and computer viewports; modal top-layer orb',
  );
  for (const choice of [
    { gameId: 'modern-art' },
    { gameId: 'power-grid' },
    { gameId: 'pokemon-encounters', variantId: 'original' },
    { gameId: 'pokemon-encounters', variantId: 'expansion' },
  ]) {
    await command({ type: 'select-game', gameId: choice.gameId });
    if (choice.variantId)
      await command({ type: 'select-variant', variantId: choice.variantId });
    await player.goto(origin + '/player/game');
    await playerUi(player).locator('.interaction-orb').waitFor();
    await select(0);
    await playerUi(player).locator('.interaction-aim').waitFor();
    await playerUi(player)
      .locator('.interaction-aim')
      .getByRole('button', { name: '取消', exact: true })
      .click();
    assert.equal(await playerUi(player).locator('.interaction-aim').count(), 0);
  }
  await checked(
    'Shared /game interaction entry and aim cancellation across all three games and both Pokémon variants',
  );
  const media = [];
  async function scan(directory, prefix = '') {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + item.name;
      if (item.isDirectory())
        await scan(join(directory, item.name), path + '/');
      else if (/\.(flac|mp3)$/.test(path)) media.push('/' + path);
    }
  }
  await scan(resolve('build/desktop/web'));
  const decoded = await host.evaluate(async (urls) => {
    const audio = new AudioContext();
    try {
      return await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(url);
          const buffer = await audio.decodeAudioData(
            await response.arrayBuffer(),
          );
          return {
            url,
            duration: buffer.duration,
            channels: buffer.numberOfChannels,
          };
        }),
      );
    } finally {
      await audio.close();
    }
  }, media);
  assert.ok(decoded.filter((x) => x.url.endsWith('.flac')).length >= 40);
  assert.equal(decoded.filter((x) => x.url.endsWith('.mp3')).length, 11);
  assert.ok(decoded.every((x) => x.duration > 0));
  report.media = decoded;
  await checked(
    'All packaged game FLAC and eleven interaction MP3 decode offline in WebView2',
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.external, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  throw error;
} finally {
  playerSocket?.disconnect();
  socket?.disconnect();
  await browser?.close();
  await desktop?.close();
  await save();
}
