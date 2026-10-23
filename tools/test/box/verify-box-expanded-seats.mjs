import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../support/screenshots.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
const arg = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const phase = arg('phase');
assert.ok(
  ['before', 'after'].includes(phase),
  'Choose --phase=before or after',
);
const run = arg('run');
assert.match(run ?? '', /^[a-z0-9-]+$/);
const task = resolve(arg('task') ?? 'tmp/avalon-box-seats-20261024-d1');
assert.ok(task.startsWith(resolve('tmp') + sep));
const output = resolve(
  'artifacts/maintenance/avalon-box-seats-20261024-d1',
  run,
);
const work = join(task, run);
await mkdir(work, { recursive: true });
await mkdir(output, { recursive: true });
const browserTemp = join(task, 'browser-temp');
await mkdir(browserTemp, { recursive: true });
process.env.TEMP = browserTemp;
process.env.TMP = browserTemp;
const { launchTestBrowser } = await import('../support/browser-test.mjs');
const cssPath = resolve('apps/web/src/screens/box-lobby.css');
const baselinePath = join(task, 'baseline/apps/web/src/screens/box-lobby.css');
const frozenCss =
  phase === 'before' ? await readFile(baselinePath, 'utf8') : null;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const localPath = (path) => relative(resolve('.'), path).split(sep).join('/');
const report = {
  result: 'running',
  phase,
  run,
  task,
  output,
  bundle: join(work, 'bundle'),
  scope:
    'Actual BoxScreen and normal catalog Avalon max10 in a synthetic lobby session with protocol-valid names. Compatibility7/12 use explicitly synthetic capacity only; six uses normal UNO max6. Hidden muted Edge and loopback source fixture, not live service, saved-room, native DPI, physical-device, or installer acceptance. Before substitutes only the frozen HEAD box-lobby.css at module load; no overlay CSS.',
  failures: [],
  pending: [],
  checks: [],
  layouts: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
  inputs: {},
  verifierSha256: hash(await readFile(new URL(import.meta.url))),
};
const save = () =>
  writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
const sizes = [
  [320, 568],
  [390, 844],
  [844, 390],
  [1280, 720],
  [1920, 1080],
  [3840, 2160],
];
const roles = ['host', 'player'];
const compareIds = new Set([
  'host-10-5-1280x720',
  'host-10-5-1920x1080',
  'player-10-5-390x844',
  'host-10-10-1920x1080',
  'player-10-10-844x390',
]);
const matrix = [];
const add = (role, capacity, occupied, size) =>
  matrix.push({
    id: `${role}-${capacity}-${occupied}-${size.join('x')}`,
    role,
    capacity,
    occupied,
    size,
  });
for (const role of roles)
  for (const size of sizes) {
    if (phase === 'after')
      for (const occupied of [5, 10, 0]) add(role, 10, occupied, size);
    else
      for (const occupied of [5, 10])
        if (compareIds.has(`${role}-10-${occupied}-${size.join('x')}`))
          add(role, 10, occupied, size);
    add(role, 6, 5, size);
    if (phase === 'after' && [390, 1280, 1920].includes(size[0]))
      for (const capacity of [7, 12]) add(role, capacity, capacity, size);
  }
const selected = arg('cases')?.split(',') ?? [];
assert.ok(selected.every((id) => matrix.some((item) => item.id === id)));
const cases = matrix.filter(
  (item) => !selected.length || selected.includes(item.id),
);
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React,{useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{AVATAR_PRESETS,playerNameError}from ${JSON.stringify(resolve('packages/protocol/src/index.ts'))};
import{BoxScreen}from ${JSON.stringify(resolve('apps/web/src/screens/BoxScreen.tsx'))};
import{moduleCatalog}from ${JSON.stringify(resolve('apps/web/src/catalog.ts'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
import ${JSON.stringify(resolve('apps/web/src/components/overlay-panel.css'))};
const catalog=moduleCatalog.filter(m=>!m.internal).map(m=>m.catalog),avalon=catalog.find(g=>g.id==='avalon'),uno=catalog.find(g=>g.id==='uno');
if(avalon?.max!==10||uno?.max!==6)throw new Error('Unexpected normal catalog capacities');
const names=['中文昵称八字齐全','ABCDEFGHIJKLMNOP','朋友三号来入座啦','FriendFour123456','小伙伴五号来入座','FriendSix1234567','朋友七号来入座啦','FriendEight12345','朋友九号来入座啦','FriendTen1234567','朋友十一号来入座','Twelve1234567890'];
if(names.some(n=>playerNameError(n)))throw new Error('Fixture name violates protocol');
window.commands=[];
function App(){const[options,setOptions]=useState({role:'host',capacity:10,occupied:5}),[name,setName]=useState('朋友');
window.configureBox=next=>{window.commands=[];flushSync(()=>setOptions(next));};
const{role,capacity,occupied}=options;
const seats=Array.from({length:occupied},(_,i)=>({id:'seat-'+(i+1),name:names[i],avatarId:AVATAR_PRESETS[i%AVATAR_PRESETS.length].id,controller:i>=2&&i<=4?'bot':'human',botDifficulty:i===2?'default':i===3?'doubao':i===4?'juewu':undefined,online:i!==1&&i!==5,ready:i!==0&&i!==5}));
const self=role==='player'?(seats[seats.length-1]??null):null,game=capacity===10?avalon:capacity===6?uno:{...avalon,max:capacity,min:Math.min(5,capacity)};
const isHost=role==='host',view={revision:12,instanceId:'expanded-seats-fixture',branch:0,status:'lobby',game,catalog,seats,ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,self:{role,seatId:self?.id??null},capabilities:{manage:isHost,manageSeats:isHost,control:isHost}};
window.fixtureCase={role,capacity,occupied,seats,selfId:self?.id??null,gameId:game.id,gameMax:game.max,syntheticCapacity:capacity===7||capacity===12,normalAvalon:capacity===10};
const session={role,view,self,isHost,canControl:isHost,canManageSeats:isHost,locked:false,busy:false,connected:true,credential:'fixture',name,setName,message:'',messageKind:'none',errorId:'',admissionPending:false,admissionAvatarId:null,admissionAvatarImage:null,awaitingConfirmation:false,join(){},retry(){},retryAdmission(){},setPlayerCredential(){},command:c=>window.commands.push(c),addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true}};
return <BoxScreen session={session}/>;}
createRoot(document.getElementById('root')).render(<App/>);
`,
);
let moduleFiles = [],
  server,
  browser,
  page;
const fingerprint = async () =>
  Promise.all(
    moduleFiles.map(async (path) => ({
      path: localPath(path),
      sha256: hash(
        path === cssPath && phase === 'before'
          ? frozenCss
          : await readFile(path),
      ),
      ...(path === cssPath && phase === 'before'
        ? { frozenSource: localPath(baselinePath) }
        : {}),
    })),
  );
try {
  await build({
    configFile: false,
    root: work,
    plugins: [
      {
        name: 'frozen-before-css',
        enforce: 'pre',
        load(id) {
          if (
            phase === 'before' &&
            id.replaceAll('\\', '/').split('?')[0] ===
              cssPath.replaceAll('\\', '/')
          )
            return frozenCss;
        },
      },
      react(),
      {
        name: 'record-fixture-inputs',
        generateBundle() {
          moduleFiles = [...this.getModuleIds()]
            .map((id) => id.split('?')[0])
            .filter(
              (id) =>
                !id.startsWith('\0') &&
                id
                  .replaceAll('\\', '/')
                  .startsWith(resolve('.').replaceAll('\\', '/') + '/') &&
                !id.includes('node_modules') &&
                /\.(?:tsx?|css|json|png|webp|svg)$/.test(id),
            );
          moduleFiles = [
            ...new Set(moduleFiles.map((id) => resolve(id))),
          ].sort();
        },
      },
    ],
    resolve: {
      alias: {
        react: resolve('apps/web/node_modules/react'),
        'react-dom': resolve('apps/web/node_modules/react-dom'),
      },
    },
    build: {
      outDir: join(work, 'bundle'),
      emptyOutDir: false,
      target: ['chrome110', 'safari16'],
    },
    logLevel: 'error',
  });
  assert.ok(moduleFiles.includes(cssPath));
  report.inputs.before = await fingerprint();
  server = await serveFixture(report.bundle);
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  page = await browser.newPage({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(new URL(server.url).origin))
      report.externalRequests.push(request.url());
  });
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.configureBox === 'function');
  const beforeReport =
    phase === 'after' && arg('baseline-report')
      ? JSON.parse(await readFile(resolve(arg('baseline-report')), 'utf8'))
      : null;
  for (const item of cases) {
    if (report.failures.length >= 10) {
      report.pending.push(item.id);
      continue;
    }
    try {
      await page.setViewportSize({ width: item.size[0], height: item.size[1] });
      await page.evaluate((item) => {
        document.documentElement.dataset.playerDisplay =
          item.role === 'player' && innerWidth >= 1000 ? 'wide' : 'phone';
        window.configureBox(item);
        scrollTo(0, 0);
      }, item);
      await page.waitForFunction(
        (item) =>
          document
            .querySelector('.box-screen')
            ?.classList.contains(item.role) &&
          document.querySelector('.room-table')?.dataset.capacity ===
            String(item.capacity) &&
          document.querySelectorAll('.room-table__seat[data-seat-id]')
            .length === item.occupied,
        item,
      );
      await page.evaluate(async () => {
        await Promise.all(
          [...document.querySelectorAll('.room-table img')].map((image) =>
            image.decode().catch(() => {}),
          ),
        );
        await new Promise(requestAnimationFrame);
      });
      const layout = await page.evaluate(() => {
        const table = document.querySelector('.room-table'),
          grid = table.querySelector('.room-table__seats'),
          ts = getComputedStyle(table),
          gs = getComputedStyle(grid);
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        const seats = [...grid.children].map((el) => ({
          ...rect(el),
          position: Number(el.dataset.position),
          id: el.dataset.seatId ?? null,
          self: el.dataset.self === 'true',
          name: el.querySelector('.room-table__name')?.textContent ?? null,
          text: el.innerText,
          glyphs: [
            '.room-table__name',
            '.room-table__identity',
            '.room-table__ready',
          ]
            .map((selector) => {
              const node = el.querySelector(selector);
              if (!node) return null;
              const range = document.createRange();
              range.selectNodeContents(node);
              return { selector, ...rect(range) };
            })
            .filter(Boolean),
          nameClipped: Boolean(
            el.querySelector('.room-table__name') &&
            (el.querySelector('.room-table__name').scrollWidth >
              el.querySelector('.room-table__name').clientWidth + 1 ||
              el.querySelector('.room-table__name').scrollHeight >
                el.querySelector('.room-table__name').clientHeight + 1),
          ),
        }));
        return {
          fixture: window.fixtureCase,
          layout: table.dataset.layout,
          viewport: { width: innerWidth, height: innerHeight },
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          table: rect(table),
          containerWidth:
            table.clientWidth -
            parseFloat(ts.paddingLeft) -
            parseFloat(ts.paddingRight),
          grid: rect(grid),
          columns: gs.gridTemplateColumns.split(' ').map(Number.parseFloat),
          rows: gs.gridTemplateRows.split(' ').map(Number.parseFloat),
          rowGap: parseFloat(gs.rowGap),
          gap: parseFloat(gs.columnGap),
          seats,
          brokenImages: [...table.querySelectorAll('img')].filter(
            (i) => !i.complete || !i.naturalWidth,
          ).length,
          fonts: [
            ...table.querySelectorAll(
              '.room-table__name,.room-table__identity span,.room-table__ready,.room-table__seat--empty h3',
            ),
          ].map((el) => ({
            text: el.textContent,
            font: parseFloat(getComputedStyle(el).fontSize),
          })),
          commands: window.commands.length,
        };
      });
      report.layouts.push({ id: item.id, ...layout });
      assert.equal(layout.seats.length, item.capacity);
      assert.equal(
        layout.fixture.syntheticCapacity,
        [7, 12].includes(item.capacity),
      );
      if (item.capacity === 10) {
        assert.equal(layout.fixture.gameId, 'avalon');
        assert.equal(layout.fixture.normalAvalon, true);
      }
      if (phase === 'after') {
        assert.equal(layout.overflow, false, 'Page horizontal overflow');
        assert.equal(layout.brokenImages, 0, 'Avatar decoding');
        assert.equal(layout.layout, item.capacity > 6 ? 'grid' : 'table');
        assert.equal(
          layout.seats.filter((seat) => seat.self).length,
          item.role === 'player' && item.occupied ? 1 : 0,
        );
        if (item.capacity > 6) {
          const expected =
            layout.containerWidth >= 900
              ? 5
              : layout.containerWidth >= 720
                ? 4
                : layout.containerWidth >= 520
                  ? 3
                  : layout.containerWidth <= 249
                    ? 1
                    : 2;
          assert.equal(
            layout.columns.length,
            expected,
            'Columns follow actual room-seats container width',
          );
          for (const [index, seat] of layout.seats.entries()) {
            assert.ok(
              Math.abs(
                seat.height - layout.rows[Math.floor(index / expected)],
              ) <= 1,
              `Seat ${seat.position} height matches its grid row`,
            );
            assert.ok(
              seat.width >= layout.columns[index % expected] - 1,
              `Seat ${seat.position} must stretch across its track`,
            );
            assert.ok(seat.width >= 90, `Seat ${seat.position} collapsed`);
            assert.equal(
              seat.nameClipped,
              false,
              `Name ${seat.position} clipped`,
            );
            assert.ok(
              seat.x >= layout.grid.x - 1 &&
                seat.right <= layout.grid.right + 1 &&
                seat.y >= layout.grid.y - 1 &&
                seat.bottom <= layout.grid.bottom + 1,
              `Seat ${seat.position} escapes grid`,
            );
            for (const [glyphIndex, glyph] of seat.glyphs.entries()) {
              assert.ok(
                glyph.x >= seat.x - 1 &&
                  glyph.right <= seat.right + 1 &&
                  glyph.y >= seat.y - 1 &&
                  glyph.bottom <= seat.bottom + 1,
                `Seat ${seat.position} ${glyph.selector} glyphs escape card`,
              );
              for (const other of seat.glyphs.slice(glyphIndex + 1))
                assert.ok(
                  Math.min(glyph.right, other.right) -
                    Math.max(glyph.x, other.x) <=
                    1 ||
                    Math.min(glyph.bottom, other.bottom) -
                      Math.max(glyph.y, other.y) <=
                      1,
                  `Seat ${seat.position} ${glyph.selector}/${other.selector} glyphs overlap`,
                );
            }
            for (const other of layout.seats.slice(index + 1))
              assert.ok(
                Math.min(seat.right, other.right) - Math.max(seat.x, other.x) <=
                  1 ||
                  Math.min(seat.bottom, other.bottom) -
                    Math.max(seat.y, other.y) <=
                    1,
                `Seats ${seat.position}/${other.position} overlap`,
              );
          }
          for (const font of layout.fonts)
            assert.ok(font.font >= 16, `Information font ${font.text}`);
        } else if (beforeReport) {
          const original = beforeReport.layouts.find(
            (value) => value.id === item.id,
          );
          assert.ok(original, 'Six-seat baseline exists');
          assert.deepEqual(
            { table: layout.table, grid: layout.grid, seats: layout.seats },
            {
              table: original.table,
              grid: original.grid,
              seats: original.seats,
            },
            'Six-seat geometry/content is unchanged',
          );
        }
        for (const seat of await page.locator('.room-table__seat').all()) {
          await seat.evaluate((el) =>
            el.scrollIntoView({ block: 'center', inline: 'nearest' }),
          );
          const visible = await seat.evaluate((el) => {
            const r = el.getBoundingClientRect();
            let left = 0,
              right = innerWidth,
              top = 0,
              bottom = innerHeight;
            for (let p = el.parentElement; p; p = p.parentElement) {
              const s = getComputedStyle(p),
                b = p.getBoundingClientRect();
              if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) {
                left = Math.max(left, b.left);
                right = Math.min(right, b.right);
              }
              if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY)) {
                top = Math.max(top, b.top);
                bottom = Math.min(bottom, b.bottom);
              }
            }
            return (
              r.x >= left - 1 &&
              r.right <= right + 1 &&
              r.y >= top - 1 &&
              r.bottom <= bottom + 1
            );
          });
          assert.equal(
            visible,
            true,
            `Seat ${await seat.getAttribute('data-position')} is fully reachable by ordinary scrolling`,
          );
        }
        assert.equal(
          await page.evaluate(() => window.commands.length),
          0,
          'Viewing and scrolling issue no commands',
        );
      }
      await page.evaluate(() => scrollTo(0, 0));
      if (compareIds.has(item.id)) {
        const path = join(output, item.id + '.png');
        await captureBrowserScreenshot(page, { path, fullPage: true });
        report.screenshots.push({
          id: item.id,
          path,
          sha256: hash(await readFile(path)),
          ...item,
        });
      }
      report.checks.push({ id: item.id, passed: true });
    } catch (error) {
      report.failures.push({ id: item.id, error: error.message });
      await captureBrowserScreenshot(page, {
        path: join(output, item.id + '-failure.png'),
        failure: true,
        fullPage: true,
      }).catch(() => {});
    }
    await save();
  }
  report.inputs.after = await fingerprint();
  assert.deepEqual(
    report.inputs.after,
    report.inputs.before,
    'Source remained stable',
  );
  assert.deepEqual(report.pageErrors, [], 'No browser errors');
  assert.deepEqual(report.externalRequests, [], 'Loopback only');
  report.result = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.result = 'failed';
  report.failures.push({
    id: 'setup-or-finalize',
    error: error.stack ?? error.message,
  });
} finally {
  await browser?.close();
  await server?.close();
  await save();
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    failures: report.failures,
    pending: report.pending.length,
    screenshots: report.screenshots.length,
    report: join(output, 'report.json'),
  }),
);
if (report.result !== 'passed') process.exitCode = 1;
