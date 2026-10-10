import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { build, transform } from 'esbuild';
import ts from 'typescript';
import { verificationOutput } from '../support/verification-output.mjs';

const run = promisify(execFile);
const output = verificationOutput('memory');
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/runtime-memory-'));
const copyOnly = process.argv.includes('--copy-only');
const desktopOnly = process.argv.includes('--desktop-only');
const baselineRef =
  process.argv
    .find((argument) => argument.startsWith('--baseline-ref='))
    ?.slice('--baseline-ref='.length) ??
  '3e5b9a002f39eddfd81b0d3269f3070c94fd2e2c';
assert.ok(!(copyOnly && desktopOnly), 'Choose at most one partial run');
const resultPath = join(output, 'results.json');
let evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Measured copy allocations/time in isolated Node processes and optional hidden WebView2 navigation stress. Heap peaks are sampled, not allocation-profiler maxima; GC-controlled navigation is a bounded regression check, not proof of no leaks or bounded history.',
  runtime: { node: process.versions.node, platform: process.platform },
  result: 'running',
  copy: null,
  desktop: null,
};
if (desktopOnly) {
  try {
    evidence = {
      ...evidence,
      copy: JSON.parse(await readFile(resultPath, 'utf8')).copy ?? null,
    };
  } catch {
    // A desktop-only run is valid before a separate copy measurement exists.
  }
}
const persist = () => writeFile(resultPath, JSON.stringify(evidence, null, 2));
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function measureCopy() {
  const source = await readFile('packages/platform-core/src/room.ts', 'utf8');
  const syntax = ts.createSourceFile('room.ts', source, ts.ScriptTarget.Latest);
  const declaration = syntax.statements.find(
    (item) => ts.isFunctionDeclaration(item) && item.name?.text === 'copySave',
  );
  assert.ok(declaration, 'The current core must contain copySave');
  const functionSource = declaration.getText(syntax);
  const compiled = await transform(`${functionSource}\nexport { copySave };`, {
    loader: 'ts',
    format: 'esm',
    target: 'node22',
  });
  const modulePath = join(work, 'current-copy.mjs');
  await writeFile(modulePath, compiled.code);
  const { stdout: baseline } = await run('git', [
    'show',
    `${baselineRef}:packages/platform-core/src/room.ts`,
  ]);
  assert.match(
    baseline,
    /structuredClone\(this\.data\)/,
    'The baseline revision must contain the pre-change whole-save copy',
  );
  const generator = join(work, 'memory-save.cjs');
  await build({
    entryPoints: ['tools/test/fixtures/memory-save.ts'],
    outfile: generator,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'silent',
  });
  const fixturePath = join(work, 'save.json');
  const fixtureRun = await run(process.execPath, [generator, fixturePath], {
    windowsHide: true,
  });
  const runs = [];
  for (let index = 0; index < 3; index++) {
    for (const mode of index % 2
      ? ['current', 'baseline']
      : ['baseline', 'current']) {
      const { stdout } = await run(
        process.execPath,
        [
          '--expose-gc',
          resolve('tools/test/fixtures/measure-copy-memory.mjs'),
          mode,
          modulePath,
          fixturePath,
        ],
        { windowsHide: true, timeout: 120000 },
      );
      runs.push(JSON.parse(stdout));
    }
  }
  const summarize = (mode) => {
    const selected = runs.filter((item) => item.mode === mode);
    return {
      medianPeakAddedHeapBytes: median(
        selected.map((item) => item.peakAddedHeapBytes),
      ),
      medianCopyMs: median(selected.map((item) => item.medianCopyMs)),
      medianPeakSampledHeapBytes: median(
        selected.map((item) => item.peakSampledHeapBytes),
      ),
    };
  };
  evidence.copy = {
    result: 'measured',
    fixture: JSON.parse(fixtureRun.stdout),
    fixtureBytes: (await readFile(fixturePath)).length,
    fixtureSha256: hash(await readFile(fixturePath)),
    baseline:
      'structuredClone(Save), confirmed in the pre-change source revision',
    baselineRef,
    baselineSourceSha256: hash(baseline),
    currentFunctionSha256: hash(functionSource),
    baselineSummary: summarize('baseline'),
    currentSummary: summarize('current'),
    runs,
  };
  await persist();
  console.log('Copy allocation/time comparison complete.');
}

async function measureDesktop() {
  const { launchDesktop, desktopExecutable } =
    await import('../support/desktop-test.mjs');
  const requireWeb = createRequire(resolve('apps/web/package.json'));
  const { io } = requireWeb('socket.io-client');
  const dataDir = join(work, 'desktop-data');
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  const samples = [];
  const errors = [];
  const sockets = [];
  let desktop;
  evidence.desktop = {
    result: 'running',
    cycles: 20,
    warmupCycles: 5,
    scope:
      'One hidden production host window, local service and six authenticated simulated players. Each cycle starts/ends the same selected game and returns to the box; no second shipping game is implied.',
    environment:
      'Other engineering checks may run concurrently. Only this launched WebView2 application and its host renderer are sampled; host-wide RAM is not used. Timing and process working sets remain environment-dependent.',
    buildSha256: {
      main: hash(await readFile('build/desktop/TableMax.exe')),
      server: hash(await readFile('build/desktop/server.cjs')),
    },
    dataDir,
    samples,
    errors,
  };
  try {
    desktop = await launchDesktop({
      executablePath: desktopExecutable,
      args: ['--foundation-test', '--tablemax-play-mode'],
      env,
      timeout: 30000,
    });
    const host = await desktop.firstWindow();
    host.setDefaultTimeout(15000);
    host.on('pageerror', (error) => errors.push(error.message));
    await host.waitForURL('**/host');
    await host
      .locator('.game-library__item')
      .filter({ hasText: '宝可梦奇遇' })
      .getByRole('button', { name: '选择游戏', exact: true })
      .waitFor();
    const origin = new URL(host.url()).origin;
    const token = await host.evaluate(() =>
      sessionStorage.getItem('tablemax-host'),
    );
    assert.ok(token);
    const readView = async (credential) => {
      const response = await fetch(`${origin}/api/session/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credential }),
      });
      const body = await response.json();
      assert.equal(body.ok, true);
      return body.view;
    };
    const connect = async (credential) => {
      const socket = io(origin, {
        auth: { token: credential },
        transports: ['websocket'],
        autoConnect: false,
      });
      sockets.push(socket);
      await new Promise((done, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Socket connection timed out')),
          10000,
        );
        socket.once('connect', () => {
          clearTimeout(timer);
          done();
        });
        socket.once('connect_error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        socket.connect();
      });
      return { credential, socket };
    };
    const hostIdentity = await connect(token);
    const command = async (identity, action) => {
      const view = await readView(identity.credential);
      const reply = await identity.socket
        .timeout(10000)
        .emitWithAck('room:command', {
          actionId: randomUUID(),
          instanceId: view.instanceId,
          revision: view.revision,
          branch: view.branch,
          command: action,
        });
      assert.equal(reply.ok, true, reply.reason);
    };
    await host
      .locator('.game-library__item')
      .filter({ hasText: '宝可梦奇遇' })
      .getByRole('button', { name: '选择游戏', exact: true })
      .click();
    await host.getByRole('button', { name: '开始游戏', exact: true }).waitFor();
    const players = [];
    for (let index = 0; index < 6; index++) {
      const response = await fetch(`${origin}/api/session/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Memory player ${index + 1}` }),
      });
      const joined = await response.json();
      assert.equal(joined.ok, true);
      players.push(await connect(joined.token));
    }
    const cdp = await host.context().newCDPSession(host);
    await cdp.send('Performance.enable');
    const sample = async (cycle) => {
      await cdp.send('HeapProfiler.collectGarbage');
      const memory = await cdp.send('Runtime.getHeapUsage');
      const dom = await cdp.send('Memory.getDOMCounters');
      const processes = await desktop.evaluate(({ app, BrowserWindow }) => ({
        hidden: BrowserWindow.getAllWindows().every(
          (window) => !window.isVisible(),
        ),
        windows: BrowserWindow.getAllWindows().length,
        metrics: app.getAppMetrics().map(({ pid, type, name, memory }) => ({
          pid,
          type,
          name,
          memory,
        })),
      }));
      assert.equal(
        processes.hidden,
        true,
        'Verification must never show a native window',
      );
      assert.equal(
        processes.windows,
        1,
        'Repeated navigation must not accumulate windows',
      );
      samples.push({
        cycle,
        heapUsedBytes: memory.usedSize,
        heapTotalBytes: memory.totalSize,
        dom,
        processes,
      });
    };
    for (let cycle = 1; cycle <= 20; cycle++) {
      for (const player of players)
        await command(player, { type: 'ready', ready: true });
      await command(hostIdentity, { type: 'start' });
      await host.waitForURL('**/host/game');
      await host.locator('.game-table').waitFor();
      await command(hostIdentity, { type: 'end' });
      await host.getByRole('link', { name: '‹ 盒子', exact: true }).click();
      await host.waitForURL('**/host');
      await command(hostIdentity, {
        type: 'select-game',
        gameId: 'pokemon-encounters',
      });
      await host
        .getByRole('button', { name: '开始游戏', exact: true })
        .waitFor();
      await host.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      await sample(cycle);
    }
    const early = samples.slice(5, 10);
    const late = samples.slice(-5);
    const earlyHeap = median(early.map((item) => item.heapUsedBytes));
    const lateHeap = median(late.map((item) => item.heapUsedBytes));
    const growth = lateHeap - earlyHeap;
    const allowance = Math.max(8 * 1024 * 1024, earlyHeap * 0.35);
    const nodeGrowth =
      median(late.map((item) => item.dom.nodes)) -
      median(early.map((item) => item.dom.nodes));
    const listenerGrowth =
      median(late.map((item) => item.dom.jsEventListeners)) -
      median(early.map((item) => item.dom.jsEventListeners));
    evidence.desktop.analysis = {
      earlyMedianHeapBytes: earlyHeap,
      lateMedianHeapBytes: lateHeap,
      heapGrowthBytes: growth,
      allowedHeapGrowthBytes: allowance,
      nodeGrowth,
      allowedNodeGrowth: 128,
      listenerGrowth,
      allowedListenerGrowth: 24,
      processMemoryUnits:
        'Native .NET Process working-set/private-byte measurements for the launched desktop and service, in KiB. Renderer heap/DOM are measured separately through WebView2 CDP.',
    };
    assert.ok(
      growth <= allowance,
      'Post-GC renderer heap growth exceeds the regression allowance',
    );
    assert.ok(nodeGrowth <= 128, 'DOM nodes accumulate across game unmounts');
    assert.ok(
      listenerGrowth <= 24,
      'DOM event listeners accumulate across game unmounts',
    );
    assert.deepEqual(errors, []);
    evidence.desktop.result = 'passed';
  } catch (error) {
    evidence.desktop.result = 'failed';
    throw error;
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (desktop) await desktop.close();
    await persist();
  }
}

try {
  if (!desktopOnly) await measureCopy();
  if (!copyOnly) await measureDesktop();
  evidence.result = copyOnly ? 'copy-measured-desktop-pending' : 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await persist();
  console.log(`Memory evidence: ${resultPath}`);
}
