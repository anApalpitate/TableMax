import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative, extname, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build as bundleNode } from 'esbuild';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
if (process.argv.includes('--review-only')) {
  await verifyReview();
  process.exit(process.exitCode ?? 0);
}
const phase = option('phase') ?? 'after';
assert(['before', 'after'].includes(phase));
const task = option('task');
const evidence = option('evidence');
const baselineReportPath = option('baseline-report');
const only = option('only')?.split(',') ?? [];
assert.match(task ?? '', /^tmp\/[a-z0-9][a-z0-9-]{1,90}$/);
assert.match(evidence ?? '', /^[a-z0-9][a-z0-9-]{1,70}$/);
const taskRoot = resolve(task);
const baseline = join(taskRoot, 'work/before');
const sourceRoot = phase === 'before' ? baseline : resolve('.');
const taskId = task.split('/')[1];
const output = resolve('artifacts/maintenance', taskId, evidence);
const work = join(taskRoot, evidence);
assert(!existsSync(output), `Evidence already exists: ${output}`);
await mkdir(output, { recursive: false });
await mkdir(work, { recursive: true });
await mkdir(join(taskRoot, 'browser-temp'), { recursive: true });
process.env.TEMP = process.env.TMP = join(taskRoot, 'browser-temp');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (path) => relative(resolve('.'), path).replaceAll('\\', '/');
const file = (path) => JSON.stringify(resolve(path));
const variants = [
  [
    'pokemon-encounters',
    'games/pokemon-encounters',
    'rules/index.ts',
    'bot/index.ts',
  ],
  [
    'expansion',
    'games/pokemon-encounters/expansion',
    'index.ts',
    'bot/index.ts',
  ],
  ['modern-art', 'games/modern-art', 'rules/index.ts', 'bot/index.ts'],
  ['power-grid', 'games/power-grid', 'rules/index.ts', 'bot/index.ts'],
  ['rummikub', 'games/rummikub', 'rules/index.ts', 'bot/index.ts'],
  ['uno', 'games/uno', 'rules/index.ts', 'bot/index.ts'],
  ['avalon', 'games/avalon', 'rules/index.ts', 'bot/index.ts'],
  ['manila', 'games/manila', 'rules/index.ts', 'bot/index.ts'],
  [
    'cockroach-poker',
    'games/cockroach-poker',
    'rules/index.ts',
    'bot/index.ts',
  ],
];
const sourceInputs = new Map();
async function bind(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute) || absolute.includes(`${sep}node_modules${sep}`))
    return;
  const bytes = await readFile(absolute);
  const item = {
    path: local(absolute),
    bytes: bytes.length,
    sha256: hash(bytes),
  };
  const previous = sourceInputs.get(item.path);
  if (previous)
    assert.equal(
      previous.sha256,
      item.sha256,
      `Source changed during build: ${item.path}`,
    );
  sourceInputs.set(item.path, item);
}
const aliases = (root) => ({
  '@tablemax/web-host/platform': join(
    root,
    'packages/web-host/src/platform.ts',
  ),
  '@tablemax/web-host': join(root, 'packages/web-host/src/index.tsx'),
  '@tablemax/protocol': join(root, 'packages/protocol/src/index.ts'),
  '@tablemax/game-sdk/module-manifest': join(
    root,
    'packages/game-sdk/src/module-manifest.ts',
  ),
  '@tablemax/game-sdk/metadata': join(
    root,
    'packages/game-sdk/src/metadata.mjs',
  ),
  '@tablemax/game-sdk': join(root, 'packages/game-sdk/src/index.ts'),
  zod: resolve('packages/protocol/node_modules/zod'),
  'socket.io-client': resolve('apps/web/node_modules/socket.io-client'),
});
const fixturePath = join(taskRoot, 'legal-fixtures.json');
const report = {
  result: 'running',
  phase,
  task,
  evidence,
  checks: [],
  screenshots: [],
  errors: [],
  boundaries: [
    'Actual React components with RoomCoordinator-created, validated legal rule projections; frozen in-memory fixtures, not a network or persistence proof.',
    'Only host and player product layouts run. The old public URL HTTP 410, native menus/bridges/audio and configuration require their separate service/native reports.',
    'Hidden muted Edge on 127.0.0.1 with reduced motion and a frozen browser clock. No installer, physical phone, Safari, television or physical DPI proof.',
    'The invitation image slot is explicitly labelled as a local UI fixture, not a joinable QR code; network invitation generation is outside this component proof.',
    'Before records unchanged source behavior; after asserts the new product entries. Historical input SHA and failed rounds are retained.',
  ],
};
let server;
let browser;
try {
  if (!existsSync(fixturePath)) {
    assert.equal(
      phase,
      'before',
      'Prepare legal fixtures with the frozen before source first',
    );
    const preparation = join(work, 'prepare.ts');
    const code = `
import{writeFileSync}from'node:fs';
import{RoomCoordinator}from ${file(join(baseline, 'packages/platform-core/src/room.ts'))};
import{allowsGameAction}from ${file(join(baseline, 'packages/platform-core/src/game-actions.ts'))};
import{RoomViewSchema}from ${file(join(baseline, 'packages/protocol/src/index.ts'))};
import{preparePublicScreenRetirement}from ${file(resolve('tools/test/fixtures/prepare-public-screen-retirement.ts'))};
${variants.map(([, path, rules, bot], index) => `import{rules as r${index}}from ${file(join(baseline, path, rules))};import{bot as b${index}}from ${file(join(baseline, path, bot))};`).join('\n')}
async function main(){
const entries=[${variants.map(([key], index) => `{key:${JSON.stringify(key)},rules:r${index},bot:b${index}}`).join(',')}];
const fixtures=await preparePublicScreenRetirement(entries,(entry,repository)=>new RoomCoordinator(entry.rules,entry.bot,repository),input=>RoomViewSchema.parse(input),allowsGameAction);
writeFileSync(${file(fixturePath)},JSON.stringify(fixtures));console.log(JSON.stringify(fixtures.proof));
}
main().catch(error=>{console.error(error);process.exitCode=1});
`;
    await writeFile(preparation, code);
    const preparedBundle = await bundleNode({
      entryPoints: [preparation],
      outfile: join(work, 'prepare.cjs'),
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      metafile: true,
      alias: aliases(baseline),
      logLevel: 'silent',
    });
    for (const path of Object.keys(preparedBundle.metafile.inputs))
      await bind(path);
    const prepared = spawnSync(process.execPath, [join(work, 'prepare.cjs')], {
      encoding: 'utf8',
      env: process.env,
    });
    await writeFile(
      join(output, 'preparation.log'),
      `${prepared.stdout ?? ''}${prepared.stderr ?? ''}`,
    );
    assert.equal(
      prepared.status,
      0,
      `Legal preparation failed: ${prepared.stderr}`,
    );
  }
  const fixtureBytes = await readFile(fixturePath);
  const fixture = JSON.parse(fixtureBytes);
  const previous =
    phase === 'after'
      ? JSON.parse(await readFile(resolve(baselineReportPath ?? ''), 'utf8'))
      : null;
  if (previous) {
    assert.equal(
      previous.result,
      'passed',
      'Layout comparison requires passed before evidence',
    );
    assert.equal(
      previous.fixture.sha256,
      hash(fixtureBytes),
      'Before/after must use identical legal fixtures',
    );
  }
  report.fixture = {
    path: local(fixturePath),
    sha256: hash(fixtureBytes),
    proof: fixture.proof,
  };
  // Preserve only legal authorization projections, not complete private rule states.
  const browserFixtures = {
    createdAt: fixture.createdAt,
    games: Object.fromEntries(
      Object.entries(fixture.games).map(([key, value]) => [
        key,
        { lobby: value.lobby, playing: value.playing },
      ]),
    ),
  };
  await writeFile(join(work, 'fixtures.json'), JSON.stringify(browserFixtures));
  await writeFile(
    join(work, 'index.html'),
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
  );
  const managementEntry = join(
    sourceRoot,
    'apps/web/src/components/ManagementEntry.tsx',
  );
  const entry = `
import React from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{BoxScreen}from ${file(join(sourceRoot, 'apps/web/src/screens/BoxScreen.tsx'))};
import{PlatformGame}from ${file(join(sourceRoot, 'apps/web/src/session/gameHostAdapter.tsx'))};
import{Prototype}from ${file(join(sourceRoot, 'apps/web/src/prototype/Prototype.tsx'))};
${phase === 'after' ? `import{ManagementEntry}from ${file(managementEntry)};` : ''}
import fixtures from'./fixtures.json';
import ${file(join(sourceRoot, 'apps/web/src/styles.css'))};import ${file(join(sourceRoot, 'apps/web/src/screens/box-screen.css'))};import ${file(join(sourceRoot, 'apps/web/src/scrollbars.css'))};
${variants.map(([, path], index) => `import{client as c${index}}from ${file(join(sourceRoot, path, 'web/index.tsx'))};`).join('\n')}
const clients={${variants.map(([key], index) => `${JSON.stringify(key)}:c${index}`).join(',')},'avalon-ended':c6};
const root=createRoot(document.getElementById('root'));const noop=()=>{};let seq=0;window.fixtureCommands=[];
function session(key,role,status='playing',anonymous=false){const item=fixtures.games[key][status];const view=anonymous?item.anonymous:item[role];return{role,view,isHost:view.self.role==='host',canControl:view.capabilities.control,canManageSeats:view.capabilities.manageSeats,self:view.seats.find(seat=>seat.id===view.self.seatId),credential:anonymous?'':'fixture',connected:true,locked:false,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],saved:false,submitting:false,name:'',setName:noop,command:command=>window.fixtureCommands.push(command),retry:noop,retryAdmission:noop,subscribeInteractions:()=>noop,subscribeInteractionReset:()=>noop,addresses:['127.0.0.1'],adapters:[],port:38473,catalog:view.catalog,games:view.catalog,address:'127.0.0.1',joinUrl:'http://127.0.0.1:38473/',externalJoinUrl:null,networkMessage:'',refreshNetwork:noop,setAddress:noop,saveExternalJoinUrl:async()=>true,join:noop,setPlayerCredential:noop};}
window.renderCase=({kind,key='uno',role='host',waiting=false})=>{window.fixtureCommands=[];history.replaceState(null,'','/'+role+(kind==='game'?'/game':''));document.documentElement.dataset.playerDisplay=role==='player'&&innerWidth>=640?'wide':'portrait';const s=session(key,role,kind==='game'?'playing':'lobby',kind==='entry');window.fixtureSession=s;const k=++seq;flushSync(()=>root.render(kind==='prototype'?<Prototype key={k}/>:kind==='entry'?${phase === 'after' ? '<ManagementEntry key={k} waiting={waiting}/>' : '<BoxScreen key={k} session={s}/>'}:kind==='game'?<PlatformGame key={k} session={s} client={clients[key]}/>:<BoxScreen key={k} session={s}/>));};
window.renderCase({kind:'box'});
`;
  await writeFile(join(work, 'entry.tsx'), entry);
  const browserAliases = Object.entries(aliases(sourceRoot)).map(
    ([find, replacement]) => ({ find, replacement }),
  );
  browserAliases.push(
    { find: 'react', replacement: resolve('apps/web/node_modules/react') },
    {
      find: 'react-dom',
      replacement: resolve('apps/web/node_modules/react-dom'),
    },
  );
  await build({
    root: work,
    configFile: false,
    base: './',
    assetsInclude: ['**/*.flac'],
    plugins: [
      leanCatalogPlugin(sourceRoot),
      react(),
      {
        name: 'bind-retirement-ui-inputs',
        async load(id) {
          const path = id.split('?')[0];
          if (!path.startsWith('\0')) await bind(path);
          return null;
        },
      },
    ],
    resolve: { alias: browserAliases },
    build: {
      outDir: join(work, 'bundle'),
      target: 'chrome110',
      emptyOutDir: true,
    },
    logLevel: 'error',
  });
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  report.environment = {
    node: process.version,
    browser: browser.version(),
    hidden: true,
    muted: true,
    listen: '127.0.0.1',
    physicalDpi: false,
  };
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript((time) => {
    Date.now = () => time;
    localStorage.setItem('tablemax-sound-enabled', 'false');
  }, fixture.createdAt);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  const types = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.woff2': 'font/woff2',
  };
  await page.route('**/assets/games/**', async (route) => {
    const pathname = decodeURIComponent(
      new URL(route.request().url()).pathname,
    );
    const path = resolve(sourceRoot, '.' + pathname);
    assert(path.startsWith(resolve(sourceRoot, 'assets/games') + sep));
    const bytes = await readFile(path);
    await bind(path);
    await route.fulfill({
      body: bytes,
      contentType: types[extname(path)] ?? 'application/octet-stream',
    });
  });
  await page.route(/\/api\/(?:foundation|room)\/qr(?:\?|$)/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="196" height="196"><rect width="196" height="196" fill="#fff"/><text x="98" y="94" text-anchor="middle" fill="#324" font-size="16">本机UI夹具</text><text x="98" y="120" text-anchor="middle" fill="#324" font-size="16">不用于入座</text></svg>',
    }),
  );
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.renderCase === 'function');
  const cases = [];
  for (const role of ['host', 'player'])
    for (const [width, height] of [
      [1280, 720],
      [390, 844],
    ])
      cases.push({
        id: `prototype-${role}-${width}`,
        kind: 'prototype',
        role,
        width,
        height,
        review: role === 'host' && width === 1280,
      });
  for (const key of [...variants.map(([key]) => key), 'avalon-ended'])
    for (const [role, width, height] of [
      ['host', 1280, 720],
      ['host', 1920, 1080],
      ['player', 390, 844],
      ['player', 844, 390],
    ])
      cases.push({
        id: `${key}-${role}-${width}`,
        kind: 'game',
        key,
        role,
        width,
        height,
      });
  for (const [role, width, height] of [
    ['host', 1280, 720],
    ['host', 1920, 1080],
    ['player', 390, 844],
    ['player', 844, 390],
  ])
    cases.push({
      id: `box-${role}-${width}`,
      kind: 'box',
      role,
      width,
      height,
    });
  for (const width of [1280, 1920])
    cases.push({
      id: `management-host-${width}`,
      kind: 'management',
      role: 'host',
      width,
      height: width === 1280 ? 720 : 1080,
      review: true,
    });
  for (const width of phase === 'after' ? [1280, 390, 320] : [1280, 390])
    cases.push({
      id: `entry-host-${width}`,
      kind: 'entry',
      role: 'host',
      width,
      height: width === 1280 ? 720 : 844,
      review: true,
    });
  if (phase === 'after')
    for (const width of [1280, 390, 320])
      cases.push({
        id: `entry-waiting-${width}`,
        kind: 'entry',
        role: 'host',
        waiting: true,
        width,
        height: width === 1280 ? 720 : 844,
      });
  report.expectedCaseIds = cases.map((item) => item.id);
  assert(
    only.every((id) => report.expectedCaseIds.includes(id)),
    'Only existing case IDs can be selected',
  );
  report.selectedCaseIds = only.length ? only : report.expectedCaseIds;
  let failures = 0;
  for (const item of cases.filter((item) =>
    report.selectedCaseIds.includes(item.id),
  )) {
    let captured;
    if (failures >= 10) {
      report.checks.push({
        ...item,
        result: 'pending',
        reason: 'Ten-failure stop threshold reached',
      });
      continue;
    }
    try {
      await page.setViewportSize({ width: item.width, height: item.height });
      await page.evaluate((item) => window.renderCase(item), {
        ...item,
        kind: item.kind === 'management' ? 'box' : item.kind,
      });
      if (item.kind === 'management')
        await page
          .getByRole('button', { name: '管理设置', exact: true })
          .click();
      let prototype;
      if (item.kind === 'prototype') {
        await page.locator('.review-drawer > summary').click();
        const roleControl = page.getByLabel('角色', { exact: true });
        prototype = {
          roles: await roleControl
            .locator('option')
            .evaluateAll((options) => options.map((option) => option.value)),
        };
        await roleControl.selectOption(item.role);
        await page.getByLabel('页面', { exact: true }).selectOption('session');
        await page.locator('.review-drawer > summary').click();
        prototype.management = await page.locator('.session-controls').count();
        prototype.sound = await page.locator('.sound-controls').count();
        assert.deepEqual(
          prototype.roles,
          phase === 'after' ? ['host', 'player'] : ['host', 'public', 'player'],
        );
        assert.equal(prototype.management, item.role === 'host' ? 1 : 0);
        assert.equal(
          prototype.sound,
          phase === 'after' && item.role === 'host' ? 1 : 0,
        );
      }
      const readiness = await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {})),
        );
        let previous = '',
          stable = 0,
          quietSince = performance.now();
        for (let frame = 0; frame < 180; frame++) {
          await new Promise((done) => requestAnimationFrame(done));
          const sample = JSON.stringify(
            [
              ...document.querySelectorAll(
                'main,main svg,main svg text,main svg g[transform],main [data-map-obstacle],main [class*=layout],main [class*=board],main [class*=workspace]',
              ),
            ].map((element) => {
              const rect = element.getBoundingClientRect();
              return [
                element.textContent,
                rect.x,
                rect.y,
                rect.width,
                rect.height,
                getComputedStyle(element).fontSize,
                element.getAttribute('viewBox'),
                element.getAttribute('transform'),
                element.getAttribute('hidden'),
                element.getAttribute('data-drawer-open'),
                element.getAttribute('data-map-obstacle-width'),
              ];
            }),
          );
          if (sample === previous) stable++;
          else {
            stable = 0;
            quietSince = performance.now();
          }
          if (stable >= 2 && performance.now() - quietSince >= 200)
            return {
              stableFrames: stable,
              quietMs: performance.now() - quietSince,
              criterion:
                'fonts/images ready; label text, SVG viewBox/transforms, principal and obstacle bounds stable >=200ms and >=2 consecutive rAF intervals',
            };
          previous = sample;
        }
        throw new Error(
          'DOM geometry and map labels did not settle across two consecutive animation frames',
        );
      });
      await page.waitForTimeout(100);
      const evidence = await page.evaluate(() => ({
        text: document.body.innerText,
        links: [...document.querySelectorAll('a[href]')].map((a) => ({
          text: a.textContent,
          href: a.getAttribute('href'),
        })),
        brokenImages: [...document.images]
          .filter(
            (image) =>
              image.getBoundingClientRect().width > 0 && !image.naturalWidth,
          )
          .map((image) => image.src),
        commands: window.fixtureCommands,
        role: window.fixtureSession?.view.self.role,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        geometry: [
          ...document.querySelectorAll(
            "main,main [class*='table'],main [class*='board'],main [class*='workspace'],main [class*='layout'],main [class*='campaign'],main [class*='round'],main [class*='market'],main [class*='hand'],main [class*='score'],main [class*='result'],main [class*='auction'],main [class*='discussion'],main [class*='card'],main [class*='seat'],main [class*='status'],.pg-screen svg,.pg-screen svg g[transform],.pg-screen [data-map-obstacle]",
          ),
        ]
          .map((element) => {
            const rect = element.getBoundingClientRect(),
              style = getComputedStyle(element);
            if (!rect.width || !rect.height || style.display === 'none')
              return null;
            return {
              tag: element.tagName,
              className: element.getAttribute('class') ?? '',
              text: element.textContent.replace(/\s+/g, ' ').trim(),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              scrollWidth: element.scrollWidth,
              scrollHeight: element.scrollHeight,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              lineHeight: style.lineHeight,
              display: style.display,
              columns: style.gridTemplateColumns,
              rows: style.gridTemplateRows,
              gap: style.gap,
              viewBox: element.getAttribute('viewBox'),
              transform: element.getAttribute('transform'),
              drawerHidden: element.getAttribute('hidden'),
              drawerOpen: element.getAttribute('data-drawer-open'),
              obstacleWidth: element.getAttribute('data-map-obstacle-width'),
            };
          })
          .filter(Boolean),
      }));
      evidence.readiness = readiness;
      captured = evidence;
      assert.equal(
        evidence.brokenImages.length,
        0,
        JSON.stringify(evidence.brokenImages),
      );
      assert(
        evidence.text.trim().length > 20,
        'Actual component content must render',
      );
      assert.equal(
        evidence.commands.length,
        0,
        'Rendering must not submit a command',
      );
      if (item.kind === 'prototype' && phase === 'after')
        assert(
          evidence.scrollWidth <= evidence.viewport + 1,
          'Prototype has no horizontal overflow',
        );
      if (item.kind === 'game') {
        assert(
          evidence.geometry.length >= 3,
          'Game must expose real principal DOM regions',
        );
        if (previous) {
          const before = previous.checks.find((check) => check.id === item.id)
            ?.evidence?.geometry;
          assert(before, `Missing same-state before geometry: ${item.id}`);
          assert.equal(
            evidence.geometry.length,
            before.length,
            'Principal region count unchanged',
          );
          for (let index = 0; index < before.length; index++) {
            const expected = before[index],
              actual = evidence.geometry[index];
            for (const key of [
              'tag',
              'className',
              'text',
              'fontSize',
              'fontWeight',
              'lineHeight',
              'display',
              'columns',
              'rows',
              'gap',
            ])
              assert.equal(
                actual[key],
                expected[key],
                `${item.id} region ${index} ${key}`,
              );
            if (item.key === 'power-grid')
              for (const key of [
                'viewBox',
                'transform',
                'drawerHidden',
                'drawerOpen',
                'obstacleWidth',
              ])
                assert.equal(
                  actual[key],
                  expected[key],
                  `${item.id} region ${index} ${key}`,
                );
            for (const key of [
              'x',
              'y',
              'width',
              'height',
              'scrollWidth',
              'scrollHeight',
            ])
              assert(
                Math.abs(actual[key] - expected[key]) <= 0.5,
                `${item.id} region ${index} ${key}: ${actual[key]} vs ${expected[key]}`,
              );
          }
          evidence.principalLayoutEquivalent = true;
        }
      }
      if (phase === 'after')
        assert.equal(
          evidence.links.filter((link) => link.href?.startsWith('/public'))
            .length,
          0,
          'No public-screen product link may remain',
        );
      if (item.kind === 'management') {
        assert(
          evidence.text.includes('手机房主') &&
            evidence.text.includes('换机申请'),
          'Existing authorized management sections remain',
        );
        assert.equal(
          evidence.links.some((link) => link.href?.startsWith('/public')),
          phase === 'before',
          'Public-screen management entry follows the phase',
        );
      }
      if (phase === 'after' && item.kind === 'entry') {
        const entry = await page.evaluate(() => {
          const link = document.querySelector('.management-entry > a');
          const rect = link.getBoundingClientRect();
          const button = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
          const glyphs = [
            ...document.querySelectorAll(
              '.management-entry > h1,.management-entry > p',
            ),
          ].flatMap((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return [...range.getClientRects()].map((rect) => ({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            }));
          });
          return { button, glyphs };
        });
        evidence.entry = entry;
        assert(entry.button.height >= 44, 'Player entry has a 44px target');
        assert(
          entry.button.y >= 0 &&
            entry.button.y + entry.button.height <= item.height,
          'Player entry is reachable in the initial viewport',
        );
        assert(
          entry.glyphs.length >= 2,
          'Heading and explanation must expose visible glyph lines',
        );
        for (const glyph of entry.glyphs) {
          assert(glyph.width > 0 && glyph.height > 0);
          assert(
            glyph.x >= -0.5 && glyph.x + glyph.width <= item.width + 0.5,
            'Entry text glyphs fit viewport',
          );
          const overlapX =
            Math.min(
              glyph.x + glyph.width,
              entry.button.x + entry.button.width,
            ) - Math.max(glyph.x, entry.button.x);
          const overlapY =
            Math.min(
              glyph.y + glyph.height,
              entry.button.y + entry.button.height,
            ) - Math.max(glyph.y, entry.button.y);
          assert(
            overlapX <= 0.5 || overlapY <= 0.5,
            'Entry glyphs do not overlap the player button',
          );
        }
        assert.equal(
          evidence.scrollWidth <= evidence.viewport + 1,
          true,
          'Management entry has no horizontal overflow',
        );
        assert(
          !evidence.text.includes('管理设置'),
          'Unauthenticated entry must not expose management',
        );
        assert(
          evidence.links.some((link) => link.href === '/'),
          'Ordinary player entry remains available',
        );
      }
      const screenshot = join(work, 'screenshots', `${item.id}.png`);
      await mkdir(join(work, 'screenshots'), { recursive: true });
      await page.screenshot({
        path: screenshot,
        fullPage: true,
        animations: 'disabled',
      });
      report.screenshots.push({
        ...item,
        path: local(screenshot),
        sha256: hash(await readFile(screenshot)),
      });
      report.checks.push({
        ...item,
        result: 'passed',
        evidence,
        ...(prototype ? { prototype } : {}),
      });
    } catch (error) {
      failures++;
      const diagnosticPath = join(
        work,
        'screenshots',
        `failure-${item.id}.png`,
      );
      let diagnostic;
      try {
        await mkdir(join(work, 'screenshots'), { recursive: true });
        await page.screenshot({
          path: diagnosticPath,
          fullPage: true,
          animations: 'disabled',
        });
        diagnostic = {
          path: local(diagnosticPath),
          sha256: hash(await readFile(diagnosticPath)),
        };
      } catch {
        /* Preserve the original failure even when screenshot capture is unavailable. */
      }
      report.checks.push({
        ...item,
        result: 'failed',
        error: String(error.stack ?? error),
        ...(captured ? { evidence: captured } : {}),
        ...(diagnostic ? { diagnosticScreenshot: diagnostic } : {}),
      });
    }
  }
  report.result =
    failures ||
    report.errors.length ||
    report.checks.some((item) => item.result === 'pending')
      ? 'failed'
      : 'passed';
} catch (error) {
  report.result = 'failed';
  report.errors.push(String(error.stack ?? error));
} finally {
  await browser?.close();
  await server?.close();
  const inputs = [...sourceInputs.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  for (const input of inputs)
    assert.equal(
      hash(await readFile(resolve(input.path))),
      input.sha256,
      `Input changed before evidence completed: ${input.path}`,
    );
  report.inputs = inputs;
  report.verifier = {
    path: local(
      new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    ),
    sha256: hash(await readFile(new URL(import.meta.url))),
  };
  report.summary = {
    passed: report.checks.filter((item) => item.result === 'passed').length,
    failed: report.checks.filter((item) => item.result === 'failed').length,
    pending: report.checks.filter((item) => item.result === 'pending').length,
    screenshots: report.screenshots.length,
    inputs: inputs.length,
  };
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile(
    join(output, 'verifier.mjs'),
    await readFile(new URL(import.meta.url)),
  );
  console.log(
    JSON.stringify({
      result: report.result,
      phase,
      ...report.summary,
      report: local(join(output, 'report.json')),
    }),
  );
}
if (report.result !== 'passed') process.exitCode = 1;

async function verifyReview() {
  const task = option('task'),
    evidence = option('evidence');
  assert.match(task ?? '', /^tmp\/[a-z0-9][a-z0-9-]{1,90}$/);
  assert.match(evidence ?? '', /^[a-z0-9][a-z0-9-]{1,70}$/);
  const taskRoot = resolve(task),
    review = join(taskRoot, 'review');
  const output = resolve('artifacts/maintenance', task.split('/')[1], evidence);
  assert(!existsSync(output), 'Review evidence must use a new round');
  await mkdir(output, { recursive: false });
  process.env.TEMP = process.env.TMP = join(taskRoot, 'browser-temp');
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const sourcePath = join(review, 'review-source.json'),
    sourceBytes = await readFile(sourcePath),
    source = JSON.parse(sourceBytes);
  assert.equal(source.result, 'built');
  assert.equal(source.html.path, join(review, 'comparison.html'));
  for (const input of [...source.inputs, source.html])
    assert.equal(hash(await readFile(input.path)), input.sha256, input.path);
  const report = {
    result: 'running',
    scope: 'Offline review artifact QA only; no additional product scenarios.',
    source: { path: sourcePath, sha256: hash(sourceBytes) },
    html: source.html,
    checks: [],
    errors: [],
    externalRequests: [],
    verifier: { sha256: hash(await readFile(new URL(import.meta.url))) },
  };
  let browser;
  try {
    browser = await launchTestBrowser({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('request', (request) => {
      if (!/^(file:|data:)/.test(request.url()))
        report.externalRequests.push(request.url());
    });
    const { pathToFileURL } = await import('node:url');
    await page.goto(pathToFileURL(source.html.path).href);
    await page.evaluate(() =>
      Promise.all([...document.images].map((image) => image.decode())),
    );
    assert.equal(await page.locator('img').count(), source.html.images);
    report.checks.push({ id: 'all-actual-pngs-decode', passed: true });
    for (const category of ['prototype', 'management', 'entry', 'all']) {
      await page.locator('#category').selectOption(category);
      assert.equal(
        await page.locator('section[data-category]:visible').count(),
        category === 'all' ? source.html.groups : 2,
      );
    }
    report.checks.push({ id: 'all-category-filters', passed: true });
    await page.locator('#original').click();
    assert(
      await page.evaluate(() =>
        [...document.images].every(
          (image) => image.getBoundingClientRect().width === image.naturalWidth,
        ),
      ),
    );
    report.checks.push({ id: 'original-pixel-toggle', passed: true });
    await page.locator('#original').click();
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    report.checks.push({
      id: '375-and-1280-no-page-horizontal-overflow',
      passed: true,
    });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.externalRequests, []);
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed';
    report.errors.push(String(error.stack ?? error));
  } finally {
    await browser?.close();
    await writeFile(
      join(output, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    await writeFile(
      join(output, 'verifier.mjs'),
      await readFile(new URL(import.meta.url)),
    );
  }
  console.log(
    JSON.stringify({
      result: report.result,
      html: report.html,
      report: join(output, 'report.json'),
      errors: report.errors,
    }),
  );
  if (report.result !== 'passed') process.exitCode = 1;
}
