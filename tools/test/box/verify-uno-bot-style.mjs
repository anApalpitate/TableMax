import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'vite';
import { tsImport } from 'tsx/esm/api';
import { projectGameDetails } from '../../../packages/game-sdk/src/metadata.mjs';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
const run = process.argv.find((x) => x.startsWith('--evidence='))?.slice(11);
assert.match(run ?? '', /^[a-z0-9-]+$/);
const output = resolve('artifacts/maintenance/bot-rise-mischief-20261126', run);
await mkdir(output, { recursive: true });
const taskRoot = resolve(
  'tmp',
  process.env.TABLEMAX_TASK_ID ?? `bot-style-${run}`,
);
await mkdir(taskRoot, { recursive: true });
const work = await mkdtemp(join(taskRoot, 'fixture-'));
const report = { checks: [], screenshots: [], errors: [] };
const fullCatalog = process.argv.includes('--catalog');
const playables = [];
if (fullCatalog) {
  const { createGameRegistry } = await tsImport(
    '../../../apps/server/src/game-registry.ts',
    import.meta.url,
  );
  const { RoomCoordinator } = await tsImport(
    '../../../packages/platform-core/src/room.ts',
    import.meta.url,
  );
  const { SqliteSaveRepository } = await tsImport(
    '../../../apps/server/src/save-repository.ts',
    import.meta.url,
  );
  const registry = createGameRegistry();
  for (const entry of registry.catalog()) {
    const variants = entry.variants?.length
      ? entry.variants.map(({ id }) => id)
      : [undefined];
    for (const variantId of variants) {
      const { rules, bot } = await registry.load(entry.id, variantId);
      const data = await mkdtemp(join(work, 'catalog-db-'));
      let repository = new SqliteSaveRepository(data);
      const open = (hostToken) =>
        new RoomCoordinator(
          rules,
          bot,
          repository,
          hostToken,
          'test',
          registry,
          undefined,
          variantId,
        );
      let room = open();
      const send = (command) => {
        const { instanceId, revision, branch } = room.view(room.hostToken);
        return room.command(room.hostToken, {
          actionId: randomUUID(),
          instanceId,
          revision,
          branch,
          command,
        });
      };
      try {
        for (let index = 0; index < rules.manifest.players.min; index++) {
          assert.equal(
            (
              await send({
                type: 'add-bot',
                name: '验证电脑' + (index + 1),
                difficulty: 'default',
              })
            ).ok,
            true,
          );
        }
        const first = room.view(room.hostToken).seats[0];
        const original =
          entry.id === 'pokemon-encounters' && variantId === 'original';
        const choose = (difficulty) =>
          send({ type: 'set-bot-difficulty', seatId: first.id, difficulty });
        if (original) {
          const denied = await choose('mischief');
          assert.equal(denied.ok, false);
          assert.equal(denied.reason, 'unsupported-bot-difficulty');
        }
        const saved = original ? 'juewu' : 'mischief';
        assert.equal((await choose(saved)).ok, true);
        const lobby = room.view(room.hostToken);
        assert.equal((await send({ type: 'start' })).ok, true);
        assert.equal(repository.load().seats[0].botDifficulty, saved);
        const hostToken = room.hostToken;
        repository.close();
        repository = new SqliteSaveRepository(data);
        room = open(hostToken);
        const restored = room.view(room.hostToken);
        assert.equal(restored.restored, true);
        assert.equal(restored.status, 'playing');
        assert.equal(restored.game.variantId, lobby.game.variantId);
        assert.equal(restored.seats[0].botDifficulty, saved);
        assert.deepEqual(
          restored.game.botDifficulties,
          lobby.game.botDifficulties,
        );
        playables.push({
          id: entry.id,
          variantId,
          name: lobby.game.name,
          capacity: lobby.game.max,
          strategy: bot.version,
          levels: lobby.game.botDifficulties,
          lobbySeats: lobby.seats,
          restoredSeats: restored.seats,
          seatId: first.id,
        });
      } finally {
        repository.close();
      }
    }
  }
  assert.equal(playables.length, 9);
}
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
import {BoxScreen} from ${JSON.stringify(resolve('apps/web/src/screens/BoxScreen.tsx'))};
import {AVATAR_PRESETS} from ${JSON.stringify(resolve('packages/protocol/src/index.ts'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-lobby.css'))};
const root=createRoot(document.getElementById('root')); window.commands=[];
let options={};
window.renderBox=(patch={})=>{options={...options,...patch};const o=options;
const seats=o.sourceSeats??Array.from({length:o.joining?0:(o.count??3)},(_,i)=>({id:'seat-'+i,name:o.long?(i%2?'Abcdefghijklmnop':'大家一起开心玩耍'):i===0?'小明':'朋友'+i,avatarId:AVATAR_PRESETS[i%AVATAR_PRESETS.length].id,ready:i===0?!!o.ready:true,online:i!==1,controller:i===2?'bot':'human',botDifficulty:i===2?(o.botSeatStyle??'default'):null}));
const role=o.role??'player';
const view={id:'fixture',name:'聚会牌桌',status:o.status??'lobby',joinOpen:!o.closed,playMode:'play',...(o.botLearning?{botLearning:o.botLearning}:{}),self:{role,seatId:role==='player'?(seats[0]?.id??null):null},seats,ownerSeatId:o.owner?'seat-0':null,paused:!!o.paused,lifecycleActions:o.status==='playing'?[{type:'next'}]:[],botError:null,gameView:o.status==='playing'||o.status==='ended'?{}:null,capabilities:{manage:false,manageSeats:false},game:{id:o.game??'uno',name:o.gameName??'UNO',variantId:o.variantId,min:2,max:o.capacity??6,...(o.botLevels?{botDifficulties:o.botLevels}:{})}};
const session={role,view,self:role!=='player'||o.joining?null:seats[0],isHost:role==='host',canControl:role==='host'||!!o.owner,canManageSeats:role==='host'||!!o.owner,locked:!!o.closed,busy:!!o.busy,connected:o.connected!==false,credential:o.joining?null:'fixture',name:'小明',message:o.message??'',messageKind:o.kind??'saved',errorId:'',admissionPending:!!o.pending,awaitingConfirmation:!!o.awaiting,admissionAvatarId:null,admissionAvatarImage:null,addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true},setName(){},join(){window.commands.push({type:'join'})},retry(){window.commands.push({type:'retry'})},retryAdmission(){window.commands.push({type:'retryAdmission'})},setPlayerCredential(){},command(c){window.commands.push(c)}};
flushSync(()=>root.render(<BoxScreen session={session}/>));};window.renderBox();
`,
);
await build({
  configFile: false,
  root: work,
  plugins: [leanCatalogPlugin(), react()],
  resolve: {
    alias: {
      react: resolve('apps/web/node_modules/react'),
      'react-dom': resolve('apps/web/node_modules/react-dom'),
    },
  },
  build: { outDir: join(work, 'bundle'), target: 'chrome110' },
  logLevel: 'error',
});
for (const id of new Set(playables.map((game) => game.id))) {
  const manifest = JSON.parse(
    await readFile(resolve('games', id, 'game-module.json'), 'utf8'),
  );
  const destination = join(work, 'bundle', 'games', id, 'web');
  await mkdir(destination, { recursive: true });
  await writeFile(
    join(destination, 'details.json'),
    JSON.stringify(projectGameDetails(manifest)),
  );
}
const server = await serveFixture(join(work, 'bundle'));
const browser = await launchTestBrowser({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(server.url);
  await page.evaluate(
    () => (document.documentElement.dataset.playerDisplay = 'wide'),
  );
  await page.waitForFunction(() => !!window.renderBox);
  const render = async (o) => {
    await page.evaluate((o) => window.renderBox(o), o);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await render({
    role: 'host',
    status: 'lobby',
    botLevels: ['default', 'doubao', 'juewu', 'mischief'],
    botSeatStyle: 'mischief',
  });
  const styleSelect = page.locator('#bot-difficulty');
  await styleSelect.selectOption('mischief');
  await page.getByRole('button', { name: '添加人机' }).click();
  assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), {
    type: 'add-bot',
    name: '捣蛋王1',
    difficulty: 'mischief',
  });
  assert.equal(
    await page.locator('.room-table__difficulty--mischief').textContent(),
    '捣蛋王人机',
  );
  const styleScreenshot = join(output, 'uno-bot-style-390.png');
  await page.screenshot({ path: styleScreenshot });
  report.screenshots.push(styleScreenshot);
  await render({
    game: 'pokemon-encounters',
    variantId: 'original',
    botLevels: ['default', 'doubao', 'juewu'],
    botSeatStyle: 'default',
  });
  assert.equal(
    await styleSelect.locator('option[value="mischief"]').count(),
    0,
  );
  assert.equal(await styleSelect.inputValue(), 'default');
  if (fullCatalog) {
    const checked = [];
    const toValues = (elements) => elements.map((element) => element.value);
    const restoredLabels = {
      default: '默认',
      doubao: '豆包',
      juewu: '绝悟',
      mischief: '捣蛋王',
    };
    for (const game of playables) {
      const original =
        game.id === 'pokemon-encounters' && game.variantId === 'original';
      const levels = [
        'default',
        'doubao',
        'juewu',
        ...(original ? [] : ['mischief']),
      ];
      assert.deepEqual(game.levels, levels);
      const saved = original ? 'juewu' : 'mischief';
      const fixture = {
        game: game.id,
        gameName: game.name,
        variantId: game.variantId ?? null,
        capacity: game.capacity,
        botLevels: game.levels,
        sourceSeats: game.lobbySeats,
      };
      await render({ ...fixture, role: 'host', status: 'lobby' });
      assert.deepEqual(
        await styleSelect.locator('option').evaluateAll(toValues),
        levels,
      );
      if (original) assert.equal(await styleSelect.inputValue(), 'default');
      else await styleSelect.selectOption('mischief');

      await page
        .getByRole('button', { name: '人机等级说明', exact: true })
        .click();
      const information = page.getByRole('dialog', {
        name: '人机等级说明',
        exact: true,
      });
      await information
        .getByRole('heading', { name: '默认', exact: true })
        .waitFor();
      assert.equal(
        await information
          .getByRole('heading', { name: '捣蛋王', exact: true })
          .count(),
        original ? 0 : 1,
      );
      assert.equal(
        await information
          .getByText('独立对局风格，倾向干扰场上领先的对手。', { exact: true })
          .count(),
        original ? 0 : 1,
      );
      await page.keyboard.press('Escape');
      await information.waitFor({ state: 'hidden' });

      const settings = page.getByRole('button', {
        name: '座位设置',
        exact: true,
      });
      await settings.click();
      const seats = page.getByRole('dialog', { name: '座位设置', exact: true });
      const difficulty = seats.locator('select.seat-difficulty').first();
      assert.deepEqual(
        await difficulty.locator('option').evaluateAll(toValues),
        levels,
      );
      await difficulty.selectOption('doubao');
      assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), {
        type: 'set-bot-difficulty',
        seatId: game.seatId,
        difficulty: 'doubao',
      });
      await render({
        ...fixture,
        status: 'playing',
        sourceSeats: game.restoredSeats,
      });
      assert.equal(await difficulty.count(), 0);
      assert.equal(
        await seats.locator('.seat-settings-level').first().textContent(),
        restoredLabels[saved] + '人机',
      );
      assert.equal(await styleSelect.count(), 0);
      await page.keyboard.press('Escape');
      await seats.waitFor({ state: 'hidden' });
      checked.push({
        gameId: game.id,
        variantId: game.variantId ?? null,
        strategy: game.strategy,
        levels,
        saved,
        sqliteRestored: true,
      });
    }
    report.playables = checked;
    report.checks.push(
      'All source playables expose their registered styles, show explanations and keep SQLite-restored styles read-only',
    );
  }
  await render({
    game: 'uno',
    gameName: 'UNO',
    variantId: null,
    status: 'lobby',
    botLevels: null,
    botSeatStyle: null,
    sourceSeats: null,
  });
  report.checks.push(
    'UNO style is selectable only when advertised and resets across games',
  );
  const botLearning = {
    capture: null,
    training: false,
    defaultCapture: false,
    captureEnabled: false,
    captureState: 'off',
  };
  await render({ role: 'host', botLearning });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '游戏', exact: true }).click();
  const capture = page.getByRole('combobox', { name: '人机样本采集' });
  assert.equal(await capture.inputValue(), 'default');
  await capture.selectOption('on');
  assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), {
    type: 'set-bot-learning',
    options: { capture: true, training: false },
  });
  await render({
    botLearning: {
      ...botLearning,
      capture: true,
      captureEnabled: true,
      captureState: 'ready',
    },
  });
  await page.getByRole('switch', { name: '空闲训练' }).click();
  assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), {
    type: 'set-bot-learning',
    options: { capture: true, training: true },
  });
  const learningScreenshot = join(output, 'host-learning-390.png');
  await page.screenshot({ path: learningScreenshot });
  report.screenshots.push(learningScreenshot);
  await render({ role: 'player', owner: true, botLearning });
  assert.equal(await capture.count(), 0);
  report.checks.push(
    'learning preferences are independent, host-only and visible at 390 CSS pixels',
  );
  assert.deepEqual(report.errors, []);
  report.sources = {};
  for (const path of [
    'apps/web/src/screens/BoxScreen.tsx',
    'apps/web/src/content/bot-difficulty.ts',
    'apps/web/src/components/BotLearningSettings.tsx',
    'apps/web/src/components/CountdownSettings.tsx',
    'apps/web/src/components/RoomTable.tsx',
    'apps/web/src/components/BotInformation.tsx',
    'apps/web/src/components/SeatSettings.tsx',
    'apps/server/src/game-registry.ts',
    'apps/server/src/save-repository.ts',
    'packages/platform-core/src/room.ts',
    'packages/platform-core/src/room-projection.ts',
    'tools/test/box/verify-uno-bot-style.mjs',
  ])
    report.sources[path] = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  throw error;
} finally {
  const reportText = JSON.stringify(report, null, 2);
  await writeFile(join(output, 'report.json'), reportText);
  if (process.env.TABLEMAX_TEST_OUTPUT_DIR)
    await writeFile(
      join(process.env.TABLEMAX_TEST_OUTPUT_DIR, 'report.json'),
      reportText,
    );
  await browser.close();
  await server.close();
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      output,
    }),
  );
}
