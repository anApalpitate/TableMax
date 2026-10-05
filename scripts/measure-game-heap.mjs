import { build } from 'esbuild';
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  copyFile,
  cp,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { verificationOutput } from './verification-output.mjs';
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith('--' + name + '='))
    ?.slice(name.length + 3);
const childGame = argument('child');
if (childGame) {
  const work = argument('work'),
    require = createRequire(import.meta.url);
  const { createService, WorkerBotExecutor } = require(
    join(work, 'measure.cjs'),
  );
  const modules = JSON.parse(
    await readFile(join(work, 'modules.json'), 'utf8'),
  );
  const module = modules.find((item) => item.id === childGame),
    bot = module ? require(join(work, module.entries.bot)).bot : null;
  const data = join(work, childGame + '-' + argument('run'));
  const service = await createService({
    host: '127.0.0.1',
    port: 0,
    dataDir: data,
    webDir: resolve('build/desktop/web'),
    playMode: 'test',
  });
  const worker = new WorkerBotExecutor(resolve('build/desktop/bot-worker.cjs'));
  let peak = process.memoryUsage().heapUsed,
    actions = 0;
  const phases = new Set(),
    memories = new Map();
  const sample = () => {
    peak = Math.max(peak, process.memoryUsage().heapUsed);
  };
  const timer = setInterval(sample, 50);
  const send = async (token, command) => {
    const view = service.room.view(token);
    const result = await service.room.command(token, {
      actionId: randomUUID(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command,
    });
    if (!result.ok) throw new Error(result.reason);
    sample();
  };
  try {
    await service.listen();
    if (childGame === 'platform') {
      sample();
      process.send({
        gameId: 'platform',
        result: 'passed',
        serviceHeapBytes: peak,
        scope:
          'Actual shared service after startup, no selected game or strategy loaded.',
      });
    } else {
      await send(service.hostToken, { type: 'select-game', gameId: childGame });
      const tokens = [];
      for (let i = 0; i < module.catalog.max; i++) {
        const joined = await service.room.join('Budget seat ' + i);
        tokens.push(joined.token);
        await send(joined.token, { type: 'ready', ready: true });
      }
      await send(service.hostToken, { type: 'start' });
      while (actions < 6000) {
        const publicView = service.room.view(service.hostToken);
        phases.add(publicView.gameView?.phase ?? 'none');
        if (publicView.status === 'ended') break;
        if (publicView.lifecycleActions.length) {
          await send(service.hostToken, {
            type: 'lifecycle',
            action: publicView.lifecycleActions[0],
          });
          actions++;
          continue;
        }
        const acting = tokens
          .map((token) => ({ token, view: service.room.view(token) }))
          .find((item) => item.view.decisionId && item.view.actions.length);
        if (!acting)
          throw new Error('No authorized decision during budget match');
        const seatId = acting.view.self.seatId;
        const result = await worker.execute(
          {
            gameId: childGame,
            view: acting.view.gameView,
            actions: acting.view.actions,
            decision: { id: acting.view.decisionId, seatId },
            data: {
              id: bot.id,
              version: bot.version,
              rulesVersion: bot.rulesVersion,
              memory: memories.get(seatId) ?? null,
              random: (1234567 + actions * 37) >>> 0,
              difficulty: 'juewu',
            },
          },
          AbortSignal.timeout(2000),
        );
        await send(acting.token, {
          type: 'game',
          decisionId: acting.view.decisionId,
          action: result.action,
        });
        memories.set(seatId, result.memory);
        actions++;
        if (bot.observe)
          for (const token of tokens) {
            const own = service.room.view(token);
            const id = own.self.seatId;
            memories.set(
              id,
              bot.observe({
                view: own.gameView,
                memory: memories.get(id) ?? null,
                seatId: id,
                difficulty: 'juewu',
              }),
            );
          }
      }
      const ended = service.room.view(service.hostToken).status === 'ended';
      if (!ended) throw new Error('Budget match exceeded bounded action limit');
      process.send({
        gameId: childGame,
        run: Number(argument('run')),
        result: 'passed',
        actions,
        phases: [...phases],
        serviceHeapBytes: peak,
        workerOldGenerationMiB: 32,
        scope:
          'Actual service/coordinator and saved full match with authorized projections and highest-level 32MiB Worker; sampled service heap includes resident game observation logic.',
      });
    }
  } finally {
    clearInterval(timer);
    await service.close();
  }
} else {
  await mkdir('tmp', { recursive: true });
  const work = await mkdtemp(resolve('tmp/game-budgets-'));
  const source = join(work, 'measure.ts');
  await writeFile(
    source,
    `export {createService} from '${resolve('apps/server/src/service').replaceAll('\\', '/')}';export {WorkerBotExecutor} from '${resolve('apps/server/src/bot-executor').replaceAll('\\', '/')}';`,
  );
  await build({
    entryPoints: [source],
    outfile: join(work, 'measure.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'warning',
  });
  await copyFile(
    resolve('build/desktop/modules.json'),
    join(work, 'modules.json'),
  );
  for (const folder of ['games', 'bots'])
    await cp(resolve('build/desktop', folder), join(work, folder), {
      recursive: true,
    });
  const output = verificationOutput('incremental-build-20261005', 'budgets');
  await mkdir(output, { recursive: true });
  const results = [];
  const platformOnly = process.argv.includes('--platform-only');
  for (const id of platformOnly
    ? ['platform']
    : ['pokemon-encounters', 'modern-art', 'power-grid'])
    for (let run = 0; run < (platformOnly ? 1 : 3); run++) {
      const result = await new Promise((done, reject) => {
        const child = fork(
          resolve('scripts/measure-game-heap.mjs'),
          [`--child=${id}`, `--work=${work}`, `--run=${run}`],
          { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true },
        );
        let record,
          errors = '';
        child.stderr.on('data', (chunk) => {
          errors = (errors + chunk).slice(-4000);
        });
        child.on('message', (value) => {
          record = value;
        });
        child.once('error', reject);
        child.once('exit', (code) =>
          code === 0 && record
            ? done(record)
            : reject(new Error(errors || 'Budget child failed')),
        );
      });
      results.push(result);
      await writeFile(
        join(
          output,
          platformOnly ? 'platform-heap.json' : 'service-heaps.json',
        ),
        JSON.stringify({ results }, null, 2) + '\n',
      );
      console.log(JSON.stringify(result));
    }
}
