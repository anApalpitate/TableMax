import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import {
  launchDesktop,
  desktopExecutable,
} from '../../support/desktop-test.mjs';
import {
  ScreenshotPolicy,
  registerArtifacts,
  writeScreenshot,
} from '../../../maintenance/verification-artifacts.mjs';

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
const stabilityOnly = process.argv.includes('--stability-only');
const continueStabilityTable = process.argv.includes(
  '--continue-stability-table',
);
const priorStabilityArgument = process.argv
  .find((value) => value.startsWith('--prior-stability='))
  ?.slice(18);
assert.ok(
  !continueStabilityTable || (stabilityOnly && priorStabilityArgument),
  'Stability continuation requires --stability-only and --prior-stability=<results.json>',
);
const entryOnly = process.argv.includes('--entry-only');
const playerCount = Number(
  process.argv.find((value) => value.startsWith('--players='))?.slice(10) ?? 4,
);
assert.ok([2, 3, 4].includes(playerCount));
assert.ok(!entryOnly || (!only && !stabilityOnly && !navigationOnly));
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
const output = resolve(
  process.argv.find((value) => value.startsWith('--output='))?.slice(9) ??
    join('artifacts/rummikub/validation/ui-preview', name),
);
assert.ok(
  relative(resolve('artifacts'), output).split(sep)[0] !== '..' &&
    !relative(resolve('artifacts'), output).includes(':') &&
    relative(resolve('artifacts'), output).length > 0,
  'Evidence output must be inside artifacts/',
);
assert.match(
  relative(resolve('.'), output).split(sep).join('/'),
  /^artifacts\/(?:rummikub\/validation\/ui-preview\/|maintenance\/v\d+\.\d+\.\d+\/screenshot-storage-implementation-20261010\/rummikub\/)[\w-]+$/,
  'Evidence output must use the supported Rummikub validation directories',
);
const screenshotPolicy = new ScreenshotPolicy();
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/rummikub-ui-'));
const started = performance.now();
const evidence = {
  startedAt: new Date().toISOString(),
  executablePath,
  playerCount,
  mode: entryOnly ? 'entry' : stabilityOnly ? 'stability' : 'complete',
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
  screenshotMode: screenshotPolicy.mode,
  screenshotSelections: [],
  screenshotAliases: [],
  previewEncodings: [],
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
if (continueStabilityTable) {
  const priorPath = resolve(priorStabilityArgument);
  assert.ok(
    priorPath.startsWith(resolve('artifacts/rummikub/validation') + sep),
    'Prior stability evidence must stay in Rummikub validation',
  );
  const bytes = await readFile(priorPath);
  const prior = JSON.parse(bytes);
  assert.equal(prior.result, 'failed');
  assert.equal(prior.mode, 'stability');
  assert.equal(prior.playerCount, playerCount);
  assert.equal(
    prior.zipSha256,
    evidence.zipSha256,
    'Continuation uses the same ZIP',
  );
  assert.equal(
    prior.executableSha256,
    evidence.executableSha256,
    'Continuation uses the same executable',
  );
  const priorVerifierPath = join(
    dirname(priorPath),
    'verifier-start-source.mjs',
  );
  const priorVerifierSha256 = createHash('sha256')
    .update(await readFile(priorVerifierPath))
    .digest('hex');
  assert.equal(
    priorVerifierSha256,
    prior.verifierSha256,
    'Prior report matches its actual execution verifier source',
  );
  assert.ok(
    prior.screenshotSelections.some(
      (selection) => selection.rackSize === rackSize,
    ),
  );
  const previousCase = prior.cases.find(
    (entry) => entry.id === 'reorganization',
  );
  const labels = [
    [320, 568],
    [390, 640],
    [844, 390],
  ].flatMap(([width, height]) =>
    ['select-last', 'more-open', 'more-close', 'cancel-last'].map(
      (prefix) => `${prefix}-${width}x${height}`,
    ),
  );
  for (const label of labels) {
    const record = previousCase.scrollStability.find(
      (entry) => entry.label === label,
    );
    assert.ok(record, `Prior completed check exists: ${label}`);
    assert.ok(Math.abs(record.after.scroll - record.before.scroll) <= 1);
    assert.ok(
      Math.abs(record.after.windowScroll - record.before.windowScroll) <= 1,
    );
    assert.ok(Math.abs(record.after.rackTop - record.before.rackTop) <= 2);
    assert.ok(Math.abs(record.after.anchorTop - record.before.anchorTop) <= 2);
  }
  const reusedLayouts = [
    [320, 568],
    [390, 640],
    [844, 390],
  ].map(([width, height]) => `stability-rack-${width}x${height}`);
  for (const label of reusedLayouts) {
    const layout = prior.layouts.find(
      (entry) => entry.scenario === 'reorganization' && entry.label === label,
    );
    assert.ok(layout, `Prior completed layout exists: ${label}`);
    assert.deepEqual(layout.smallText, []);
    assert.deepEqual(layout.smallTargets, []);
    assert.ok(layout.scrollWidth <= layout.width + 1);
    assert.equal(layout.dockVisible, true);
    assert.equal(layout.submitUnobscured, true);
  }
  assert.ok(
    prior.failures.some((failure) =>
      failure.message.startsWith('table-selection-reserves-drop-row:'),
    ),
    'Continuation resumes the known explicit-positioning failure',
  );
  evidence.continuation = {
    report: priorPath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    verifierSource: priorVerifierPath,
    verifierSha256: priorVerifierSha256,
    zipSha256: prior.zipSha256,
    executableSha256: prior.executableSha256,
    reused: labels,
    reusedLayouts,
    resumedAt: 'table-selection-reserves-drop-row',
  };
}
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
export async function prepare(id,dataDir,rackSize,playerCount){
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
   latest:{serial:16,actor:seats.at(-1),verb:'draw',text:'摸牌，结束回合。',placedTileIds:[]}});
  if(id==='finish-final'){
   const historicRacks={...racks,[seats[0]]:[]};
   base.gameNumber=playerCount;
   base.results=Array.from({length:playerCount-1},(_,index)=>scoreGame(seats,historicRacks,'empty-rack',index+1));
   base.wins=Object.fromEntries(seats.map(seat=>[seat,seat===seats[0]?playerCount-1:0]));
   base.scores=Object.fromEntries(seats.map(seat=>[seat,base.results.reduce((sum,result)=>sum+result.scores[seat],0)]));
  }
  return rules.validateState(base,seats);
 }};
 const repo=new SqliteSaveRepository(dataDir),room=new RoomCoordinator(custom,bot,repo);
 const command=async(token,command)=>{const current=room.view(token);const reply=await room.command(token,{actionId:randomUUID(),instanceId:current.instanceId,revision:current.revision,branch:current.branch,command});assert.equal(reply.ok,true,JSON.stringify(reply));};
 const players=[];
 for(let i=0;i<playerCount;i++){const player=await room.join(i===0?'拉密重组长昵称abcdefghijkl':'朋友 '+(i+1),undefined,'avatar-'+(20+i));players.push({...player,seatId:room.view(player.token).self.seatId});await command(player.token,{type:'ready',ready:true});}
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

const scenarios = (
  entryOnly
    ? ['entry']
    : stabilityOnly
      ? ['reorganization']
      : ['opening', 'reorganization', 'finish', 'finish-final']
).filter((id) => !only || only.includes(id));
for (const scenario of scenarios) {
  const item = { id: scenario, checks: [], commands: [], layouts: [] };
  evidence.cases.push(item);
  const dataDir = join(work, scenario);
  await mkdir(dataDir);
  const players = entryOnly
    ? []
    : await prepare(scenario, dataDir, rackSize, playerCount);
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
      await capture(page, `open-failure-${role}-${index}`, { role });
      throw error;
    }
    return page;
  };
  const capture = async (
    page,
    label,
    {
      role = page === host ? 'host' : page === publicPage ? 'public' : 'player',
      state = label,
      boundary = 'state',
      layout = false,
      mustKeep = false,
      preview = false,
    } = {},
  ) => {
    if (budgetDiagnostic) return;
    const failure = /failure/i.test(label);
    const native = await desktop.browserWindow(page);
    const zoom = await native.evaluate((window) =>
      window.webContents.getZoomFactor(),
    );
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      dpi: devicePixelRatio,
    }));
    const filename = `${scenario}-${label}.png`;
    const selected = screenshotPolicy.path(filename, {
      group: `${scenario}:rack-${rackSize}:${state}`,
      label,
      role,
      boundary,
      layout,
      mustKeep,
      failure,
      zoom,
      dpi: geometry.dpi,
    });
    const selection = {
      scenario,
      rackSize,
      label,
      role,
      state,
      boundary,
      zoom,
      actual: geometry,
      requested: filename,
      selected,
      purpose:
        failure || mustKeep
          ? 'key-evidence'
          : preview
            ? 'preview'
            : 'representative',
    };
    evidence.screenshotSelections.push(selection);
    if (!selected) return;
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    const bytes = await native.evaluate(async (window) =>
      (await window.webContents.capturePage()).toPNG(),
    );
    const file = await writeScreenshot(
      output,
      selected,
      bytes,
      evidence.screenshotAliases,
      { preview, mustKeep, failure, encodings: evidence.previewEncodings },
    );
    selection.retained = file;
    if (!evidence.screenshots.includes(file)) evidence.screenshots.push(file);
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
    const state = label.startsWith('rules-')
      ? 'rules'
      : label.startsWith('player-desktop-portrait-')
        ? 'desktop-portrait'
        : label.startsWith('player-desktop-wide-')
          ? 'desktop-wide'
          : label.startsWith('game-result-') || label.startsWith('ended-')
            ? label
            : 'turn-workshop';
    const dimensions = label.match(/(\d+)x(\d+)/);
    const width = dimensions ? Number(dimensions[1]) : layout.width;
    const height = dimensions ? Number(dimensions[2]) : layout.height;
    const boundary =
      width >= 3840
        ? '4k'
        : width > height && role === 'player' && height <= 390
          ? 'landscape'
          : width <= 320
            ? 'narrow'
            : role === 'player'
              ? 'phone-standard'
              : 'desktop';
    await capture(page, label, { role, state, boundary, layout: true });
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
  const auditEntry = async (hostSocket, hostToken) => {
    const joinPlayer = async (index) => {
      const joined = await (
        await fetch(origin + '/api/session/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name:
              index === 0 ? '拉密入口长昵称abcdefghijkl' : `朋友 ${index + 1}`,
            requestKey: randomBytes(32).toString('hex'),
            avatarId: `avatar-${20 + index}`,
          }),
        })
      ).json();
      assert.equal(joined.ok, true, `Entry join: ${joined.reason ?? ''}`);
      const player = {
        token: joined.token,
        seatId: (await view(joined.token)).self.seatId,
      };
      players.push(player);
      const socket = await connect(player.token);
      await send(socket, player.token, { type: 'ready', ready: true });
      return socket;
    };
    const library = () =>
      host.getByRole('region', { name: '游戏库', exact: true });
    const ensureLibrary = async () => {
      if (!(await library().count()))
        await host
          .getByRole('button', { name: '切换游戏', exact: true })
          .click();
      await library().waitFor();
    };
    const card = () => library().locator('[data-game-id="rummikub"]');
    if (playerCount === 4) {
      // Another catalog entry is used only to establish a five-seat lobby.
      // No other game's rules, turn, assets or route are exercised.
      await send(hostSocket, hostToken, { type: 'select-game', gameId: 'uno' });
      for (let index = 0; index < 5; index++) await joinPlayer(index);
      await host.getByRole('button', { name: '切换游戏', exact: true }).click();
      await card().waitFor();
      assert.equal(await card().locator(':scope > button').isDisabled(), true);
      assert.match(await card().innerText(), /最多 4 席/);
      await capture(host, 'entry-five-seat-rummikub-disabled', {
        mustKeep: true,
      });
      await host
        .getByRole('dialog')
        .getByRole('button', { name: '关闭面板', exact: true })
        .click();
      const removed = players.pop();
      await send(hostSocket, hostToken, {
        type: 'remove-seat',
        seatId: removed.seatId,
      });
      await host.getByRole('button', { name: '切换游戏', exact: true }).click();
    }
    await ensureLibrary();
    await card().waitFor();
    assert.equal(await card().locator(':scope > button').isEnabled(), true);
    assert.doesNotMatch(await card().innerText(), /开发中/);
    await card().locator(':scope > button').click();
    await until(
      async () => (await view(hostToken)).game?.id === 'rummikub',
      'real library selects Rummikub',
    );
    if (playerCount !== 4)
      for (let index = 0; index < playerCount; index++) await joinPlayer(index);
    for (const player of players)
      await send(await connect(player.token), player.token, {
        type: 'ready',
        ready: true,
      });
    await send(hostSocket, hostToken, {
      type: 'set-owner',
      seatId: players[0].seatId,
    });
    const lobby = await view(hostToken);
    assert.equal(lobby.seats.length, playerCount);
    assert.equal(lobby.game.min, 2);
    assert.equal(lobby.game.max, 4);
    assert.equal(lobby.self.role, 'host');
    assert.equal(
      lobby.self.seatId,
      null,
      'administrator does not occupy a player seat',
    );
    await host.getByRole('button', { name: '开始游戏', exact: true }).click();
    await until(
      async () => (await view(hostToken)).status === 'playing',
      'real host start saves',
    );
    const projections = await Promise.all(
      players.map((player) => view(player.token)),
    );
    const privateTiles = projections.flatMap((projection, index) => {
      assert.equal(projection.gameView.self.seatId, players[index].seatId);
      assert.equal(projection.gameView.self.rack.length, 14);
      assert.equal(projection.gameView.poolCount, 106 - 14 * playerCount);
      return projection.gameView.self.rack.map((tile) => tile.id);
    });
    assert.equal(
      new Set(privateTiles).size,
      privateTiles.length,
      'fourteen distinct physical tiles per real player',
    );
    assert.equal((await view()).gameView.self, null);
    assert.equal((await view(hostToken)).gameView.self, null);
    const activeIndex = players.findIndex(
      (player) => player.seatId === projections[0].gameView.turnSeat,
    );
    assert.ok(activeIndex >= 0);
    // The platform may automatically navigate all active roles after start.
    // Let that render settle; use the real box link only if the box remains.
    await host.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    item.entryNavigation = 'automatic';
    if (
      !(await host.locator('.rk-screen').count()) &&
      (await host.locator('.box-screen').count())
    ) {
      const entry = host.getByRole('link', { name: '进入牌桌', exact: true });
      if (await entry.count()) {
        await entry.click();
        item.entryNavigation = 'box-link';
      }
    }
    await host.locator('.rk-screen').waitFor();
    publicPage = await open('public');
    phone = await open('player', activeIndex);
    for (const [page, role, width, height] of [
      [host, 'host', 1280, 720],
      [publicPage, 'public', 1920, 1080],
      [phone, 'player', 390, 640],
    ]) {
      await resize(page, width, height, role === 'player');
      assert.equal(
        await surface(page).locator('.rk-seat').count(),
        role === 'player' ? 0 : playerCount,
      );
      assert.equal(
        await surface(page).locator('[data-own-rack]').count(),
        role === 'player' ? 1 : 0,
      );
      assert.equal(
        await surface(page).locator('[data-submit-turn]').count(),
        role === 'player' ? 1 : 0,
      );
      await measure(
        page,
        `entry-${playerCount}-${role}-${width}x${height}`,
        role,
      );
    }
    item.checks.push(
      `Actual box catalog enables Rummikub, ${playerCount} real ready identities start the classic game with fourteen unique private tiles each, host/public have no rack or turn controls.${playerCount === 4 ? ' Five real lobby seats disable the Rummikub library choice before the fifth seat is removed.' : ''}`,
    );
  };
  const auditStability = async (hostSocket, hostToken) => {
    const ui = () => surface(phone);
    const rackIds = (page = phone) =>
      surface(page)
        .locator('[data-own-rack] [data-tile-id]')
        .evaluateAll((tiles) => tiles.map((tile) => tile.dataset.tileId));
    const sort = (page = phone) =>
      surface(page).getByRole('combobox', { name: '牌架排序', exact: true });
    const settle = () =>
      ui().evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
    const draft = () =>
      ui().evaluate(
        () =>
          JSON.parse(sessionStorage.getItem('tablemax:rummikub:turn-draft'))
            .draft,
      );
    const rackCache = () =>
      ui().evaluate(() =>
        JSON.parse(sessionStorage.getItem('tablemax:rummikub:rack-order')),
      );
    const physical = (value) =>
      [
        ...value.groups.flatMap((group) => group.tiles),
        ...value.rack,
        ...value.tray,
      ].sort();
    const originalView = await view(players[0].token);
    const projections = await Promise.all(
      players.map((player) => view(player.token)),
    );
    for (const [index, projection] of projections.entries()) {
      assert.equal(projection.gameView.self.seatId, players[index].seatId);
      const forbidden = projections.flatMap((other, otherIndex) =>
        otherIndex === index
          ? []
          : other.gameView.self.rack.map((tile) => tile.id),
      );
      const json = JSON.stringify(projection.gameView);
      assert.ok(
        forbidden.every((id) => !json.includes(id)),
        'each real player projection excludes every other private rack instance',
      );
      assert.equal(
        'pool' in projection.gameView,
        false,
        'private pool order is absent',
      );
      assert.equal(
        'racks' in projection.gameView,
        false,
        'complete private rack map is absent',
      );
    }
    const expectedPhysical = [
      ...originalView.gameView.table.flatMap((group) =>
        group.tiles.map((tile) => tile.tileId),
      ),
      ...originalView.gameView.self.rack.map((tile) => tile.id),
    ].sort();
    const assertPhysical = async (label) => {
      const actual = physical(await draft());
      assert.equal(
        new Set(actual).size,
        actual.length,
        `${label}: no duplicate physical tile`,
      );
      assert.deepEqual(
        actual,
        expectedPhysical,
        `${label}: all authorized table/rack instances survive`,
      );
      assert.equal(
        (await view(players[0].token)).revision,
        originalView.revision,
        `${label}: presentation does not save a game action`,
      );
    };
    const snapshot = (anchor) =>
      ui().evaluate((id) => {
        const viewport = document.querySelector('.rk-workspace-scroll');
        const rack = document.querySelector('.rk-rack-section');
        const tile = [
          ...document.querySelectorAll('[data-own-rack] [data-tile-id]'),
        ].find((element) => element.dataset.tileId === id);
        return {
          scroll: viewport?.scrollTop ?? 0,
          windowScroll: scrollY,
          rackTop: rack?.getBoundingClientRect().top ?? 0,
          anchorTop: tile?.getBoundingClientRect().top ?? null,
        };
      }, anchor);
    const stable = async (
      label,
      action,
      anchor,
      { structural = false, rackTop = true, target } = {},
    ) => {
      if (target) {
        const geometry = (element) => {
          const rect = element.getBoundingClientRect();
          const viewport = element.closest('.rk-workspace-scroll');
          const bounds = viewport?.getBoundingClientRect();
          const top = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return {
            target: {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            },
            viewport: bounds
              ? {
                  top: bounds.top,
                  bottom: bounds.bottom,
                  left: bounds.left,
                  right: bounds.right,
                }
              : { top: 0, bottom: innerHeight, left: 0, right: innerWidth },
            hit: top === element || element.contains(top),
          };
        };
        const beforePosition = await target.evaluate(geometry);
        // This is explicit test browsing, before the operation baseline. A
        // click must not first auto-scroll an off-screen target into view.
        await target.scrollIntoViewIfNeeded();
        await settle();
        const positioned = await target.evaluate(geometry);
        item.explicitPositioning ??= [];
        item.explicitPositioning.push({
          label,
          before: beforePosition,
          after: positioned,
        });
        assert.ok(
          positioned.target.top >= positioned.viewport.top - 1 &&
            positioned.target.bottom <= positioned.viewport.bottom + 1 &&
            positioned.target.left >= positioned.viewport.left - 1 &&
            positioned.target.right <= positioned.viewport.right + 1,
          `${label}: target is fully visible before baseline`,
        );
        assert.equal(
          positioned.hit,
          true,
          `${label}: target hit-test before baseline`,
        );
      }
      await settle();
      const before = await snapshot(anchor);
      await action();
      await settle();
      const after = await snapshot(anchor);
      item.scrollStability ??= [];
      item.scrollStability.push({ label, before, after, structural });
      assert.ok(
        Math.abs(after.windowScroll - before.windowScroll) <= 1,
        `${label}: document scroll stable`,
      );
      if (!structural)
        assert.ok(
          Math.abs(after.scroll - before.scroll) <= 1,
          `${label}: workspace scroll stable`,
        );
      if (rackTop && !structural)
        assert.ok(
          Math.abs(after.rackTop - before.rackTop) <= 2,
          `${label}: operation row does not push the rack`,
        );
      if (anchor && before.anchorTop !== null && after.anchorTop !== null)
        assert.ok(
          Math.abs(after.anchorTop - before.anchorTop) <= 2,
          `${label}: surviving rack tile retains its viewport anchor`,
        );
      await assertPhysical(label);
    };
    const expectedSort = (tiles, mode) =>
      [...tiles]
        .sort((left, right) => {
          if (mode === 'dealt') return 0;
          const value = (left.value ?? 99) - (right.value ?? 99);
          const color = (left.color ?? 'z').localeCompare(right.color ?? 'z');
          return mode === 'value' ? value || color : color || value;
        })
        .map((tile) => tile.id);
    const assertTileVisible = async (target, label) => {
      await settle();
      const visible = await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const clip = {
          left: 0,
          top: 0,
          right: innerWidth,
          bottom: innerHeight,
        };
        const clippers = [];
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          // display: contents has no principal box, so its declared overflow
          // cannot clip descendants; continue to the actual boxed ancestors.
          if (style.display === 'contents') continue;
          const clipX = /auto|scroll|hidden|clip/.test(style.overflowX);
          const clipY = /auto|scroll|hidden|clip/.test(style.overflowY);
          if (!clipX && !clipY) continue;
          const bounds = ancestor.getBoundingClientRect();
          const scaleX = ancestor.offsetWidth
            ? bounds.width / ancestor.offsetWidth
            : 1;
          const scaleY = ancestor.offsetHeight
            ? bounds.height / ancestor.offsetHeight
            : 1;
          const client = {
            left: bounds.left + ancestor.clientLeft * scaleX,
            top: bounds.top + ancestor.clientTop * scaleY,
            right:
              bounds.left +
              (ancestor.clientLeft + ancestor.clientWidth) * scaleX,
            bottom:
              bounds.top +
              (ancestor.clientTop + ancestor.clientHeight) * scaleY,
          };
          if (clipX) {
            clip.left = Math.max(clip.left, client.left);
            clip.right = Math.min(clip.right, client.right);
          }
          if (clipY) {
            clip.top = Math.max(clip.top, client.top);
            clip.bottom = Math.min(clip.bottom, client.bottom);
          }
          clippers.push({
            className: ancestor.className,
            clipX,
            clipY,
            client,
          });
        }
        const width = Math.max(
          0,
          Math.min(rect.right, clip.right) - Math.max(rect.left, clip.left),
        );
        const height = Math.max(
          0,
          Math.min(rect.bottom, clip.bottom) - Math.max(rect.top, clip.top),
        );
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = (px, py) => {
          const top = document.elementFromPoint(px, py);
          return top === element || element.contains(top);
        };
        return {
          tileId: element.dataset.tileId,
          selected: element.dataset.selected === 'true',
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
          clip,
          visibleWidth: width,
          visibleHeight: height,
          centerUnobscured: hit(x, y),
          touchSquareUnobscured: [
            [-21.5, -21.5],
            [21.5, -21.5],
            [-21.5, 21.5],
            [21.5, 21.5],
            [0, 0],
          ].every(([dx, dy]) => hit(x + dx, y + dy)),
          clippers,
        };
      });
      item.tileVisibility ??= [];
      item.tileVisibility.push({ label, ...visible });
      const topTolerance = visible.selected ? 2 : 0.5;
      assert.ok(
        visible.rect.top >= visible.clip.top - topTolerance &&
          visible.rect.bottom <= visible.clip.bottom + 0.5 &&
          visible.rect.left >= visible.clip.left - 0.5 &&
          visible.rect.right <= visible.clip.right + 0.5,
        `${label}: the whole tile fits its actual overflow viewport (only selected -2px lift may cross the top edge): ${JSON.stringify(visible)}`,
      );
      assert.equal(
        visible.centerUnobscured,
        true,
        `${label}: tile center is unobscured`,
      );
      assert.ok(
        visible.visibleWidth >= 44 && visible.visibleHeight >= 44,
        `${label}: actual visible touch region is at least 44px on each axis`,
      );
      assert.equal(
        visible.touchSquareUnobscured,
        true,
        `${label}: centered 44px touch square is unobscured`,
      );
    };
    await resize(phone, 390, 640, true);
    await moveInteractionOrb();
    let arranged, conservedDraft;
    if (continueStabilityTable) {
      // Restore the same fixture presentation as setup, without re-running
      // the hash-bound sorting/drag/three-viewport checks completed earlier.
      await ui()
        .getByRole('button', { name: `牌架 ${rackSize}`, exact: true })
        .click();
      await sort().selectOption('value');
      arranged = await rackIds();
      conservedDraft = await draft();
    } else {
      for (const mode of ['color', 'value', 'dealt']) {
        await ui()
          .getByRole('button', { name: `牌架 ${rackSize}`, exact: true })
          .click();
        await sort().selectOption(mode);
        assert.deepEqual(
          await rackIds(),
          expectedSort(originalView.gameView.self.rack, mode),
          `${mode}: real rack sorting`,
        );
        await assertPhysical(`${mode} sorting`);
      }
      await sort().selectOption('value');
      const initialOrder = await rackIds();
      const movedId = initialOrder[1];
      const movedTile = ui().locator(
        `[data-own-rack] button[data-tile-id="${movedId}"]`,
      );
      await movedTile.focus();
      await movedTile.press('Alt+ArrowLeft');
      const customOrder = [movedId, initialOrder[0], ...initialOrder.slice(2)];
      assert.deepEqual(
        await rackIds(),
        customOrder,
        'Alt direction moves one local physical tile',
      );
      await assertPhysical('custom local ordering');
      for (const name of ['撤销', '重置', '更多', '取消选牌', '整理牌架']) {
        const button = ui().getByRole('button', { name, exact: true });
        assert.equal(
          await button.locator('svg[aria-hidden="true"]').count(),
          1,
          `${name}: visual icon and accessible action name`,
        );
      }
      // Verify drag in explicit arrangement mode with two visible first-row tiles.
      await ui().getByRole('button', { name: '整理牌架', exact: true }).click();
      const first = await ui()
        .locator(`[data-own-rack] button[data-tile-id="${customOrder[0]}"]`)
        .boundingBox();
      const second = await ui()
        .locator(`[data-own-rack] button[data-tile-id="${customOrder[1]}"]`)
        .boundingBox();
      assert.ok(first && second);
      await phone.mouse.move(
        second.x + second.width / 2,
        second.y + second.height / 2,
      );
      await phone.mouse.down();
      await phone.mouse.move(first.x + 2, first.y + first.height / 2, {
        steps: 8,
      });
      await phone.mouse.up();
      await ui().getByRole('button', { name: '整理牌架', exact: true }).click();
      arranged = await rackIds();
      assert.deepEqual(
        arranged,
        initialOrder,
        'real pointer drag changes local order without selecting a play tile',
      );
      assert.equal(
        await ui().locator('[data-own-rack] [data-selected="true"]').count(),
        0,
      );
      await assertPhysical('pointer local ordering');
      conservedDraft = await draft();
      for (const [width, height] of [
        [320, 568],
        [390, 640],
        [650, 390],
        [667, 375],
        [720, 390],
        [844, 390],
      ]) {
        await resize(phone, width, height, true);
        await moveInteractionOrb();
        await ui()
          .getByRole('button', { name: `牌架 ${rackSize}`, exact: true })
          .click();
        const lastId = arranged.at(-1);
        const last = ui().locator(
          `[data-own-rack] button[data-tile-id="${lastId}"]`,
        );
        await last.evaluate((element) =>
          element.scrollIntoView({
            block: 'end',
            inline: 'nearest',
            behavior: 'instant',
          }),
        );
        await last.scrollIntoViewIfNeeded();
        await assertTileVisible(last, `last-before-select-${width}x${height}`);
        await stable(
          `select-last-${width}x${height}`,
          () => last.click(),
          lastId,
        );
        assert.equal(await last.getAttribute('aria-pressed'), 'true');
        await assertTileVisible(last, `last-selected-${width}x${height}`);
        await stable(
          `more-open-${width}x${height}`,
          () => ui().getByRole('button', { name: '更多', exact: true }).click(),
          lastId,
        );
        await stable(
          `more-close-${width}x${height}`,
          () =>
            ui()
              .getByRole('dialog')
              .getByRole('button', { name: '继续整理', exact: true })
              .click(),
          lastId,
        );
        await stable(
          `cancel-last-${width}x${height}`,
          () =>
            ui().getByRole('button', { name: '取消选牌', exact: true }).click(),
          lastId,
        );
        await assertTileVisible(last, `last-after-cancel-${width}x${height}`);
        await measure(phone, `stability-rack-${width}x${height}`, 'player');
        assert.deepEqual(
          await rackIds(),
          arranged,
          'viewport resize retains local order',
        );
        assert.deepEqual(
          await draft(),
          conservedDraft,
          'viewport resize and selecting retain exact draft',
        );
      }
    }
    // Reserved drop/tool rows cannot shift the rack when an existing group is selected.
    await resize(phone, 390, 640, true);
    await ui().getByRole('button', { name: '桌面', exact: true }).click();
    await stable(
      'table-selection-reserves-drop-row',
      () => select('red-06-a', '[data-draft-table]'),
      undefined,
      {
        target: ui().locator(
          '[data-draft-table] button[data-tile-id="red-06-a"]',
        ),
      },
    );
    await stable(
      'group-menu-reserves-tool-row',
      () =>
        ui().getByRole('button', { name: '第 2 组操作', exact: true }).click(),
      undefined,
      {
        target: ui().getByRole('button', { name: '第 2 组操作', exact: true }),
      },
    );
    await stable('group-menu-close', () =>
      ui()
        .getByRole('dialog')
        .getByRole('button', { name: '关闭面板', exact: true })
        .click(),
    );
    await stable('table-selection-cancel', () =>
      ui().getByRole('button', { name: '取消选牌', exact: true }).click(),
    );
    // Creating a group changes table height; a surviving rack tile is the user anchor.
    await ui()
      .getByRole('button', { name: `牌架 ${rackSize}`, exact: true })
      .click();
    // Hide an interior tile immediately after the first tile. A clamped
    // AltLeft must not move the first tile across that hidden cache entry.
    const createId = arranged[1];
    const survivor = arranged[0];
    const completeRackCache = await rackCache();
    assert.deepEqual(
      completeRackCache.order.ids,
      arranged,
      'the cache includes every authorized rack tile before drafting',
    );
    await select(createId, '[data-own-rack]');
    await stable(
      'new-group-keeps-rack-anchor',
      () => ui().getByRole('button', { name: '建立新组', exact: true }).click(),
      survivor,
      { structural: true },
    );
    assert.equal(
      await ui()
        .locator(`[data-draft-table] [data-tile-id="${createId}"]`)
        .count(),
      1,
    );
    assert.deepEqual(
      await rackIds(),
      arranged.filter((id) => id !== createId),
    );
    const changedDraft = await draft();
    assert.deepEqual(
      await rackCache(),
      completeRackCache,
      'drafting an interior tile keeps its original complete-cache position',
    );
    const visibleOrder = arranged.filter((id) => id !== createId);
    for (const [id, key] of [
      [visibleOrder[0], 'Alt+ArrowLeft'],
      [visibleOrder.at(-1), 'Alt+ArrowRight'],
    ]) {
      const edgeTile = ui().locator(
        `[data-own-rack] button[data-tile-id="${id}"]`,
      );
      await edgeTile.scrollIntoViewIfNeeded();
      await assertTileVisible(edgeTile, `hidden-draft-boundary-${key}`);
      await edgeTile.press(key);
      await settle();
      const afterCache = await rackCache();
      item.rackBoundaryKeys ??= [];
      item.rackBoundaryKeys.push({
        key,
        tileId: id,
        hiddenTileId: createId,
        before: completeRackCache,
        after: afterCache,
      });
      assert.deepEqual(
        afterCache,
        completeRackCache,
        `${key}: clamped boundary preserves all cached IDs, including the hidden draft tile`,
      );
      assert.deepEqual(
        await rackIds(),
        visibleOrder,
        `${key}: visible order stays`,
      );
      assert.deepEqual(
        await draft(),
        changedDraft,
        `${key}: private draft stays`,
      );
      await assertPhysical(`hidden draft ${key}`);
    }
    await ui().getByRole('button', { name: '撤销', exact: true }).click();
    assert.deepEqual(
      await draft(),
      conservedDraft,
      'undo returns the hidden tile',
    );
    assert.deepEqual(
      await rackIds(),
      arranged,
      'undo restores the interior tile at its exact original rack position',
    );
    assert.deepEqual(await rackCache(), completeRackCache);
    await assertPhysical('hidden draft boundary undo');
    // Recreate the same draft so the existing refresh/reset checks continue
    // from their original scenario, without adding another case.
    await select(createId, '[data-own-rack]');
    await ui().getByRole('button', { name: '建立新组', exact: true }).click();
    assert.deepEqual(
      await draft(),
      changedDraft,
      'the same private draft resumes',
    );
    item.checks.push(
      'With an interior rack tile hidden in the private draft, first-tile AltLeft and last-tile AltRight preserve the entire scoped rack cache, visible order, draft and server revision; undo returns the hidden tile to its original position.',
    );
    const iframeBefore = surface(phone);
    await phone.reload();
    await phone.locator('iframe[data-player-frame]').waitFor();
    await until(
      () => surface(phone) !== phone && surface(phone) !== iframeBefore,
      'refresh reattaches the actual player document',
    );
    await ui().locator('[data-turn-workshop]').waitFor();
    assert.deepEqual(
      await draft(),
      changedDraft,
      'refresh restores the authorized private draft',
    );
    assert.deepEqual(
      await rackIds(),
      arranged.filter((id) => id !== createId),
      'refresh keeps the custom surviving order',
    );
    assert.equal(
      await sort().inputValue(),
      'value',
      'refresh preserves sort choice',
    );
    await ui().getByRole('button', { name: '重置', exact: true }).click();
    assert.deepEqual(
      await draft(),
      conservedDraft,
      'reset restores exact original physical draft',
    );
    assert.deepEqual(
      await rackIds(),
      arranged,
      'reset retains the presentation order',
    );
    await assertPhysical('refresh/reset');
    // Use the desktop player's real mode switch; it retains the same iframe.
    await metrics.get(phone).send('Emulation.setUserAgentOverride', {
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
    await ui().locator('[data-turn-workshop]').waitFor();
    const desktopIframe = surface(phone);
    await measure(phone, 'stability-desktop-portrait-1280x720', 'player');
    await phone.locator('.player-frame__display').click();
    await until(
      () =>
        ui().evaluate(
          () => document.documentElement.dataset.playerDisplay === 'wide',
        ),
      'actual wide mode applies',
    );
    assert.equal(
      surface(phone),
      desktopIframe,
      'orientation does not recreate the authorized player iframe',
    );
    assert.deepEqual(await rackIds(), arranged);
    assert.deepEqual(await draft(), conservedDraft);
    await measure(phone, 'stability-desktop-wide-1280x720', 'player');
    await resize(phone, 3840, 2160);
    assert.deepEqual(await rackIds(), arranged);
    await measure(phone, 'stability-desktop-wide-3840x2160', 'player');
    await resize(phone, 1280, 720);
    await ui().getByRole('button', { name: '摸牌结束', exact: true }).click();
    await until(
      async () =>
        (await view(players[0].token)).gameView.turnSeat !== players[0].seatId,
      'real draw saves and changes turn',
    );
    await until(
      async () => (await ui().locator('[data-turn-workshop]').count()) === 0,
      'saved draw renders waiting rack',
    );
    const drawnView = await view(players[0].token);
    const drawnId = drawnView.gameView.self.rack.find(
      (tile) => !arranged.includes(tile.id),
    ).id;
    assert.deepEqual(
      await rackIds(),
      [...arranged, drawnId],
      'new drawn tile appends without rearranging survivors',
    );
    assert.equal(
      await sort().inputValue(),
      'value',
      'waiting rack retains sorting choice',
    );
    assert.equal(
      await ui().locator('[data-submit-turn]').count(),
      0,
      'waiting player has no submit action',
    );
    assert.equal(
      await ui().locator('[data-own-rack] button[data-tile-id]').count(),
      rackSize + 1,
      'waiting rack retains accessible local arrangement tiles',
    );
    await ui().locator('[data-own-rack] button[data-tile-id]').first().click();
    assert.equal(
      await ui().locator('[data-own-rack] [data-selected="true"]').count(),
      0,
      'waiting tile click cannot select a play action',
    );
    const publicLatest = (await view()).gameView.latest;
    assert.deepEqual(
      publicLatest,
      drawnView.gameView.latest,
      'saved draw has one public latest-action projection',
    );
    const latest = ui().locator('[data-latest-saved-action]');
    assert.equal(
      await latest.locator(':scope > span:not(.rk-saved-label)').innerText(),
      publicLatest.text,
      'visible saved result matches the actual public latest text',
    );
    assert.equal(
      publicLatest.actor,
      players[0].seatId,
      'saved draw names the acting seat',
    );
    assert.equal(
      await latest.locator(':scope > strong').innerText(),
      drawnView.seats.find((seat) => seat.id === publicLatest.actor).name,
      'visible saved actor matches the acting player',
    );
    const savedLabel = latest.locator('.rk-saved-label');
    assert.equal(
      await savedLabel.isVisible(),
      true,
      'saved-result marker is visible to the player',
    );
    assert.equal(await savedLabel.innerText(), '已保存');
    assert.ok(
      await savedLabel.evaluate(
        (element) => parseFloat(getComputedStyle(element).fontSize) >= 16,
      ),
      'visible saved-result marker is at least 16px',
    );
    const waitingDraftBefore = await draft();
    await sort().selectOption('dealt');
    const waitingOrder = await rackIds();
    assert.deepEqual(
      waitingOrder,
      drawnView.gameView.self.rack.map((tile) => tile.id),
      'waiting player can sort locally',
    );
    await ui().getByRole('button', { name: '整理牌架', exact: true }).click();
    const waitingMoved = waitingOrder[1];
    await ui()
      .locator(`[data-own-rack] button[data-tile-id="${waitingMoved}"]`)
      .press('Alt+ArrowLeft');
    await ui().getByRole('button', { name: '整理牌架', exact: true }).click();
    const waitingCustom = [
      waitingMoved,
      waitingOrder[0],
      ...waitingOrder.slice(2),
    ];
    assert.deepEqual(
      await rackIds(),
      waitingCustom,
      'waiting player can arrange locally',
    );
    assert.deepEqual(
      await draft(),
      waitingDraftBefore,
      'waiting sorting cannot alter prior turn draft',
    );
    const afterLocalSort = await view(players[0].token);
    assert.equal(
      afterLocalSort.revision,
      drawnView.revision,
      'waiting sorting does not submit or save an action',
    );
    await phone.reload();
    await phone.locator('iframe[data-player-frame]').waitFor();
    await until(() => surface(phone) !== phone, 'waiting refresh reattaches');
    await ui().locator('[data-own-rack]').waitFor();
    assert.deepEqual(
      await rackIds(),
      waitingCustom,
      'waiting refresh restores local order',
    );
    for (let index = 1; index < playerCount; index++) {
      const player = players[index];
      const current = await view(player.token);
      assert.equal(
        current.gameView.turnSeat,
        player.seatId,
        'actual turn order reaches each real seat',
      );
      const socket = await connect(player.token);
      await send(socket, player.token, {
        type: 'game',
        decisionId: current.decisionId,
        action: { type: 'draw' },
      });
    }
    await ui().locator('[data-turn-workshop]').waitFor();
    assert.deepEqual(
      await rackIds(),
      waitingCustom,
      'next own turn keeps waiting custom order and new tile',
    );
    assert.equal(await sort().inputValue(), 'dealt');
    const nextTurnDraft = await draft();
    await send(hostSocket, hostToken, { type: 'pause' });
    await ui().locator('.rk-notice').waitFor();
    const pausedView = await view(players[0].token);
    await sort().selectOption('color');
    const pausedOrder = await rackIds();
    assert.deepEqual(
      pausedOrder,
      expectedSort(pausedView.gameView.self.rack, 'color'),
      'paused rack can sort locally',
    );
    const pausedTile = ui()
      .locator('[data-own-rack] button[data-tile-id]')
      .nth(1);
    assert.equal(await pausedTile.getAttribute('aria-disabled'), 'true');
    await pausedTile.scrollIntoViewIfNeeded();
    await assertTileVisible(pausedTile, 'paused-tile-before-user-click');
    const pausedBounds = await pausedTile.boundingBox();
    assert.ok(pausedBounds, 'paused tile has a real page-coordinate target');
    // aria-disabled deliberately gates play selection while retaining local
    // keyboard arrangement. Send a real pointer click to verify that gate;
    // Locator.click would stop at its own enabled check before reaching it.
    await phone.mouse.click(
      pausedBounds.x + pausedBounds.width / 2,
      pausedBounds.y + pausedBounds.height / 2,
    );
    await settle();
    assert.equal(
      await ui().locator('[data-own-rack] [data-selected="true"]').count(),
      0,
      'paused tile cannot select a play action',
    );
    assert.deepEqual(
      await rackIds(),
      pausedOrder,
      'paused click keeps local order',
    );
    assert.deepEqual(
      await draft(),
      nextTurnDraft,
      'paused pointer click does not alter the private turn draft',
    );
    assert.equal(
      (await view(players[0].token)).revision,
      pausedView.revision,
      'paused pointer click does not save an action',
    );
    const arrange = ui().getByRole('button', { name: '整理牌架', exact: true });
    await arrange.click();
    assert.equal(await arrange.getAttribute('aria-pressed'), 'true');
    assert.equal(await pausedTile.getAttribute('aria-disabled'), 'false');
    await pausedTile.press('Alt+ArrowLeft');
    assert.deepEqual(
      await rackIds(),
      [pausedOrder[1], pausedOrder[0], ...pausedOrder.slice(2)],
      'paused rack can rearrange locally',
    );
    await arrange.click();
    assert.equal(await arrange.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(
      await draft(),
      nextTurnDraft,
      'pause and local ordering preserve next turn draft',
    );
    assert.equal(
      (await view(players[0].token)).revision,
      pausedView.revision,
      'paused presentation does not save an action',
    );
    await send(hostSocket, hostToken, { type: 'resume' });
    await until(
      async () => (await ui().locator('.rk-notice').count()) === 0,
      'real host resume unlocks the same turn',
    );
    for (const [page, role] of [
      [host, 'host'],
      [publicPage, 'public'],
    ]) {
      assert.equal(await surface(page).locator('[data-own-rack]').count(), 0);
      assert.equal(
        await surface(page).locator('[data-submit-turn]').count(),
        0,
      );
      assert.equal(
        await surface(page).locator('.rk-seat').count(),
        playerCount,
      );
      for (const [width, height] of [
        [1280, 720],
        [3840, 2160],
      ]) {
        await resize(page, width, height);
        await measure(page, `stability-${role}-${width}x${height}`, role);
      }
    }
    item.checks.push(
      continueStabilityTable
        ? `Actual ${playerCount}-seat continuation: earlier sorts, Alt/drag and 320/390/short-landscape rack checks are reused from the same ZIP/executable report in continuation. Explicitly positioned table/group controls and new-group anchor, refresh/private draft/desktop mode switch/4K, saved draw/new tile, waiting/next-own-turn ordering and paused local arrangement are exercised in this run; latest actor/result/save and host/public read-only projection are checked.`
        : `Actual ${playerCount}-seat classic Rummikub: local color/value/dealt sorts, Alt rearrangement and pointer drag preserve physical tiles and server revision; last-tile selection, new group, more and reserved group controls retain the visible rack anchor at 320/390px and short landscape. Refresh/real desktop mode switch/4K retain private draft and local order. Saved draw appends one tile, waiting sorting survives refresh and all other real seats' draws into the next own turn; latest action names the actor/result/save, host/public remain read-only.`,
    );
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
    await capture(phone, `rack-${rackSize}-initial-table`, {
      state: 'rack-table',
      boundary: 'phone-standard',
      layout: true,
    });
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
      const boundary =
        width === 320
          ? 'narrow'
          : width > height
            ? 'landscape'
            : 'phone-standard';
      await capture(phone, `rack-${rackSize}-${width}x${height}-start`, {
        state: 'rack-start',
        boundary,
        layout: true,
      });
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
      await capture(phone, `rack-${rackSize}-${width}x${height}-end`, {
        state: 'rack-end',
        boundary,
        layout: true,
      });
      await tableButton().click();
      await until(
        async () =>
          (await tableButton().getAttribute('aria-pressed')) === 'true',
        'visible table is selected',
      );
      await capture(phone, `rack-${rackSize}-${width}x${height}-table`, {
        state: 'rack-table',
        boundary,
        layout: true,
      });
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
    if (entryOnly) {
      await auditEntry(hostSocket, hostToken);
      assert.deepEqual(evidence.errors, [], 'No production page errors');
      assert.deepEqual(
        evidence.externalRequests,
        [],
        'All runtime requests stay local',
      );
      item.result = 'passed';
      continue;
    }
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
    await capture(host, 'box-game-cover', { preview: true });
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
    if (stabilityOnly) {
      await auditStability(hostSocket, hostToken);
      assert.deepEqual(evidence.errors, [], 'No production page errors');
      assert.deepEqual(
        evidence.externalRequests,
        [],
        'All runtime requests stay local',
      );
      item.result = 'passed';
      continue;
    }
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
        assert.equal(
          await surface(page).locator('.rk-result').count(),
          playerCount,
        );
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
      const groupMenu = surface(phone).getByRole('dialog', {
        name: '第 2 组操作',
        exact: true,
      });
      await groupMenu
        .getByRole('button', { name: '从选中牌拆分', exact: true })
        .click();
      await groupMenu.waitFor({ state: 'hidden' });
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
    evidence.skippedScreenshots = screenshotPolicy.skipped;
    evidence.result = evidence.failures.length
      ? 'failed'
      : evidence.cases.every((entry) => entry.result === 'passed')
        ? 'passed'
        : 'incomplete';
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify(evidence, null, 2) + '\n',
    );
    if (item.result === 'failed' || evidence.cases.length === scenarios.length)
      try {
        await registerArtifacts({
          output,
          reportPath: join(output, 'results.json'),
          work,
          passed: evidence.result === 'passed',
          policy: screenshotPolicy,
        });
      } catch (error) {
        // Registration cannot change the completed product verification result.
        evidence.artifactRegistrationError = error.message;
        await writeFile(
          join(output, 'results.json'),
          JSON.stringify(evidence, null, 2) + '\n',
        );
      }
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
