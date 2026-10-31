import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { launchTestBrowser } from '../support/browser-test.mjs';
const option = (name, fallback) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const taskId = option('task', 'rules-menu-optimize-20261031');
const evidence = option('evidence', 'uno-module-service-r3');
assert.match(taskId, /^[a-z0-9-]+$/);
assert.match(evidence, /^[a-z0-9-]+$/);
const task = path.resolve('tmp', taskId);
const work = path.join(task, evidence);
const out = path.resolve('artifacts/maintenance', taskId, evidence);
await assert.rejects(
  fs.access(path.join(out, 'report.json')),
  { code: 'ENOENT' },
  'Use a new --evidence; reports cannot be overwritten',
);
await fs.mkdir(work, { recursive: true });
await fs.mkdir(out, { recursive: true });
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TEMP = process.env.TMP = work;
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const report = {
  result: 'running',
  scope:
    'Actual createService HTTP + production built app and UNO dynamic module; no installer, native bridge or old-save restoration claim',
  checks: [],
  requests: [],
  errors: [],
};
const latest = JSON.parse(
  await fs.readFile('build/snapshots/latest.json', 'utf8'),
);
report.snapshot = latest;
const snapshot = JSON.parse(await fs.readFile(latest.snapshotPath, 'utf8'));
report.units = snapshot.units
  .filter((u) =>
    [
      'platform-runtime',
      'platform-box',
      'game-uno-web',
      'platform-server',
    ].includes(u.id),
  )
  .map((u) => ({ id: u.id, fingerprint: u.fingerprint }));
await fs.copyFile(
  'build/desktop/modules.json',
  path.join(work, 'modules.json'),
);
const entry = path.join(work, 'entry.ts');
await fs.writeFile(
  entry,
  `export {createService} from ${JSON.stringify(path.resolve('apps/server/src/service.ts'))};export {rules,bot} from ${JSON.stringify(path.resolve('games/uno/index.ts'))};`,
);
const built = await build({
  entryPoints: [entry],
  outfile: path.join(work, 'service.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  metafile: true,
  logLevel: 'silent',
});
report.inputs = await Promise.all(
  Object.keys(built.metafile.inputs)
    .filter(
      (f) => !f.includes('node_modules') && !path.resolve(f).startsWith(work),
    )
    .map(async (f) => ({ path: f, sha256: hash(await fs.readFile(f)) })),
);
const { createService, rules, bot } = createRequire(import.meta.url)(
  path.join(work, 'service.cjs'),
);
let service, browser;
try {
  service = await createService(
    {
      dataDir: path.join(work, 'data'),
      webDir: path.resolve('build/desktop/web'),
      host: '127.0.0.1',
      port: 0,
      playMode: 'test',
    },
    { rules, bot },
  );
  const origin = 'http://127.0.0.1:' + (await service.listen());
  const descriptorResponse = await fetch(origin + '/games/uno/web/module.json');
  assert.equal(descriptorResponse.status, 200);
  const descriptor = await descriptorResponse.json();
  assert.equal(descriptor.id, 'uno');
  report.module = descriptor;
  report.moduleSha256 = hash(
    await fs.readFile('build/desktop/web/games/uno/web/module.json'),
  );
  const entryResponse = await fetch(origin + descriptor.entries.web);
  assert.equal(entryResponse.status, 200);
  report.entrySha256 = hash(Buffer.from(await entryResponse.arrayBuffer()));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  await context.addInitScript(
    (token) => sessionStorage.setItem('tablemax-host', token),
    service.hostToken,
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.pathname.startsWith('/games/uno/web/'))
      report.requests.push({ path: url.pathname, status: r.status() });
  });
  await page.goto(origin + '/host');
  await page.getByRole('button', { name: '游戏设置', exact: true }).click();
  const stacking = page.getByRole('switch', { name: '补牌传递', exact: true });
  await stacking.waitFor();
  assert.equal(await stacking.getAttribute('aria-checked'), 'true');
  assert.equal(await stacking.isEnabled(), true);
  const delay = page.getByRole('slider', { name: '抓漏延迟', exact: true });
  assert.equal(await delay.inputValue(), '500');
  await page.screenshot({ path: path.join(work, 'host-before.png') });
  report.checks.push(
    'Host settings load through real production module descriptor and JS; default stacking on and delay 500ms',
  );
  await stacking.click();
  await delay.fill('0');
  await page.getByRole('button', { name: '应用开局设置', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="UNO 开局设置"] input[type="range"]')
        ?.value === '0',
  );
  const deadline = Date.now() + 5000;
  while (
    service.room.view(service.hostToken).game.setup.catchUnoDelayMs !== 0 &&
    Date.now() < deadline
  )
    await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(service.room.view(service.hostToken).game.setup, {
    drawPenaltyStacking: false,
    catchUnoDelayMs: 0,
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '游戏设置', exact: true }).click();
  assert.equal(await stacking.getAttribute('aria-checked'), 'false');
  assert.equal(await delay.inputValue(), '0');
  await page.screenshot({ path: path.join(work, 'host-saved.png') });
  report.checks.push(
    'Actual room command saves changed UNO setup; reopening reads authoritative values',
  );
  const joined = await service.app.inject({
    method: 'POST',
    url: '/api/session/join',
    payload: { name: '设置验证玩家' },
  });
  assert.equal(joined.statusCode, 200);
  const token = joined.json().token;
  const playerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await playerContext.addInitScript(
    (t) => localStorage.setItem('tablemax-player', t),
    token,
  );
  const player = await playerContext.newPage();
  await player.goto(origin + '/player');
  const playerUi = player.frameLocator('iframe[data-player-frame]');
  await playerUi.getByRole('button', { name: '游戏设置', exact: true }).click();
  const readonly = playerUi.getByRole('switch', {
    name: '补牌传递',
    exact: true,
  });
  await readonly.waitFor();
  assert.equal(await readonly.isDisabled(), true);
  assert.equal(
    await playerUi
      .getByRole('slider', { name: '抓漏延迟', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await readonly.getAttribute('aria-checked'), 'false');
  assert.equal(
    await playerUi
      .getByRole('button', { name: '应用开局设置', exact: true })
      .count(),
    0,
  );
  await player.screenshot({ path: path.join(work, 'player-readonly.png') });
  report.checks.push(
    'Unprivileged phone player loads same real module with current setup read-only and no apply action',
  );
  assert.ok(
    report.requests.some(
      (r) => r.path.endsWith('/module.json') && r.status === 200,
    ),
  );
  assert.ok(
    report.requests.some(
      (r) => r.path === descriptor.entries.web && r.status === 200,
    ),
  );
  assert.deepEqual(report.errors, []);
  report.result = 'passed';
} catch (e) {
  report.result = 'failed';
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await service?.close();
  await fs.writeFile(
    path.join(out, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks,
      failure: report.failure,
    }),
  );
}
