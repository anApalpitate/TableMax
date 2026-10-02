import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const output = resolve('artifacts/maintenance/v1.6.0/effects');
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/game-ui-'));
await build({
  stdin: {
    resolveDir: resolve('.'),
    sourcefile: 'effect-fixture.tsx',
    loader: 'tsx',
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { flushSync } from 'react-dom';
      import { GameTable } from './games/pokemon-encounters/ui/table';
      import { SavedMotion, savedChanges } from './games/pokemon-encounters/ui/motion';
      import { rules } from './games/pokemon-encounters/rules';
      import { project } from './games/pokemon-encounters/rules/project';
      import { scoreBoard } from './games/pokemon-encounters/rules/scoring';
      import { validateState } from './games/pokemon-encounters/rules/state';
      import portrait from './assets/games/pokemon-encounters/characters/ordinary--2-official.png';
      import './apps/web/src/styles.css';
      import './apps/web/src/screens/game-screen.css';
      import './games/pokemon-encounters/ui/style.css';
      const root=createRoot(document.getElementById('root'));
      const seats=['S1','S2'];
      const initial=()=>rules.initialize({seats, random:{next:()=>0.4}});
      function place(state, seat, slot, wanted) {
        const old=state.boards[seat][slot].instanceId;
        for(const board of Object.values(state.boards)) for(const card of board) if(card.instanceId===wanted) card.instanceId=old;
        state.deck=state.deck.map(id=>id===wanted?old:id);
        state.discard=state.discard.map(id=>id===wanted?old:id);
        state.boards[seat][slot]={instanceId:wanted,faceUp:true};
      }
      let ordinal=0;
      window.effectAnimations=[];
      document.addEventListener('animationstart',event=>window.effectAnimations.push(event.animationName));
      window.showEffect=async function(kind) {
        const state=initial();
        state.initialDone=[...seats]; state.phase='draw';
        state.turnSeat='S1';
        let player=false, motion=[], event;
        if(kind==='zero') {
          place(state,'S1',0,'ordinary-4#01'); place(state,'S1',3,'ordinary-4#02');
          place(state,'S1',1,'ordinary--2#01'); place(state,'S1',4,'special-mew#01');
          place(state,'S1',2,'special-ditto#01');
        }
        if(kind==='swap') event={id:1,kind:'effect-complete',text:'已交换',action:{actor:'S1',verb:'swap',ability:'special-snorlax',cardCategory:'special-snorlax',targets:[{seat:'S1',slots:[0,1]}]}};
        if(kind==='coin') {
          state.coin='meowth';
          event={id:++ordinal,kind:'draw',text:'已保存',action:{actor:'S1',verb:'draw',ability:'special-team-rocket',cardCategory:'special-team-rocket',targets:[]}};
        }
        if(kind==='peek-owner'||kind==='peek-public') {
          state.phase='charizard-view'; state.peekSlot=0; player=kind==='peek-owner';
          event={id:1,kind:'effect-complete',text:'查看暗牌',action:{actor:'S1',verb:'peek',ability:'special-charizard',cardCategory:'special-charizard',targets:[{seat:'S1',slots:[]}]}};
        }
        if(kind==='rocket-return') {
          place(state,'S1',2,'special-team-rocket#01');
          event={id:1,kind:'effect-complete',text:'传牌',action:{actor:'S1',verb:'zapdos-pass',ability:'special-zapdos',cardCategory:'special-zapdos',targets:[{seat:'S1',slots:[2]}]}};
        }
        if(kind==='joint-win') {
          [['ordinary-1','ordinary-3','ordinary-4'],['ordinary-5','ordinary-6','ordinary-7']].forEach((types,seat)=>types.forEach((type,col)=>{place(state,seats[seat],col,type+'#01');place(state,seats[seat],col+3,type+'#02');}));
          state.phase='match-result'; state.matchWinners=[...seats]; state.winsBySeat={S1:3,S2:3};
          state.roundResult={scores:Object.fromEntries(seats.map(seat=>[seat,scoreBoard(state.boards[seat].map(slot=>slot.instanceId))])),winners:[...seats]};
          validateState(state,seats);
          motion=['@result'];
        }
        const before=project(state,{role:player?'player':'public',seatId:'S1'});
        if(event) {
          state.events=[event]; state.step=event.id;
          const prior=structuredClone(before);
          if(kind==='coin') prior.events=[{...event,id:event.id-1}];
          motion=savedChanges(prior,project(state,{role:player?'player':'public',seatId:'S1'}));
        }
        const game=project(state,{role:player?'player':'public',seatId:'S1'});
        const names={S1:'视觉玩家一',S2:'视觉玩家二'};
        flushSync(()=>root.render(<main className={'game-screen '+(player?'player':'public')}><SavedMotion.Provider value={motion}><GameTable game={game} seats={seats.map(id=>({id,name:names[id],portrait,controller:'human',online:true}))} names={names} selfId={player?'S1':null} player={player} actions={player?[{type:'close-peek'}]:[]} locked={false} paused={false} playing={true} selectionKey={kind} motionKey={kind+ordinal} choose={()=>{}} showFriends={()=>{}} /></SavedMotion.Provider></main>));
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return {phase:game.phase,matchWinners:game.matchWinners,motion,publicPeek:game.peek};
      };
    `,
  },
  outfile: join(work, 'fixture.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  nodePaths: [resolve('apps/web/node_modules')],
  plugins: [
    {
      name: 'fixture-vite-assets',
      setup(builder) {
        builder.onLoad(
          { filter: /pokemon-encounters[\\/]catalog\.ts$/ },
          async ({ path }) => {
            const source = await readFile(path, 'utf8');
            const files = (
              await readdir(join(dirname(path), 'characters'))
            ).filter((name) => /\.(png|webp)$/.test(name));
            const imports = files
              .map(
                (name, index) =>
                  `import art${index} from ${JSON.stringify('./characters/' + name)};`,
              )
              .join('\n');
            const table =
              'const images={' +
              files
                .map(
                  (name, index) =>
                    JSON.stringify('./characters/' + name) + ':art' + index,
                )
                .join(',') +
              '};\n';
            return {
              contents:
                imports +
                '\n' +
                table +
                source.slice(source.indexOf('const frames')),
              loader: 'ts',
              resolveDir: dirname(path),
            };
          },
        );
      },
    },
  ],
  jsx: 'automatic',
  loader: { '.webp': 'file', '.png': 'file', '.woff2': 'file', '.svg': 'file' },
  logLevel: 'silent',
});
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="fixture.css"><div id="root"></div><script src="fixture.js"></script>',
);
await writeFile(
  join(work, 'main.cjs'),
  `const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({show:false,frame:false,width:1280,height:720,webPreferences:{offscreen:true,backgroundThrottling:false}});w.loadFile(${JSON.stringify(join(work, 'index.html'))});});`,
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await _electron.launch({
  executablePath: require('electron'),
  args: [join(work, 'main.cjs')],
  env,
});
const evidence = {
  scope:
    'Hidden Electron rendering of production GameTable and authorized project() views. Constructed visual fixtures, not natural gameplay. Joint result passes production state validation.',
  checks: [],
  errors: [],
};
try {
  const page = await desktop.firstWindow();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  await page.waitForFunction(() => typeof window.showEffect === 'function');
  const capture = async (name) => {
    await page.waitForFunction(() =>
      [...document.images].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    const window = await desktop.browserWindow(page);
    assert.equal(await window.evaluate((w) => w.isVisible()), false);
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
  };
  await page.evaluate(() => window.showEffect('zero'));
  assert.equal(
    await page.locator('[data-seat="S1"] .zero-column-badge').count(),
    2,
  );
  assert.equal(await page.locator('[data-slot="S1:2"].zero-column').count(), 0);
  await capture('public-zero-columns');
  evidence.checks.push(
    'Equal 4/4 and -2/+2 columns visibly marked; unknown Ditto column unmarked',
  );
  await page.evaluate(() => window.showEffect('swap'));
  assert.equal(
    await page.locator('.theme-snorlax .pokemon-card.back').count(),
    2,
  );
  assert.equal(
    await page.locator('.theme-snorlax .card-theme-mark').count(),
    2,
  );
  await capture('hidden-snorlax-swap');
  evidence.checks.push(
    'Both unchanged hidden card faces receive Snorlax target animation from saved action targets',
  );
  await page.evaluate(() => window.showEffect('coin'));
  await page.locator('.tossed-coin').waitFor();
  await page.waitForFunction(
    () =>
      window.effectAnimations.filter((name) => name === 'coin-toss').length ===
      1,
  );
  await page.evaluate(() => window.showEffect('coin'));
  await page.waitForFunction(
    () =>
      window.effectAnimations.filter((name) => name === 'coin-toss').length ===
      2,
  );
  assert.equal(
    await page.evaluate(
      () =>
        window.effectAnimations.filter((name) => name === 'coin-toss').length,
    ),
    2,
  );
  await capture('repeated-meowth-coin');
  evidence.checks.push(
    'Two consecutive saved draws with identical Meowth outcome both start coin animation',
  );
  await page.evaluate(() => window.showEffect('peek-owner'));
  assert.equal(await page.locator('.peek-flame').count(), 1);
  await capture('private-charizard-flame');
  await page.evaluate(() => window.showEffect('peek-public'));
  assert.equal(await page.locator('.peek-flame,.private-peek').count(), 0);
  assert.equal(await page.locator('.card-slot.action-target').count(), 0);
  evidence.checks.push(
    'Charizard flame and revealed face exist only in owner projection; public shows no slot target',
  );
  await page.evaluate(() => window.showEffect('rocket-return'));
  assert.equal(
    await page.locator('[data-slot="S1:2"] .rocket-return-mark').count(),
    1,
  );
  assert.equal(await page.locator('.tossed-coin').count(), 0);
  await capture('rocket-special-return');
  evidence.checks.push(
    'Special Rocket insertion shows R and return title without coin animation or rule trigger',
  );
  const winners = await page.evaluate(() => window.showEffect('joint-win'));
  assert.equal(winners.matchWinners.length, 2);
  assert.equal(
    await page.getByRole('img', { name: '大局赢家皇冠', exact: true }).count(),
    2,
  );
  assert.equal(
    await page.locator('.match-fireworks .firework-spark').count(),
    60,
  );
  const viewport = await page.locator('.match-fireworks').evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      width: r.width,
      height: r.height,
      viewport: [document.documentElement.clientWidth, innerHeight],
    };
  });
  assert.equal(viewport.width, viewport.viewport[0]);
  assert.equal(viewport.height, viewport.viewport[1]);
  await page.waitForTimeout(240);
  await capture('joint-winner-fireworks');
  evidence.checks.push(
    'Validated two-seat joint match result renders both crowns and 60 sparks over entire viewport',
  );
  assert.deepEqual(evidence.errors, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  await desktop.close();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    result: evidence.result,
    checks: evidence.checks.length,
    output,
  }),
);
