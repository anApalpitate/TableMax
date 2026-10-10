import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import {
  launchDesktop,
  desktopExecutable,
} from '../../support/desktop-test.mjs';

const require = createRequire(import.meta.url);
const run = promisify(execFile);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const name =
  process.argv.find((value) => value.startsWith('--evidence='))?.slice(11) ??
  'source';
assert.match(name, /^[a-z0-9-]{1,40}$/);
const executablePath = resolve(
  process.argv.find((value) => value.startsWith('--executable='))?.slice(13) ??
    desktopExecutable,
);
const zipArgument = process.argv
  .find((value) => value.startsWith('--zip='))
  ?.slice(6);
const zipPath = zipArgument ? resolve(zipArgument) : undefined;
const only = process.argv
  .find((value) => value.startsWith('--only='))
  ?.slice(7)
  .split(',');
const skipVerified = process.argv.includes('--skip-verified');
const navigationOnly = process.argv.includes('--navigation-only');
const audioOnly = process.argv.includes('--audio-only');
const budgetDiagnostic = process.argv.includes('--budget-diagnostic');
const budgetHoldMs = Number(
  process.argv
    .find((value) => value.startsWith('--budget-hold-ms='))
    ?.slice(17) ?? 20000,
);
assert.ok(
  Number.isInteger(budgetHoldMs) &&
    budgetHoldMs >= 10000 &&
    budgetHoldMs <= 60000,
);
const skipOpeningMatrix = process.argv.includes('--skip-opening-320-390');
const continueOpening = process.argv.includes('--continue-opening');
const rackSize = Number(
  process.argv.find((value) => value.startsWith('--rack-size='))?.slice(12) ??
    14,
);
assert.ok([14, 30].includes(rackSize));
assert.ok(
  !only ||
    only.every((value) =>
      ['opening', 'reorganization', 'finish', 'finish-final'].includes(value),
    ),
);
const output = resolve('artifacts/rummikub/validation/ui-preview', name);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/rummikub-ui-'));
const started = performance.now();
const evidence = {
  startedAt: new Date().toISOString(),
  executablePath,
  zipPath,
  zipSha256: zipPath
    ? createHash('sha256')
        .update(await readFile(zipPath))
        .digest('hex')
    : undefined,
  workDir: work,
  scope:
    'Unmodified built production desktop/service/React game routes, legal complete-tile SQLite fixtures, background WebView2 with touch viewport simulation. No physical phone or human audio-listening claim.',
  verifierSha256: createHash('sha256')
    .update(await readFile(new URL(import.meta.url)))
    .digest('hex'),
  executableSha256: createHash('sha256')
    .update(await readFile(executablePath))
    .digest('hex'),
  cases: [],
  screenshots: [],
  layouts: [],
  audio: [],
  memory: [],
  diagnostic: budgetDiagnostic
    ? {
        intervalMs: 2000,
        screenshots: false,
        samples: [],
        errors: [],
        stages: [],
      }
    : undefined,
  payloadMaxBytes: {},
  memoryScope:
    'CDP JS heap for each actual page including its player iframe, from the real box route to game rendering; native service private bytes and owned process-tree private bytes sampled at host-box baseline and fixture finish. Sampled differences include navigation garbage, extra windows/connections and warm service caches; the baseline already contains the game rules/state. Not allocation-profiler maxima or isolated game-only increments.',
  errors: [],
  externalRequests: [],
  failures: [],
};
await writeFile(
  join(output, 'verifier-start-source.mjs'),
  await readFile(new URL(import.meta.url)),
);

// Construct a legal saved scenario, then let the unmodified shipped rules load it.
// Credentials never enter the evidence report; the private database is isolated.
const generator = `
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RoomCoordinator } from ${JSON.stringify(resolve('packages/platform-core/src/room.ts'))};
import { SqliteSaveRepository } from ${JSON.stringify(resolve('apps/server/src/save-repository.ts'))};
import { rules } from ${JSON.stringify(resolve('games/rummikub/rules/index.ts'))};
import { bot } from ${JSON.stringify(resolve('games/rummikub/bot/index.ts'))};
import { TILES } from ${JSON.stringify(resolve('games/rummikub/data/catalog.ts'))};
import { parseMeld } from ${JSON.stringify(resolve('games/rummikub/shared/melds.ts'))};
import { scoreGame } from ${JSON.stringify(resolve('games/rummikub/rules/scoring.ts'))};
export async function prepare(id,dataDir,rackSize){
 const custom={...rules,initialize(context){
  const base=rules.initialize(context),seats=context.seats;
  const table=id==='opening'||id.startsWith('finish')?[parseMeld(['blue-03-a','blue-04-a','blue-05-a'])]:[
    parseMeld(['blue-03-a','joker-a','blue-05-a'],{'joker-a':{color:'blue',value:4}},'run'),
    parseMeld([3,4,5,6,7,8].map(n=>'red-0'+n+'-a')),
    parseMeld(['black-01-a','black-02-a','black-03-a']),
    parseMeld(['orange-01-a','orange-02-a','orange-03-a']),
    parseMeld(['orange-04-a','orange-05-a','orange-06-a']),
    parseMeld(['black-10-a','black-11-a','black-12-a']),
    parseMeld(['blue-10-a','blue-11-a','blue-12-a']),
    parseMeld(['red-10-a','red-11-a','red-12-a']),
    parseMeld(['black-04-a','black-05-a','black-06-a']),
  ];assert.ok(table.every(Boolean));
  const wanted=id.startsWith('finish')?['red','black'].flatMap(color=>Array.from({length:7},(_,i)=>color+'-0'+(i+1)+'-a')):id==='opening'?['red-10-a','red-11-a','red-12-a']:[
   'blue-04-a','black-09-a','red-09-a','red-09-b','black-13-a','orange-13-a','blue-13-a','red-13-a',
   'blue-01-a','blue-02-a','blue-06-a','orange-09-a','orange-10-a','orange-11-a'];
  const used=new Set([...table.flatMap(m=>m.tiles.map(p=>p.tileId)),...wanted]);
  const rest=TILES.map(t=>t.id).filter(tile=>!used.has(tile));
  const own=[...wanted,...rest.splice(0,rackSize-wanted.length)];
  const racks=Object.fromEntries(seats.map((seat,i)=>[seat,i===0?own:rest.splice(0,14)]));
  Object.assign(base,{table,pool:rest,racks,opened:Object.fromEntries(seats.map((seat,i)=>[seat,(id!=='opening'&&!id.startsWith('finish'))||i!==0])),
   turnSeat:seats[0],startSeat:seats[0],turnNumber:17,serial:16,
   latest:{serial:16,actor:seats[3],verb:'draw',text:'摸牌，结束回合。',placedTileIds:[]}});
  if(id==='finish-final'){
   const historicRacks={...racks,[seats[0]]:[]};
   base.gameNumber=4;
   base.results=[1,2,3].map(number=>scoreGame(seats,historicRacks,'empty-rack',number));
   base.wins=Object.fromEntries(seats.map(seat=>[seat,seat===seats[0]?3:0]));
   base.scores=Object.fromEntries(seats.map(seat=>[seat,base.results.reduce((sum,result)=>sum+result.scores[seat],0)]));
  }
  return rules.validateState(base,seats);
 }};
 const repo=new SqliteSaveRepository(dataDir),room=new RoomCoordinator(custom,bot,repo);
 const command=async(token,command)=>{const current=room.view(token);const reply=await room.command(token,{actionId:randomUUID(),instanceId:current.instanceId,revision:current.revision,branch:current.branch,command});assert.equal(reply.ok,true,JSON.stringify(reply));};
 const players=[];
 for(let i=0;i<4;i++){const player=await room.join(i===0?'拉密重组长昵称abcdefghijkl':'朋友 '+(i+1),undefined,'avatar-'+(20+i));players.push({...player,seatId:room.view(player.token).self.seatId});await command(player.token,{type:'ready',ready:true});}
 await command(room.hostToken,{type:'set-owner',seatId:players[0].seatId});
 await command(room.hostToken,{type:'start'});
 const saved=repo.load();rules.validateState(saved.snapshot.state,saved.seats.map(seat=>seat.id));repo.close();
 return players;
}
`;
await build({
  stdin: {
    contents: generator,
    sourcefile: 'rummikub-ui-fixture.ts',
    resolveDir: resolve('.'),
  },
  outfile: join(work, 'prepare.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { prepare } = require(join(work, 'prepare.cjs'));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(predicate, description, timeout = 20000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (await predicate()) return;
    await wait(40);
  }
  throw new Error(description);
}

for (const scenario of [
  'opening',
  'reorganization',
  'finish',
  'finish-final',
].filter((id) => !only || only.includes(id))) {
  const item = { id: scenario, checks: [], commands: [], layouts: [] };
  evidence.cases.push(item);
  const dataDir = join(work, scenario);
  await mkdir(dataDir);
  const players = await prepare(scenario, dataDir, rackSize);
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
  };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  delete env.TABLEMAX_WEB_DEV_URL;
  let desktop, origin, host, publicPage, phone, observer;
  let diagnosticTimer,
    diagnosticPending = Promise.resolve(),
    diagnosticBusy = false;
  let diagnosticStage = 'startup';
  const sockets = [],
    metrics = new Map();
  const observe = (page) => {
    page.setDefaultTimeout(12000);
    page.on('pageerror', (error) =>
      evidence.errors.push({ scenario, message: error.message }),
    );
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && url.origin !== origin)
        evidence.externalRequests.push(request.url());
    });
  };
  const view = async (token = '') => {
    const result = await (
      await fetch(origin + '/api/session/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(token ? { token } : {}),
      })
    ).json();
    assert.equal(result.ok, true);
    const role = !token
      ? 'public'
      : players.some((player) => player.token === token)
        ? 'player'
        : 'host';
    evidence.payloadMaxBytes[role] = Math.max(
      evidence.payloadMaxBytes[role] ?? 0,
      Buffer.byteLength(JSON.stringify(result.view), 'utf8'),
    );
    return result.view;
  };
  const connect = async (token) => {
    const socket = io(origin, {
      forceNew: true,
      transports: ['websocket'],
      auth: { token },
    });
    sockets.push(socket);
    await new Promise((done, reject) => {
      socket.once('room:view', done);
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const send = async (socket, token, command) => {
    const current = await view(token);
    const reply = await new Promise((done, reject) =>
      socket.timeout(10000).emit(
        'room:command',
        {
          actionId: randomUUID(),
          instanceId: current.instanceId,
          revision: current.revision,
          branch: current.branch,
          command,
        },
        (error, result) => (error ? reject(error) : done(result)),
      ),
    );
    item.commands.push({
      type: command.type,
      accepted: reply.ok,
      reason: reply.ok ? null : reply.reason,
    });
    assert.equal(reply.ok, true, JSON.stringify(reply));
    return reply;
  };
  // The real box deliberately keeps every player session inside a stable iframe.
  const surface = (page) =>
    page.frames().find((frame) => frame.parentFrame() === page.mainFrame()) ??
    page;
  const sampleMemory = async (page, label, role) => {
    let cdp = metrics.get(page);
    if (!cdp) {
      cdp = await page.context().newCDPSession(page);
      metrics.set(page, cdp);
    }
    const heap = await cdp.send('Runtime.getHeapUsage');
    await cdp.send('Performance.enable');
    const performanceMetrics = await cdp.send('Performance.getMetrics');
    const native = await desktop.request('runtime');
    evidence.memory.push({
      scenario,
      label,
      role,
      heap,
      performanceMetrics: performanceMetrics.metrics.filter((entry) =>
        ['JSHeapUsedSize', 'JSHeapTotalSize', 'Documents', 'Nodes'].includes(
          entry.name,
        ),
      ),
      servicePrivateBytes:
        (native.metrics?.find((entry) => entry.type === 'Utility')?.memory
          ?.privateBytes ?? 0) * 1024,
      desktopPid: native.desktopPid,
      windowId: await page.evaluate(() => window.__tablemaxWindowId),
    });
    if (
      role === 'host' &&
      ['box-before-game', 'fixture-finished'].includes(label)
    ) {
      try {
        const { stdout } = await run(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            '$ErrorActionPreference = [Management.Automation.ActionPreference]::Stop; $taskIds = [Collections.Generic.HashSet[int]]::new(); [void]$taskIds.Add([int]$env:TABLEMAX_RK_BUDGET_PID); $taskProcesses = @(Get-CimInstance Win32_Process); do { $taskChanged = $false; foreach ($taskProcess in $taskProcesses) { if ($taskIds.Contains([int]$taskProcess.ParentProcessId) -and $taskIds.Add([int]$taskProcess.ProcessId)) { $taskChanged = $true } } } while ($taskChanged); $taskBytes = 0L; foreach ($taskId in $taskIds) { try { $taskBytes += (Get-Process -Id $taskId -ErrorAction Stop).PrivateMemorySize64 } catch {} }; Write-Output $taskBytes',
          ],
          {
            windowsHide: true,
            env: {
              ...process.env,
              TABLEMAX_RK_BUDGET_PID: String(native.desktopPid),
            },
          },
        );
        evidence.memory.at(-1).ownedProcessTreePrivateBytes = Number(
          stdout.trim(),
        );
      } catch (error) {
        evidence.memory.at(-1).processPrivateSamplingError = error.message;
      }
    }
  };
  const resize = async (page, width, height, mobile = false) => {
    const native = await desktop.browserWindow(page);
    await native.evaluate(
      (window, size) => window.setContentSize(size.width, size.height),
      { width, height },
    );
    let cdp = metrics.get(page);
    if (!cdp) {
      cdp = await page.context().newCDPSession(page);
      metrics.set(page, cdp);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    if (mobile) {
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });
      await cdp.send('Emulation.setUserAgentOverride', {
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; vivo X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
        userAgentMetadata: {
          brands: [{ brand: 'Chromium', version: '130' }],
          platform: 'Android',
          platformVersion: '14',
          architecture: 'arm',
          model: 'vivo X200',
          mobile: true,
          bitness: '64',
          wow64: false,
        },
      });
    }
    const geometry = await native.evaluate((window) => ({
      content: window.getContentSize(),
      zoom: window.webContents.getZoomFactor(),
    }));
    await page.waitForFunction(
      (size) =>
        Math.abs(innerWidth - size.width / size.zoom) <= 2 &&
        Math.abs(innerHeight - size.height / size.zoom) <= 2,
      { width, height, zoom: geometry.zoom },
    );
    item.viewportGeometry ??= [];
    item.viewportGeometry.push({
      requested: { width, height, mobile },
      native: geometry,
      actual: await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpi: devicePixelRatio,
      })),
    });
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
  };
  const open = async (role, index = 0, stayOnBox = false) => {
    const next = desktop.waitForEvent('window');
    await desktop.evaluate(
      ({ BrowserWindow }, config) => {
        const window = new BrowserWindow({
          show: false,
          width: config.width,
          height: config.height,
          webPreferences: { partition: config.partition, offscreen: true },
        });
        void window.loadURL(config.url);
      },
      {
        width: role === 'public' ? 1920 : 390,
        height: role === 'public' ? 1080 : 844,
        partition: `rummikub-${scenario}-${role}-${index}`,
        url: `${origin}/${role}`,
      },
    );
    const page = await next;
    observe(page);
    if (role === 'player') {
      await resize(page, 390, 844, true);
      await page.evaluate((token) => {
        localStorage.setItem('tablemax-player', token);
        localStorage.setItem('tablemax-sound-muted', 'true');
      }, players[index].token);
    }
    await page.reload();
    if (role === 'player') {
      await page.locator('iframe[data-player-frame]').waitFor();
      await until(
        () => surface(page) !== page,
        'actual player iframe attaches',
      );
    }
    await surface(page).locator('.hero').waitFor();
    await sampleMemory(page, 'box-before-game', role);
    if (stayOnBox) return page;
    await page.goto(`${origin}/${role}/game`);
    if (role === 'player') {
      await page.locator('iframe[data-player-frame]').waitFor();
      await until(() => surface(page) !== page, 'game player iframe attaches');
    }
    try {
      await surface(page).locator('.rk-screen').waitFor();
    } catch (error) {
      item.openFailure = {
        role,
        path: new URL(page.url()).pathname,
        framePaths: page.frames().map((frame) => {
          try {
            return new URL(frame.url()).pathname;
          } catch {
            return frame.url();
          }
        }),
        body: (await surface(page).locator('body').innerText()).slice(0, 2000),
      };
      await capture(page, `open-failure-${role}-${index}`);
      throw error;
    }
    return page;
  };
  const capture = async (page, label) => {
    if (budgetDiagnostic) return;
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    const native = await desktop.browserWindow(page);
    const bytes = await native.evaluate(async (window) =>
      (await window.webContents.capturePage()).toPNG(),
    );
    const file = `${scenario}-${label}.png`;
    await writeFile(join(output, file), bytes);
    evidence.screenshots.push(file);
  };
  const measure = async (page, label, role) => {
    if (role === 'player') await moveInteractionOrb();
    const layout = await surface(page).evaluate(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.left < innerWidth &&
          rect.bottom > 0 &&
          rect.top < innerHeight &&
          style.clip.replaceAll(' ', '') !== 'rect(0px,0px,0px,0px)' &&
          style.clipPath !== 'inset(50%)' &&
          !element.closest('[hidden]')
        );
      };
      const roots = [...document.querySelectorAll('.rk-screen,.rk-rules')];
      const elements = [
        ...new Set(roots.flatMap((root) => [...root.querySelectorAll('*')])),
      ];
      const smallText = elements
        .filter(
          (element) =>
            visible(element) &&
            (element.matches('button,select,input') ||
              [...element.childNodes].some(
                (node) =>
                  node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
              )) &&
            parseFloat(getComputedStyle(element).fontSize) < 15.9,
        )
        .map((element) => ({
          className: String(element.className),
          text: element.textContent,
          fontSize: getComputedStyle(element).fontSize,
        }));
      const smallTargets = elements
        .filter(
          (element) =>
            element.matches('button,a,input,select') && visible(element),
        )
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent,
            width: rect.width,
            height: rect.height,
            className: String(element.className),
          };
        })
        .filter((rect) => rect.width < 43.9 || rect.height < 43.9);
      const dock = document.querySelector('.rk-action-dock');
      const modalOpen = Boolean(document.querySelector('dialog[open]'));
      const target = document.querySelector('[data-submit-turn]');
      const rect = target?.getBoundingClientRect();
      const top = rect
        ? document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          )
        : null;
      const headings = [
        ...document.querySelectorAll(
          '.rk-section-heading h2,.rk-meld-heading h3',
        ),
      ]
        .filter(visible)
        .map((element) => ({
          text: element.textContent,
          size: parseFloat(getComputedStyle(element).fontSize),
        }));
      return {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        smallText,
        smallTargets,
        headings,
        dockVisible:
          !dock || dock.getBoundingClientRect().bottom <= innerHeight + 1,
        submitFont: target
          ? parseFloat(getComputedStyle(target).fontSize)
          : null,
        submitUnobscured:
          modalOpen || !target || top === target || target.contains(top),
        tableCount: document.querySelectorAll('.rk-meld').length,
      };
    });
    item.layouts.push({ label, role, ...layout });
    evidence.layouts.push({ scenario, label, role, ...layout });
    assert.ok(
      layout.scrollWidth <= layout.width + 1,
      label + ': no document horizontal overflow',
    );
    assert.deepEqual(layout.smallText, [], label + ': information text >=16px');
    assert.deepEqual(
      layout.smallTargets,
      [],
      label + ': visible interactive targets >=44px',
    );
    assert.equal(layout.dockVisible, true, label + ': commit dock fits');
    assert.equal(
      layout.submitUnobscured,
      true,
      label + ': commit control hit-test',
    );
    if (layout.submitFont !== null)
      assert.ok(layout.submitFont >= 18, label + ': primary control >=18px');
    if (role !== 'player')
      assert.ok(
        layout.headings.every((heading) => heading.size >= 20),
        label + ': desktop section headings >=20px',
      );
    await sampleMemory(page, label, role);
    await capture(page, label);
  };
  const select = async (id, container = '') => {
    const target = surface(phone).locator(
      `${container} button[data-tile-id="${id}"]`,
    );
    assert.equal(
      await target.count(),
      1,
      'one selectable physical tile: ' + id,
    );
    await target.click();
  };
  const create = async (ids) => {
    for (const id of ids) await select(id);
    await surface(phone)
      .getByRole('button', { name: '建立新组', exact: true })
      .click();
  };
  const ownDraft = () =>
    surface(phone)
      .locator('[data-draft-table] .rk-meld-tiles [data-tile-id]')
      .evaluateAll((tiles) => tiles.map((tile) => tile.dataset.tileId).sort());
  const moveInteractionOrb = async () => {
    const ui = surface(phone);
    const orb = ui.locator('.interaction-orb');
    if (!(await orb.count())) return;
    const start = await orb.boundingBox();
    const avatar = (await ui.locator('.rk-turn-identity img').count())
      ? await ui.locator('.rk-turn-identity img').boundingBox()
      : null;
    const heading =
      !avatar && (await ui.locator('.rk-results h1').count())
        ? await ui.locator('.rk-results h1').boundingBox()
        : null;
    const brand =
      !avatar && !heading && (await ui.locator('.rk-brand').count())
        ? await ui.locator('.rk-brand').boundingBox()
        : null;
    if (!start || (!avatar && !heading && !brand)) return;
    const target = avatar
      ? { x: avatar.x + avatar.width / 2, y: avatar.y + avatar.height / 2 }
      : heading
        ? {
            x: heading.x + heading.width - 28,
            y: heading.y + heading.height / 2,
          }
        : { x: brand.x + brand.width / 2, y: brand.y + brand.height / 2 };
    // Use the shipped user drag gesture. The noninteractive avatar provides a
    // temporary test location; do not hide or rewrite the shared interaction UI.
    await phone.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await phone.mouse.down();
    await phone.mouse.move(target.x, target.y, { steps: 5 });
    await phone.mouse.up();
    item.interactionOrbAvoidance =
      'Shipped user drag moved the draggable interaction orb onto the noninteractive turn avatar, empty result-heading edge or toolbar brand before access checks; the original default-position obstruction is preserved in preview-06.';
  };
  const auditNavigation = async () => {
    const ui = () => surface(phone);
    const tableButton = () =>
      ui()
        .locator('.rk-section-nav')
        .getByRole('button', { name: '桌面', exact: true });
    const rackButton = () =>
      ui()
        .locator('.rk-section-nav')
        .getByRole('button', { name: `牌架 ${rackSize}`, exact: true });
    const usable = (element) => {
      const rect = element.getBoundingClientRect();
      const footer = document
        .querySelector('.rk-action-dock')
        .getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      return {
        top: rect.top,
        bottom: rect.bottom,
        footerTop: footer.top,
        width: rect.width,
        height: rect.height,
        reachable:
          rect.top >= 0 &&
          rect.bottom <= footer.top + 1 &&
          (top === element || element.contains(top)),
      };
    };
    await resize(phone, 390, 640, true);
    assert.equal(
      await tableButton().getAttribute('aria-pressed'),
      'true',
      'initial table viewport is selected',
    );
    await capture(phone, `rack-${rackSize}-initial-table`);
    for (const [width, height] of budgetDiagnostic
      ? [[390, 640]]
      : [
          [320, 568],
          [390, 640],
          [430, 700],
          [844, 390],
        ]) {
      await resize(phone, width, height, true);
      await moveInteractionOrb();
      await rackButton().click();
      await until(
        async () =>
          (await rackButton().getAttribute('aria-pressed')) === 'true',
        'visible rack is selected',
      );
      const sort = ui().getByRole('combobox', {
        name: '牌架排序',
        exact: true,
      });
      assert.ok(
        await sort.evaluate(
          (element) => parseFloat(getComputedStyle(element).fontSize) >= 16,
        ),
        'visible sort information >=16px',
      );
      assert.equal(
        (await sort.evaluate(usable)).reachable,
        true,
        'rack sort unobscured',
      );
      await sort.selectOption('value');
      await capture(phone, `rack-${rackSize}-${width}x${height}-start`);
      const cards = ui().locator('[data-own-rack] button[data-tile-id]');
      assert.equal(await cards.count(), rackSize);
      const indices =
        width === 390 &&
        !(skipVerified && scenario === 'opening' && rackSize === 14)
          ? Array.from({ length: rackSize }, (_, index) => index)
          : [0, rackSize - 1];
      for (const index of indices) {
        const card = cards.nth(index);
        await card.evaluate((element) =>
          element.scrollIntoView({
            block: 'end',
            inline: 'nearest',
            behavior: 'instant',
          }),
        );
        const hit = await card.evaluate(usable);
        assert.equal(
          hit.reachable,
          true,
          `rack card ${index + 1}/${rackSize} unobscured: ${JSON.stringify(hit)}`,
        );
      }
      await capture(phone, `rack-${rackSize}-${width}x${height}-end`);
      await tableButton().click();
      await until(
        async () =>
          (await tableButton().getAttribute('aria-pressed')) === 'true',
        'visible table is selected',
      );
      await capture(phone, `rack-${rackSize}-${width}x${height}-table`);
    }
    item.checks.push(
      budgetDiagnostic
        ? `Diagnostic fixed 390px ${rackSize}-tile rack: table/rack jump, sorting and every tile are reachable above the commit dock; no other viewport is exercised in this mode.`
        : `Actual ${rackSize}-tile rack: table/rack jump follows the visible target, sorting and every tile are reachable above the commit dock at 390px; first/last tiles also reach 320px and short landscape.`,
    );
  };
  const auditAudio = async () => {
    const audioFiles = (
      await readdir(
        join(resolve(executablePath, '..'), 'web/games/rummikub/web/assets'),
      )
    ).filter((file) => /^(place|draw|win)-v1-.*\.wav$/.test(file));
    assert.equal(audioFiles.length, 3);
    const decoded = await publicPage.evaluate(async (files) => {
      const context = new AudioContext();
      try {
        return await Promise.all(
          files.map(async (file) => {
            const response = await fetch('/games/rummikub/web/assets/' + file);
            const buffer = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            const samples = buffer.getChannelData(0);
            let peak = 0,
              energy = 0;
            for (const sample of samples) {
              peak = Math.max(peak, Math.abs(sample));
              energy += sample * sample;
            }
            return {
              file,
              seconds: buffer.duration,
              channels: buffer.numberOfChannels,
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
      decoded.every(
        (cue) =>
          cue.seconds >= 0.19 &&
          cue.seconds < 0.9 &&
          cue.channels === 1 &&
          cue.peak > 0.02 &&
          cue.rms > 0.003,
      ),
    );
    evidence.audio.push(...decoded);
    item.checks.push(
      'Three packaged local PCM cues decode in the actual browser; verification remains physically muted and does not claim human listening.',
    );
  };
  const diagnosticSample = async () => {
    const at = Date.now();
    const stage = diagnosticStage;
    const runtime = await desktop.request('runtime');
    const windows = await desktop.request('windows');
    const renderers = [];
    for (const [role, page] of [
      ['host', host],
      ['public', publicPage],
      ['player', phone],
    ]) {
      if (!page || page.isClosed()) continue;
      let cdp = metrics.get(page);
      if (!cdp) {
        cdp = await page.context().newCDPSession(page);
        metrics.set(page, cdp);
      }
      const heap = await cdp.send('Runtime.getHeapUsage');
      const geometry = await page.evaluate(() => ({
        windowId: window.__tablemaxWindowId,
        cssWidth: innerWidth,
        cssHeight: innerHeight,
        dpi: devicePixelRatio,
        frames: [...document.querySelectorAll('iframe')].map((frame) => {
          try {
            return new URL(frame.src).pathname;
          } catch {
            return '';
          }
        }),
      }));
      renderers.push({
        role,
        path: new URL(page.url()).pathname,
        heap,
        ...geometry,
        native: windows.find((window) => window.id === geometry.windowId),
      });
    }
    const { stdout } = await run(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "$ErrorActionPreference = [Management.Automation.ActionPreference]::Stop; $taskIds = [Collections.Generic.HashSet[int]]::new(); [void]$taskIds.Add([int]$env:TABLEMAX_RK_BUDGET_PID); $taskProcesses = @(Get-CimInstance Win32_Process); do { $taskChanged = $false; foreach ($taskProcess in $taskProcesses) { if ($taskIds.Contains([int]$taskProcess.ParentProcessId) -and $taskIds.Add([int]$taskProcess.ProcessId)) { $taskChanged = $true } } } while ($taskChanged); $taskOwned = @(); foreach ($taskProcess in $taskProcesses) { if ($taskIds.Contains([int]$taskProcess.ProcessId)) { try { $taskMemory = Get-Process -Id $taskProcess.ProcessId -ErrorAction Stop; $taskOwned += [pscustomobject]@{pid=[int]$taskProcess.ProcessId;parentPid=[int]$taskProcess.ParentProcessId;name=$taskProcess.Name;processType=$(if ($taskProcess.CommandLine -match '(?:^|\\s)--type=([^\\s]+)') { $Matches[1] } else { 'root-or-browser' });privateBytes=$taskMemory.PrivateMemorySize64;workingSetBytes=$taskMemory.WorkingSet64} } catch {} } }; ConvertTo-Json -InputObject $taskOwned -Compress",
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          TABLEMAX_RK_BUDGET_PID: String(runtime.desktopPid),
        },
      },
    );
    const processes = JSON.parse(stdout.trim());
    evidence.diagnostic.samples.push({
      scenario,
      at,
      stage,
      renderers,
      desktopPid: runtime.desktopPid,
      processes,
      privateBytes: processes.reduce(
        (sum, process) => sum + process.privateBytes,
        0,
      ),
      servicePrivateBytes:
        (runtime.metrics?.find((metric) => metric.type === 'Utility')?.memory
          ?.privateBytes ?? 0) * 1024,
    });
  };
  const diagnosticPoint = async (stage) => {
    await diagnosticPending;
    diagnosticBusy = true;
    diagnosticStage = stage;
    evidence.diagnostic.stages.push({ scenario, at: Date.now(), stage });
    try {
      await diagnosticSample();
    } finally {
      diagnosticBusy = false;
    }
  };
  const diagnosticHold = async (stage) => {
    await diagnosticPoint(stage);
    const deadline = performance.now() + budgetHoldMs;
    while (performance.now() < deadline)
      await wait(Math.min(1000, deadline - performance.now()));
    await diagnosticPoint(stage + '-end');
  };
  const diagnosticGc = async (stage) => {
    await diagnosticPoint(stage + '-before-forced-gc');
    for (const page of [host, publicPage, phone]) {
      const cdp = metrics.get(page);
      await cdp.send('HeapProfiler.enable');
      await cdp.send('HeapProfiler.collectGarbage');
    }
    await diagnosticPoint(stage + '-after-forced-gc');
  };
  try {
    desktop = await launchDesktop({
      executablePath,
      args: ['--foundation-test', '--tablemax-test-mode'],
      env,
    });
    host = await desktop.firstWindow();
    await host.waitForURL('**/host');
    origin = new URL(host.url()).origin;
    observe(host);
    const hostToken = await host.evaluate(() =>
      sessionStorage.getItem('tablemax-host'),
    );
    assert.ok(hostToken);
    const hostSocket = await connect(hostToken);
    const privateStart = await view(players[0].token);
    assert.equal(privateStart.game.id, 'rummikub');
    assert.equal(privateStart.paused, true);
    assert.equal((await view()).gameView.self, null);
    assert.equal((await view(hostToken)).gameView.self, null);
    await host.locator('img[alt="拉密游戏封面"]').waitFor();
    await host
      .locator('img[alt="拉密游戏封面"]')
      .evaluate((image) => image.decode());
    assert.equal(
      await host
        .locator('img[alt="拉密游戏封面"]')
        .evaluate(
          (image) =>
            image.complete &&
            image.naturalWidth === 640 &&
            image.naturalHeight === 400,
        ),
      true,
    );
    await capture(host, 'box-game-cover');
    await sampleMemory(host, 'box-before-game', 'host');
    if (budgetDiagnostic) {
      publicPage = await open('public', 0, true);
      phone = await open('player', 0, true);
      await resize(host, 3840, 2160);
      await resize(publicPage, 3840, 2160);
      await resize(phone, 390, 640, true);
      diagnosticTimer = setInterval(() => {
        if (diagnosticBusy) return;
        diagnosticBusy = true;
        diagnosticPending = diagnosticSample()
          .catch((error) =>
            evidence.diagnostic.errors.push({
              scenario,
              stage: diagnosticStage,
              message: error.message,
            }),
          )
          .finally(() => {
            diagnosticBusy = false;
          });
      }, 2000);
      await diagnosticHold('three-existing-boxes-natural-baseline');
      for (const [role, page] of [
        ['host', host],
        ['public', publicPage],
        ['player', phone],
      ]) {
        diagnosticStage = 'enter-game-' + role;
        await surface(page)
          .getByRole('link', { name: '进入牌桌', exact: true })
          .click();
        await page.waitForURL(`${origin}/${role}/game`);
        if (role === 'player') {
          await page.locator('iframe[data-player-frame]').waitFor();
          await until(
            () => surface(page) !== page,
            'diagnostic player iframe attaches',
          );
        }
        await surface(page).locator('.rk-screen').waitFor();
      }
      await send(hostSocket, hostToken, { type: 'resume' });
      await diagnosticHold('fixed-4k-three-roles-natural-game');
      diagnosticStage = 'normal-touch-rack-navigation';
      if (!scenario.startsWith('finish')) await auditNavigation();
      await resize(phone, 390, 640, true);
      await moveInteractionOrb();
      diagnosticStage = 'normal-draft-and-save';
      if (scenario.startsWith('finish')) {
        assert.equal(
          rackSize,
          14,
          'result diagnostic uses the complete 14-tile winning fixture',
        );
        for (const color of ['red', 'black'])
          await create(
            Array.from({ length: 7 }, (_, i) => `${color}-0${i + 1}-a`),
          );
      } else if (scenario === 'opening') {
        await create(['red-10-a', 'red-11-a', 'red-12-a']);
      } else {
        await create(['black-13-a', 'orange-13-a', 'blue-13-a']);
      }
      const startRevision = (await view(players[0].token)).revision;
      await surface(phone).locator('[data-submit-turn]').click();
      await until(
        async () => (await view(players[0].token)).revision > startRevision,
        'diagnostic actual turn saves',
      );
      await diagnosticHold(
        scenario.startsWith('finish')
          ? 'fixed-4k-three-roles-natural-result'
          : 'fixed-4k-three-roles-natural-saved-turn',
      );
      await diagnosticGc('fixed-4k-game-retained');
      for (const [role, page] of [
        ['host', host],
        ['public', publicPage],
        ['player', phone],
      ]) {
        diagnosticStage = 'return-to-box-' + role;
        if (role === 'player') await moveInteractionOrb();
        await surface(page).locator('a.rk-box-link').click();
        await page.waitForURL(`${origin}/${role}`);
        if (role === 'player') {
          await page.locator('iframe[data-player-frame]').waitFor();
          await until(
            () => surface(page) !== page,
            'diagnostic box player iframe attaches',
          );
        }
        await surface(page).locator('.hero').waitFor();
      }
      await diagnosticHold('three-existing-boxes-after-game');
      await diagnosticGc('three-existing-boxes-retained');
      const samples = evidence.diagnostic.samples.filter(
        (sample) => sample.scenario === scenario,
      );
      const natural = samples.filter(
        (sample) =>
          !sample.stage.includes('forced-gc') &&
          !sample.stage.includes('retained'),
      );
      const hostBaseline = evidence.memory.find(
        (sample) =>
          sample.scenario === scenario &&
          sample.role === 'host' &&
          sample.label === 'box-before-game',
      )?.ownedProcessTreePrivateBytes;
      const boxBaseline = samples.find(
        (sample) =>
          sample.stage === 'three-existing-boxes-natural-baseline-end',
      );
      const retainedGame = samples.find(
        (sample) => sample.stage === 'fixed-4k-game-retained-after-forced-gc',
      );
      const retainedBox = samples.find(
        (sample) =>
          sample.stage === 'three-existing-boxes-retained-after-forced-gc',
      );
      const limits = JSON.parse(
        await readFile(resolve('games/rummikub/game-module.json'), 'utf8'),
      ).budgets;
      const heapPeakByRole = Object.fromEntries(
        ['host', 'public', 'player'].map((role) => [
          role,
          Math.max(
            ...natural.flatMap((sample) =>
              sample.renderers
                .filter((renderer) => renderer.role === role)
                .map((renderer) => renderer.heap.usedSize),
            ),
          ),
        ]),
      );
      const privatePeak = Math.max(
        ...natural.map((sample) => sample.privateBytes),
      );
      const warnings = [];
      for (const [role, actual] of Object.entries(heapPeakByRole)) {
        const limit =
          role === 'player' ? limits.phoneHeapBytes : limits.desktopHeapBytes;
        if (actual > limit)
          warnings.push({ metric: role + '-natural-js-heap', actual, limit });
      }
      if (
        Number.isFinite(hostBaseline) &&
        privatePeak - hostBaseline > limits.privateIncrementBytes
      )
        warnings.push({
          metric: 'natural-private-increment-from-host-only-box',
          actual: privatePeak - hostBaseline,
          limit: limits.privateIncrementBytes,
        });
      item.diagnostic = {
        result: warnings.length
          ? 'warnings-retained'
          : 'within-current-sampled-limits',
        limits,
        heapPeakByRole,
        naturalPrivatePeakBytes: privatePeak,
        hostOnlyBoxBaselineBytes: hostBaseline,
        naturalPrivateIncrementFromHostOnlyBox: Number.isFinite(hostBaseline)
          ? privatePeak - hostBaseline
          : null,
        threeExistingBoxesBaselineBytes: boxBaseline?.privateBytes,
        naturalPrivateIncrementFromThreeExistingBoxes: boxBaseline
          ? privatePeak - boxBaseline.privateBytes
          : null,
        retainedGamePrivateBytes: retainedGame?.privateBytes,
        retainedBoxPrivateBytes: retainedBox?.privateBytes,
        retainedPrivateDifferenceSameWindows:
          retainedGame && retainedBox
            ? retainedGame.privateBytes - retainedBox.privateBytes
            : null,
        warnings,
        policy:
          'Natural absolute heaps and host-only private increment remain the original warning checks. Same-three-window and forced-GC bounds are diagnosis only and do not replace or waive them.',
      };
      item.checks.push(
        'No-screenshot diagnostic: three existing fixed-geometry box baseline, unchanged shipped game with actual legal private rack/touch actions/save, natural 2-second heap/private samples, then paired forced-GC retained game and same-window box bounds. Natural peaks are preserved and are not waived by GC.',
      );
      assert.deepEqual(
        evidence.diagnostic.errors,
        [],
        'Diagnostic sampling errors',
      );
      assert.deepEqual(evidence.errors, [], 'No production page errors');
      assert.deepEqual(
        evidence.externalRequests,
        [],
        'All runtime requests stay local',
      );
      item.result = 'passed';
      continue;
    }
    await host.goto(origin + '/host/game');
    await host.locator('.rk-screen').waitFor();
    publicPage = await open('public');
    phone = await open('player');
    if (!skipVerified) observer = await open('player', 1);
    assert.equal(
      (await view(players[1].token)).gameView.self.seatId,
      players[1].seatId,
    );
    const privateIds = privateStart.gameView.self.rack.map((tile) => tile.id);
    if (!skipVerified)
      for (const page of [host, publicPage]) {
        assert.equal(await surface(page).locator('[data-own-rack]').count(), 0);
        const displayed = await surface(page)
          .locator('[data-tile-id]')
          .evaluateAll((tiles) => tiles.map((tile) => tile.dataset.tileId));
        assert.ok(
          privateIds.every((id) => !displayed.includes(id)),
          'public/host do not render private rack IDs',
        );
      }
    if (!skipVerified)
      assert.equal(
        await surface(observer).locator('[data-turn-workshop]').count(),
        0,
      );
    await send(hostSocket, hostToken, { type: 'resume' });
    await until(
      () =>
        surface(phone)
          .locator('[data-submit-turn]')
          .isDisabled()
          .then(() => surface(phone).locator('.rk-notice').count())
          .then((count) => count === 0),
      'phone resumes',
    );
    if (!skipVerified)
      item.checks.push(
        'Actual host/public private projection is null, racks not rendered; other player sees only own rack and has no turn controls.',
      );

    if (audioOnly) {
      await auditAudio();
      assert.deepEqual(evidence.errors, [], 'No production page errors');
      assert.deepEqual(
        evidence.externalRequests,
        [],
        'All runtime requests stay local',
      );
      item.result = 'passed';
      continue;
    }
    await moveInteractionOrb();
    if (
      !scenario.startsWith('finish') &&
      !(continueOpening && scenario === 'opening')
    )
      await auditNavigation();
    if (navigationOnly) {
      item.result = 'passed';
      continue;
    }
    if (scenario.startsWith('finish')) {
      for (const color of ['red', 'black'])
        await create(
          Array.from({ length: 7 }, (_, index) => `${color}-0${index + 1}-a`),
        );
      await resize(phone, 390, 640, true);
      assert.equal(
        await surface(phone).locator('[data-submit-turn]').isEnabled(),
        true,
      );
      await surface(phone).locator('[data-submit-turn]').click();
      const phase = scenario === 'finish' ? 'game-result' : 'ended';
      await until(
        async () => (await view(players[0].token)).gameView.phase === phase,
        'real empty-rack result saves',
      );
      const result = await view(players[0].token);
      assert.equal(result.gameView.self.rack.length, 0);
      assert.equal(result.gameView.results.at(-1).reason, 'empty-rack');
      assert.deepEqual(result.gameView.results.at(-1).winners, [
        players[0].seatId,
      ]);
      const actionName =
        scenario === 'finish' ? '开始下一局' : '原班人马再玩一场';
      for (const [page, role, width, height] of [
        [host, 'host', 1280, 720],
        [publicPage, 'public', 1920, 1080],
        [phone, 'player', 390, 640],
      ]) {
        await resize(page, width, height, role === 'player');
        await surface(page).locator('.rk-results').waitFor();
        assert.equal(await surface(page).locator('.rk-result').count(), 4);
        assert.equal(
          await surface(page)
            .getByRole('button', { name: actionName, exact: true })
            .count(),
          role === 'public' ? 0 : 1,
        );
        await measure(page, `${phase}-${role}`, role);
      }
      await host.getByRole('button', { name: actionName, exact: true }).click();
      if (scenario === 'finish') {
        await until(
          async () => (await view(players[0].token)).gameView.gameNumber === 2,
          'actual next-game lifecycle saves',
        );
        assert.equal((await view(players[0].token)).gameView.phase, 'playing');
        assert.equal(
          (await view(players[0].token)).gameView.self.rack.length,
          14,
        );
        await surface(phone).locator('[data-own-rack]').waitFor();
        await capture(phone, 'next-game-private-rack');
      } else {
        await until(
          async () =>
            (await view(players[0].token)).instanceId !== result.instanceId,
          'actual authorized replay saves new instance',
        );
        const replay = await view(players[0].token);
        assert.equal(replay.status, 'lobby');
        assert.equal(replay.self.seatId, result.self.seatId);
        assert.equal(replay.ownerSeatId, result.ownerSeatId);
        await host.waitForURL('**/host');
        await capture(host, 'replay-same-seats');
      }
      item.checks.push(
        `Actual 14-tile legal initial meld clears rack, shows ${phase} scores on three production roles; only host/authorized owner has ${actionName}, its real saved command preserves seats.`,
      );
      assert.deepEqual(evidence.errors, []);
      assert.deepEqual(evidence.externalRequests, []);
      item.result = 'passed';
      continue;
    }

    const baseline = await ownDraft();
    if (!skipVerified) {
      const testTile = scenario === 'opening' ? 'red-10-a' : 'blue-04-a';
      await create([testTile]);
      assert.equal(
        await surface(phone).locator('[data-submit-turn]').isDisabled(),
        true,
      );
      await surface(phone)
        .getByRole('button', { name: '撤销', exact: true })
        .click();
      assert.deepEqual(await ownDraft(), baseline);
      await create([testTile]);
      await surface(phone)
        .getByRole('button', { name: '重置', exact: true })
        .click();
      assert.deepEqual(await ownDraft(), baseline);
      await surface(phone)
        .getByRole('button', { name: '撤销', exact: true })
        .click();
      assert.ok((await ownDraft()).includes(testTile));
      await surface(phone)
        .getByRole('button', { name: '重置', exact: true })
        .click();
      item.checks.push(
        'Incomplete group disables submit; undo/reset preserve physical IDs and reset can be undone.',
      );
    }

    if (scenario === 'opening') {
      if (!skipVerified)
        assert.equal(
          await surface(phone)
            .locator('[data-group-id="saved-0"] button[data-tile-id]')
            .count(),
          0,
          'initial table is readonly during first meld',
        );
      await create(['red-10-a', 'red-11-a', 'red-12-a']);
      assert.match(
        await surface(phone).locator('[data-turn-preview]').innerText(),
        /33/,
      );
    } else {
      await select('blue-04-a', '[data-own-rack]');
      await surface(phone)
        .locator('[data-group-id="saved-0"]')
        .getByRole('button', { name: '放到末尾', exact: true })
        .click();
      await select('joker-a', '[data-draft-table]');
      await surface(phone)
        .getByRole('button', { name: '更多', exact: true })
        .click();
      await surface(phone)
        .getByRole('dialog')
        .getByRole('button', { name: '移入暂持区', exact: true })
        .click();
      await select('joker-a', '.rk-tray');
      await surface(phone)
        .getByRole('button', { name: '更多', exact: true })
        .click();
      await surface(phone)
        .getByRole('dialog')
        .getByRole('button', { name: '指定百搭颜色数字', exact: true })
        .click();
      const binding = surface(phone).getByRole('dialog');
      await binding.getByRole('button', { name: '橙色', exact: true }).click();
      await binding.getByRole('spinbutton').fill('9');
      await capture(phone, 'joker-binding');
      await binding
        .getByRole('button', { name: '确定百搭', exact: true })
        .click();
      await select('black-09-a', '[data-own-rack]');
      await select('red-09-a', '[data-own-rack]');
      await surface(phone)
        .getByRole('button', { name: '建立新组', exact: true })
        .click();
      await select('red-06-a', '[data-draft-table]');
      const split = surface(phone).locator('[data-group-id="saved-1"]');
      await split
        .getByRole('button', { name: '第 2 组操作', exact: true })
        .click();
      await split
        .getByRole('button', { name: '从选中牌拆分', exact: true })
        .click();
      await select('red-09-b', '[data-own-rack]');
      await surface(phone)
        .locator('.rk-meld')
        .filter({ has: surface(phone).locator('[data-tile-id="red-06-a"]') })
        .getByRole('button', { name: '放到末尾', exact: true })
        .click();
      assert.equal(await surface(phone).locator('.rk-tray').count(), 0);
      item.checks.push(
        'Real controls replace/rebind/reuse a table joker, split a long run and add own tile, without touching another player rack.',
      );
    }
    assert.equal(
      await surface(phone).locator('[data-submit-turn]').isEnabled(),
      true,
    );
    const draftIds = await ownDraft();
    const originalPublic = (await view()).gameView.table;
    assert.deepEqual(
      originalPublic,
      privateStart.gameView.table,
      'draft has not published',
    );
    const beforeSettings = await view(players[0].token);
    if (!skipVerified) {
      await send(hostSocket, hostToken, { type: 'set-countdown', seconds: 30 });
      await until(
        async () =>
          (await view(players[0].token)).revision > beforeSettings.revision,
        'independent settings saved',
      );
      assert.deepEqual(
        await ownDraft(),
        draftIds,
        'unrelated settings sync preserves draft',
      );
      await phone.reload();
      await phone.locator('iframe[data-player-frame]').waitFor();
      await until(
        () => surface(phone) !== phone,
        'reloaded player iframe attaches',
      );
      await surface(phone).locator('[data-turn-workshop]').waitFor();
      assert.deepEqual(
        await ownDraft(),
        draftIds,
        'refresh restores private draft',
      );
    }
    const beforeGuide = await view(players[0].token);
    await surface(phone)
      .getByRole('button', { name: '规则', exact: true })
      .click();
    assert.equal(
      await surface(phone)
        .locator('.rk-rules .rules-guide__chapters > section')
        .count(),
      6,
    );
    assert.match(
      await surface(phone).locator('.rk-rules').innerText(),
      /每局重新抽数字比最高定先手/,
    );
    assert.doesNotMatch(
      await surface(phone).locator('.rk-rules').innerText(),
      /各人轮流作为首位玩家/,
    );
    await surface(phone)
      .getByRole('button', { name: '关闭面板', exact: true })
      .click();
    assert.deepEqual(await ownDraft(), draftIds);
    assert.equal((await view(players[0].token)).revision, beforeGuide.revision);
    item.checks.push(
      skipVerified
        ? 'Updated six-chapter illustrated guide shows per-game highest-number starter rule; read-only guide keeps the draft and does not revise the game.'
        : 'Unrelated setting sync, reload and illustrated-rules open/close preserve private draft and seat; read-only guide does not revise the game.',
    );

    for (const [width, height] of continueOpening && scenario === 'opening'
      ? []
      : [
          ...(skipOpeningMatrix && scenario === 'opening'
            ? []
            : [
                [320, 568],
                [390, 640],
              ]),
          [430, 700],
          [844, 390],
        ]) {
      await resize(phone, width, height, true);
      await measure(phone, `player-${width}x${height}`, 'player');
      await surface(phone)
        .getByRole('button', { name: '规则', exact: true })
        .click();
      await measure(phone, `rules-player-${width}x${height}`, 'player');
      await surface(phone)
        .getByRole('button', { name: '关闭面板', exact: true })
        .click();
      assert.deepEqual(await ownDraft(), draftIds);
    }
    // Exercise the actual desktop-player display switch, keeping the same
    // iframe/session and private draft through portrait/wide presentation.
    if (!(continueOpening && scenario === 'opening')) {
      const playerCdp = metrics.get(phone);
      await playerCdp.send('Emulation.setUserAgentOverride', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        userAgentMetadata: {
          brands: [{ brand: 'Chromium', version: '130' }],
          platform: 'Windows',
          platformVersion: '10.0.0',
          architecture: 'x86',
          model: '',
          mobile: false,
          bitness: '64',
          wow64: false,
        },
      });
      await resize(phone, 1280, 720);
      await phone.reload();
      await phone.locator('iframe[data-player-frame]').waitFor();
      await until(
        () => surface(phone) !== phone,
        'desktop player iframe attaches',
      );
      await surface(phone).locator('[data-turn-workshop]').waitFor();
      assert.deepEqual(await ownDraft(), draftIds);
      const display = phone.locator('.player-frame__display');
      await display.waitFor();
      await measure(phone, 'player-desktop-portrait-1280x720', 'player');
      await display.click();
      await until(
        () =>
          surface(phone).evaluate(
            () => document.documentElement.dataset.playerDisplay === 'wide',
          ),
        'wide player presentation applied',
      );
      assert.deepEqual(await ownDraft(), draftIds);
      await measure(phone, 'player-desktop-wide-1280x720', 'player');
      await resize(phone, 3840, 2160);
      assert.deepEqual(await ownDraft(), draftIds);
      await measure(phone, 'player-desktop-wide-3840x2160', 'player');
      item.checks.push(
        'Actual desktop-player portrait/wide switch and 4K resizing keep the same authorized private draft.',
      );
    }
    for (const page of [host, publicPage])
      for (const [width, height] of continueOpening &&
      scenario === 'opening' &&
      page === host
        ? [[3840, 2160]]
        : [
            [1280, 720],
            [1920, 1080],
            [3840, 2160],
          ]) {
        const role = page === host ? 'host' : 'public';
        await resize(page, width, height);
        await measure(page, `${role}-${width}x${height}`, role);
        if (width !== 1920) {
          await page.getByRole('button', { name: '规则', exact: true }).click();
          await measure(page, `rules-${role}-${width}x${height}`, role);
          await page
            .getByRole('button', { name: '关闭面板', exact: true })
            .click();
        }
      }
    await resize(phone, 390, 640, true);
    await surface(phone)
      .getByRole('button', { name: '菜单', exact: true })
      .click();
    const menu = surface(phone).getByRole('dialog');
    assert.equal(
      await menu.getByRole('button', { name: '视频设置', exact: true }).count(),
      1,
    );
    await menu.getByRole('button', { name: '视频设置', exact: true }).click();
    assert.match(
      await surface(phone).getByRole('dialog').last().innerText(),
      /互动/,
    );
    await surface(phone)
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: '关闭面板', exact: true })
      .click();
    await surface(phone)
      .getByRole('dialog')
      .getByRole('button', { name: '关闭面板', exact: true })
      .click();
    assert.deepEqual(await ownDraft(), draftIds);

    const beforeSubmit = await view(players[0].token);
    await surface(phone).locator('[data-submit-turn]').click();
    await until(
      async () =>
        (await view(players[0].token)).gameView.turnNumber >
        beforeSubmit.gameView.turnNumber,
      'whole turn is saved',
    );
    const saved = await view(players[0].token);
    assert.equal(
      saved.gameView.self.rack.length,
      rackSize - (scenario === 'opening' ? 3 : 4),
    );
    assert.equal(saved.gameView.self.opened, true);
    assert.equal(
      saved.gameView.latest.placedTileIds.length,
      scenario === 'opening' ? 3 : 4,
    );
    assert.deepEqual((await view()).gameView.table, saved.gameView.table);
    assert.equal(
      await surface(phone).locator('[data-turn-workshop]').count(),
      0,
    );
    await capture(publicPage, 'saved-turn');
    item.checks.push(
      'UI submits parameterized whole-turn intent through production authority; public table changes only after save and rack count is correct.',
    );
    const checkpoint = (await view(hostToken)).history.at(-1);
    assert.ok(checkpoint);
    await send(hostSocket, hostToken, {
      type: 'rollback',
      checkpointId: checkpoint.id,
    });
    await until(
      async () => (await view(players[0].token)).branch > saved.branch,
      'new rollback branch',
    );
    await surface(phone).locator('[data-turn-workshop]').waitFor();
    assert.deepEqual(
      await ownDraft(),
      baseline,
      'old draft cannot restore across rollback branch',
    );
    assert.equal((await view(players[0].token)).self.seatId, saved.self.seatId);
    await capture(phone, 'rollback-new-branch');
    item.checks.push(
      'Actual saved checkpoint rollback creates a new branch, keeps identity and rejects the old local draft.',
    );
    if (scenario === 'opening') await auditAudio();
    assert.deepEqual(evidence.errors, [], 'No production page errors');
    assert.deepEqual(
      evidence.externalRequests,
      [],
      'All runtime requests stay local',
    );
    item.result = 'passed';
  } catch (error) {
    item.result = 'failed';
    evidence.failures.push({
      scenario,
      message: error.message,
      stack: error.stack,
    });
    for (const [label, page] of [
      ['failure-host', host],
      ['failure-player', phone],
    ])
      if (page && !page.isClosed())
        try {
          await capture(page, label);
        } catch {
          /* preserve first failure */
        }
    throw error;
  } finally {
    if (diagnosticTimer) clearInterval(diagnosticTimer);
    await diagnosticPending;
    if (desktop && host && !host.isClosed())
      try {
        await sampleMemory(host, 'fixture-finished', 'host');
      } catch (error) {
        item.memorySamplingError = error.message;
      }
    for (const socket of sockets) socket.disconnect();
    for (const session of metrics.values())
      try {
        await session.detach();
      } catch {
        /* target may close first */
      }
    if (desktop) await desktop.close();
    item.ownedDesktopClosed = true;
    evidence.elapsedSeconds =
      Math.round((performance.now() - started) / 10) / 100;
    evidence.result = evidence.failures.length
      ? 'failed'
      : evidence.cases.every((entry) => entry.result === 'passed')
        ? 'passed'
        : 'incomplete';
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify(evidence, null, 2) + '\n',
    );
  }
}
assert.deepEqual(evidence.errors, [], 'No production page errors');
assert.deepEqual(
  evidence.externalRequests,
  [],
  'All runtime requests stay local',
);
console.log(
  JSON.stringify({
    result: evidence.result,
    cases: evidence.cases.map(({ id, result, checks }) => ({
      id,
      result,
      checks: checks.length,
    })),
    screenshots: evidence.screenshots.length,
    output,
    elapsedSeconds: evidence.elapsedSeconds,
  }),
);
