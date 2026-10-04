import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { serveFixture } from './fixture-server.mjs';
import { verificationOutput } from './verification-output.mjs';

const evidenceName = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.ok(!evidenceName || /^[a-z0-9-]{1,40}$/.test(evidenceName));
const output = verificationOutput(
  'effects',
  ...(evidenceName ? [evidenceName] : []),
);
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
      import './games/pokemon-encounters/ui/screen.css';
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
        let player=kind==='draw-controls', motion=[], event;
        if(kind.startsWith('draw-controls')) state.discard.push(state.deck.pop());
        if(kind==='zero') {
          place(state,'S1',0,'ordinary-4#01'); place(state,'S1',3,'ordinary-4#02');
          place(state,'S1',1,'ordinary--2#01'); place(state,'S1',4,'special-mew#01');
          place(state,'S1',2,'special-ditto#01');
        }
        if(kind==='swap') event={id:1,kind:'effect-complete',text:'已交换',action:{actor:'S1',verb:'swap',ability:'special-snorlax',cardCategory:'special-snorlax',targets:[{seat:'S1',slots:[0,1]}]}};
        if(kind.startsWith('scene-')) {
          const theme=kind.slice(6);
          const mapping={mew:['draw','special-mew'],zapdos:['draw','special-zapdos'],charizard:['peek','special-charizard'],snorlax:['swap','special-snorlax'],'local-mew':['replace','special-mew'],decline:['decline','special-snorlax']};
          const [verb,ability]=mapping[theme];
          event={id:++ordinal,kind:verb==='draw'?'draw':'effect-complete',text:'已保存',action:{actor:'S1',verb,ability,cardCategory:ability,targets:[]}};
        }
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
        if(kind==='plain-draw') {
          for(const seat of seats) state.boards[seat][0].faceUp=true;
          const ordinary=state.deck.findIndex(id=>id.startsWith('ordinary-'));
          [state.deck[ordinary],state.deck[state.deck.length-1]]=[state.deck.at(-1),state.deck[ordinary]];
          const prior=project(state,{role:'public'});
          Object.assign(state,rules.apply(state,{type:'draw',source:'deck'},'S1',{seats,random:{next:()=>0.4}}).state);
          validateState(state,seats);
          motion=savedChanges(prior,project(state,{role:'public'}));
        }
        if(event) {
          state.events=[event]; state.step=event.id;
          const prior=structuredClone(before);
          if(kind==='coin') prior.events=[{...event,id:event.id-1}];
          motion=savedChanges(prior,project(state,{role:player?'player':'public',seatId:'S1'}));
        }
        const game=project(state,{role:player?'player':'public',seatId:'S1'});
        const names={S1:'视觉玩家一',S2:'视觉玩家二'};
        flushSync(()=>root.render(<main className={'game-screen pokemon-screen '+(player?'player':'public')}><header className='game-toolbar'><h1>宝可梦奇遇：皮卡丘和朋友们</h1></header><SavedMotion.Provider value={motion}><GameTable game={game} seats={seats.map(id=>({id,name:names[id],portrait,controller:'human',online:true}))} names={names} selfId={player?'S1':null} player={player} actions={player?(kind==='draw-controls'?[{type:'draw',source:'deck'},{type:'draw',source:'discard'}]:[{type:'close-peek'}]):[]} locked={false} paused={false} playing={true} selectionKey={kind} motionKey={kind+ordinal} choose={()=>{}} showFriends={()=>{}} /></SavedMotion.Provider></main>));
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
const fixtureServer = await serveFixture(work);
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: join(work, 'data'),
  TABLEMAX_PROTOTYPE_URL: fixtureServer.url,
};

const desktop = await launchDesktop({
  executablePath: desktopExecutable,
  args: ['--foundation-test'],
  env,
});
const evidence = {
  scope:
    'Hidden WebView2 rendering of production GameTable and authorized project() views. Constructed visual fixtures, not natural gameplay. Joint result passes production state validation.',
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
    await page.locator('.saved-action-trails .saved-trail').count(),
    2,
  );
  assert.equal(
    await page.locator('.saved-action-trails .target-mote').count(),
    12,
  );
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
  await page.evaluate(() => window.showEffect('plain-draw'));
  const drawTrail = page.locator('.saved-action-trails .saved-trail');
  assert.equal(await drawTrail.count(), 1);
  const endpoints = await drawTrail.evaluate((element) => {
    const svg = element.closest('svg').getBoundingClientRect();
    const center = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [
        rect.x + rect.width / 2 - svg.x,
        rect.y + rect.height / 2 - svg.y,
      ];
    };
    const from = element.getPointAtLength(0);
    const to = element.getPointAtLength(element.getTotalLength());
    return {
      from: [from.x, from.y],
      to: [to.x, to.y],
      deck: center('.deck-pile .pokemon-card'),
      held: center('.held-pile .pokemon-card'),
      pointerEvents: getComputedStyle(element.closest('svg')).pointerEvents,
      ariaHidden: element.closest('svg').getAttribute('aria-hidden'),
    };
  });
  assert.ok(
    endpoints.from.every((value, i) => Math.abs(value - endpoints.deck[i]) < 1),
  );
  assert.ok(
    endpoints.to.every((value, i) => Math.abs(value - endpoints.held[i]) < 1),
  );
  assert.equal(endpoints.pointerEvents, 'none');
  assert.equal(endpoints.ariaHidden, 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.showEffect('plain-draw'));
  assert.equal(await page.locator('.saved-action-trails path').count(), 0);
  assert.equal(await page.locator('.saved-action-trails').isVisible(), false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.showEffect('zero'));
  assert.equal(await page.locator('.saved-action-trails').count(), 0);
  evidence.checks.push(
    'Legal ordinary draw renders one decorative deck-to-held trajectory with measured endpoints; reduced motion and cleared motion remove it',
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
  await page.evaluate(() => window.showEffect('draw-controls'));
  assert.equal(await page.locator('.held-placeholder').count(), 0);
  const quiet = await page.locator('.held-zone').boundingBox();
  assert.ok(quiet.width <= 240, 'Empty temporary storage must stay compact');
  for (const name of ['从牌库取牌', '从弃牌顶取牌']) {
    const draw = page.getByRole('button', { name, exact: true });
    assert.equal(await draw.isEnabled(), true);
    assert.equal(await draw.locator('.take-border').isVisible(), true);
    const target = await draw.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return {
        width: rect.width,
        height: rect.height,
        uncovered: !!hit && element.contains(hit),
      };
    });
    assert.ok(
      target.width >= 44 && target.height >= 44 && target.uncovered,
      `${name}: visible, uncovered touch target with an actionable cue`,
    );
  }
  const border = page.locator('.take-border rect').first();
  const offset = await border.evaluate(
    (e) => getComputedStyle(e).strokeDashoffset,
  );
  await page.waitForTimeout(100);
  assert.notEqual(
    await border.evaluate((e) => getComputedStyle(e).strokeDashoffset),
    offset,
  );
  const progress = await page.getByRole('progressbar').evaluate((element) => {
    const current = element.querySelector('[aria-current="step"]');
    const track = current?.querySelector('.progress-track');
    const label = current?.querySelector('.progress-label');
    const rect = track?.getBoundingClientRect();
    return {
      minimum: Number(element.getAttribute('aria-valuemin')),
      maximum: Number(element.getAttribute('aria-valuemax')),
      value: Number(element.getAttribute('aria-valuenow')),
      description: element.getAttribute('aria-valuetext'),
      label: label?.textContent.trim(),
      track: rect ? { width: rect.width, height: rect.height } : null,
      striped:
        !!track &&
        [undefined, '::before', '::after'].some((pseudo) =>
          /linear-gradient\(/.test(
            getComputedStyle(track, pseudo).backgroundImage,
          ),
        ),
      interactive: element.querySelectorAll('button,a,input,select').length,
    };
  });
  assert.ok(
    progress.maximum > progress.minimum &&
      progress.value >= progress.minimum &&
      progress.value <= progress.maximum &&
      progress.description?.length > 0 &&
      progress.label?.length > 0,
    'Compact progress retains its current-step label and accessible status',
  );
  assert.ok(
    progress.track?.width > 0 && progress.track.height > 0 && progress.striped,
    'Current step uses a visible striped rectangle',
  );
  assert.equal(progress.interactive, 0, 'Progress remains status-only');
  evidence.progress = progress;
  await capture('compact-action-targets');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await border.evaluate((e) => getComputedStyle(e).animationName),
    'none',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  evidence.checks.push(
    'Compact quiet empty storage, discard-owned gallery control, visible striped status-only progress and uncovered touchable draw controls with moving dashed borders and static reduced-motion fallback',
  );
  await page.evaluate(() => window.showEffect('draw-controls-public'));
  assert.equal(await page.locator('.card-piles .discard-control').count(), 1);
  await capture('desktop-action-targets');
  await page.evaluate(() => window.showEffect('peek-owner'));
  assert.equal(await page.locator('.peek-flame').count(), 1);
  assert.equal(await page.locator('.peek-flame .flame-edge').count(), 4);
  const coverage = await page.locator('.private-peek-card').evaluate((e) => {
    const card = e.getBoundingClientRect();
    return [...e.querySelectorAll('.flame-edge')].map((edge) => {
      const r = edge.getBoundingClientRect();
      return (
        r.left < card.right &&
        r.right > card.left &&
        r.top < card.bottom &&
        r.bottom > card.top
      );
    });
  });
  assert.ok(coverage.every(Boolean), 'All four flame edges surround the card');

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
  assert.equal(await page.locator('.winner-board-sweep').count(), 2);
  assert.equal(await page.locator('.win-pips .newly-earned').count(), 2);
  assert.equal(await page.locator('.round-banner > div').isVisible(), true);
  assert.equal(
    await page.getByRole('img', { name: '大局赢家皇冠', exact: true }).count(),
    2,
  );
  assert.ok(
    (await page.locator('.match-fireworks .firework-spark').count()) > 0,
    'Match result creates visible celebration particles',
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
  assert.ok(
    await page.evaluate(() =>
      window.effectAnimations.some((name) => name.startsWith('firework-')),
    ),
    'Saved match result actually starts its celebration animation',
  );
  await capture('joint-winner-fireworks');
  evidence.checks.push(
    'Validated two-seat joint match result renders both crowns and animated celebration particles over the entire viewport',
  );
  for (const theme of ['mew', 'zapdos', 'snorlax', 'charizard']) {
    await page.evaluate((theme) => {
      window.effectAnimations = [];
      return window.showEffect('scene-' + theme);
    }, theme);
    assert.equal(
      await page.locator('.pokemon-scene').getAttribute('data-scene'),
      theme,
    );
    await page.waitForFunction(() =>
      window.effectAnimations.includes('pokemon-scene-fade'),
    );
    assert.equal(
      await page
        .locator('.pokemon-scene')
        .evaluate((el) => getComputedStyle(el).pointerEvents),
      'none',
    );
    await capture('scene-' + theme);
  }
  for (const followup of ['local-mew', 'decline']) {
    await page.evaluate((kind) => window.showEffect('scene-' + kind), followup);
    assert.equal(
      await page.locator('.pokemon-scene').count(),
      0,
      'Follow-up decisions do not repeat full-screen entrances',
    );
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.showEffect('scene-charizard'));
  assert.equal(
    await page
      .locator('.pokemon-scene')
      .evaluate((el) => getComputedStyle(el).display),
    'none',
  );
  evidence.checks.push(
    'Decisive saved scenes actually animate; follow-ups do not repeat; reduced motion hides screen decorations.',
  );
  assert.deepEqual(evidence.errors, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  await desktop.close();
  await fixtureServer.close();
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
