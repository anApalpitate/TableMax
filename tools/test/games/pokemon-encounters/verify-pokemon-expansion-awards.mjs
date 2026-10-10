import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from '../../../release/package-limits.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';

// Rule-derived component fixtures, deliberately separate from a live service.
const args = process.argv.slice(2);
assert.ok(
  args.every(
    (arg) =>
      arg === '--portable' ||
      arg === '--prepare-only' ||
      /^--(?:evidence=[A-Za-z0-9_-]+|sha256=[a-f0-9]{64})$/i.test(arg),
  ),
);
assert.ok(
  args.includes('--portable'),
  'Only the actual frozen ZIP client is supported',
);
const argument = (key) =>
  args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const expectedSha = argument('sha256');
assert.ok(expectedSha, 'Explicit frozen ZIP SHA256 is required');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = resolve(
  `artifacts/maintenance/v${version}/pokemon-expansion-awards`,
  argument('evidence') ?? `run-${Date.now()}`,
);
await mkdir(resolve(output, '..'), { recursive: true });
await mkdir(output, { recursive: false });
await mkdir('tmp', { recursive: true });
// Existing maintenance-recognized fixture prefix; no new cleanup controller.
const work = await mkdtemp(resolve('tmp/pokemon-expansion-effects-'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const report = {
  status: 'running',
  startedAt: new Date().toISOString(),
  scope:
    'Actual hash-audited ZIP rules, client, shared React/WebHost runtime and CSS in hidden muted Edge. Two rule-validated settlement component fixtures derived from rules-research-buffer.test.ts endingFixture. No live service, saved authority, ordinary full round, physical-phone or listening claim.',
  screenshots: [],
  checks: [],
  pageErrors: [],
  externalRequests: [],
};
let browser, server;
try {
  const manifest = JSON.parse(
    await readFile(
      `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
      'utf8',
    ),
  );
  const zip = resolve('artifacts/releases', manifest.archive.name);
  const bytes = await readFile(zip);
  report.archiveSha256 = hash(bytes);
  assert.equal(report.archiveSha256, expectedSha);
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  assert.ok(bytes.length < MAXIMUM_PACKAGE_BYTES);
  assert.equal(manifest.files.length, manifest.fileCount);
  const extracted = join(work, 'portable');
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_AWARDS_ZIP -DestinationPath $env:TABLEMAX_AWARDS_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_AWARDS_ZIP: zip,
        TABLEMAX_AWARDS_EXTRACT: extracted,
      },
    },
  );
  const actualMembers = [];
  async function audit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink());
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await audit(path);
      else {
        assert.ok(entry.isFile());
        actualMembers.push(relative(extracted, path).replaceAll('\\', '/'));
      }
    }
  }
  await audit(extracted);
  assert.deepEqual(
    actualMembers.sort(),
    manifest.files.map((file) => file.path).sort(),
  );
  let extractedBytes = 0;
  for (const file of manifest.files) {
    assert.ok(
      !file.path.split('/').includes('..') &&
        !file.path.includes('\\') &&
        !file.path.startsWith('/'),
    );
    const data = await readFile(join(extracted, file.path));
    assert.equal(hash(data), file.sha256, file.path);
    extractedBytes += data.length;
  }
  assert.ok(
    extractedBytes < MAXIMUM_PACKAGE_BYTES &&
      extractedBytes <= PACKAGE_BUDGET_BYTES,
  );
  assert.equal(extractedBytes, manifest.extractedBytes);
  report.extractedBytes = extractedBytes;
  report.extractedFiles = actualMembers.length;
  const require = createRequire(import.meta.url);
  const rules = require(join(extracted, 'games/pokemon-encounters.cjs'))
    .rulesByVariant.expansion;
  const seats = ['s0', 's1'];
  function playing() {
    let seed = 17;
    const context = {
      seats,
      random: {
        next: () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        },
      },
    };
    let state = rules.initialize(context);
    for (const seat of seats)
      state = rules.apply(
        state,
        { type: 'vote-research', taskId: state.researchCandidates[0] },
        seat,
        context,
      ).state;
    for (const seat of seats)
      state = rules.apply(
        state,
        { type: 'initial-flip', slot: 0 },
        seat,
        context,
      ).state;
    return { state, context };
  }
  function endingFixture(own, other, opening, hoenn, priorWins) {
    const { state, context } = playing();
    const pool = [
      ...state.deck,
      ...state.discard,
      ...seats.flatMap((seat) =>
        state.boards[seat].map((cell) => cell.instanceId),
      ),
    ];
    const lookup = structuredClone(state);
    lookup.boards.s0[0].faceUp = true;
    const faces = new Map();
    for (const wanted of pool) {
      const previous = lookup.boards.s0[0].instanceId;
      const swap = (id) =>
        id === wanted ? previous : id === previous ? wanted : id;
      for (const board of Object.values(lookup.boards))
        for (const cell of board) cell.instanceId = swap(cell.instanceId);
      lookup.deck = lookup.deck.map(swap);
      lookup.discard = lookup.discard.map(swap);
      faces.set(
        wanted,
        rules.project(lookup, { role: 'public' }).boards.s0[0].card,
      );
    }
    const take = (categoryOrId) => {
      const index = pool.findIndex((id) =>
        categoryOrId.startsWith('value:')
          ? faces.get(id).value === Number(categoryOrId.slice(6))
          : categoryOrId.includes('#')
            ? id === categoryOrId
            : faces.get(id).categoryId === categoryOrId,
      );
      assert.ok(index >= 0, `Impossible settlement fixture ${categoryOrId}`);
      return pool.splice(index, 1)[0];
    };
    const otherBoard = other ?? own.map((id) => `value:${faces.get(id).value}`);
    state.turnSeat = 's0';
    state.boards = {
      s0: own.map((id, i) => ({ instanceId: take(id), faceUp: i !== 8 })),
      s1: otherBoard.map((id, i) => ({ instanceId: take(id), faceUp: i < 3 })),
    };
    state.held = state.boards.s0[8].instanceId;
    state.boards.s0[8].instanceId = pool.pop();
    state.discard = [pool.pop()];
    state.deck = pool;
    Object.assign(state, {
      phase: 'place',
      drawSource: 'buffer',
      pendingAbility: null,
      usedAbilityIds: [],
      researchCandidates: [
        opening,
        ...['R01', 'R02', 'R03', 'R04']
          .filter((id) => id !== opening)
          .slice(0, 2),
      ],
      votesBySeat: { s0: opening, s1: opening },
      activeResearch: [opening, ...(hoenn ? [hoenn] : [])],
      usedOpeningResearch: [opening],
      usedHoennResearch: hoenn ? [hoenn] : [],
      hoennTriggered: !!hoenn,
      hoennPending: null,
      preReveal: null,
      roundResult: null,
      matchWinners: [],
      events: [],
      eventCounter: 0,
      winsBySeat: { s0: priorWins, s1: priorWins },
    });
    state.voteCounts = Object.fromEntries(
      state.researchCandidates.map((id) => [id, id === opening ? 2 : 0]),
    );
    rules.validateState(state, seats);
    const action = { type: 'replace', slot: 8 };
    assert.ok(
      rules
        .legalActions(state, 's0')
        .some(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
        ),
    );
    const result = rules.apply(state, action, 's0', context).state;
    assert.deepEqual(rules.validateState(result, seats), result);
    return result;
  }
  const diagonal = [
    'ordinary-8#01',
    'ordinary-1#01',
    'ordinary-8#02',
    'ordinary-piplup#01',
    'ordinary-8#03',
    'ordinary-3#01',
    'ordinary-gardevoir#01',
    'ordinary-4#01',
    'ordinary-gardevoir#02',
  ];
  const zeroOwn = [
    'ordinary--2',
    'ordinary--2',
    'ordinary--2',
    'ordinary-mimikyu',
    'ordinary-mimikyu',
    'ordinary-mimikyu',
    'ordinary-mimikyu',
    'ordinary-0',
    'ordinary-1',
  ];
  const zeroOther = [
    'ordinary-8',
    'ordinary-9',
    'ordinary-metagross',
    'ordinary-garchomp',
    'ordinary-dragonite',
    'ordinary-gardevoir',
    'special-lucario',
    'ordinary-garchomp',
    'ordinary-9',
  ];
  // Exact value sequence of the existing R03 endingFixture, resolved by package card data.
  const two = endingFixture(diagonal, null, 'R03', null, 1);
  const bonus = endingFixture(diagonal, null, 'R03', null, 0);
  const zero = endingFixture(zeroOwn, zeroOther, 'R01', 'H05', 0);
  assert.deepEqual(two.roundResult.winners, seats);
  assert.deepEqual(two.roundResult.awardsBySeat, { s0: 2, s1: 2 });
  assert.deepEqual(two.winsBySeat, { s0: 3, s1: 3 });
  assert.deepEqual(two.matchWinners, seats);
  assert.deepEqual(bonus.roundResult.awardsBySeat, { s0: 2, s1: 2 });
  assert.deepEqual(bonus.winsBySeat, { s0: 2, s1: 2 });
  assert.deepEqual(bonus.matchWinners, []);
  assert.deepEqual(zero.roundResult.winners, ['s0']);
  assert.deepEqual(zero.roundResult.awardsBySeat, { s0: 0, s1: 0 });
  assert.deepEqual(zero.winsBySeat, { s0: 0, s1: 0 });
  assert.equal(zero.phase, 'round-result');
  const fixtureViews = {};
  for (const [name, state] of Object.entries({ bonus, two, zero })) {
    const views = {};
    for (const role of ['host', 'public', 'player']) {
      const projection = rules.project(
        state,
        role === 'player' ? { role, seatId: 's0' } : { role },
      );
      if (role !== 'player') {
        assert.equal(projection.ownVote, null);
        assert.equal(projection.peek, null);
      }
      views[role] = {
        instanceId: `awards-component-${name}`,
        revision: 1,
        branch: 0,
        status: state.phase === 'match-result' ? 'ended' : 'playing',
        paused: false,
        restored: false,
        joinOpen: false,
        playMode: 'play',
        countdownSeconds: 20,
        decisionClock: null,
        game: {
          id: 'pokemon-encounters',
          name: '宝可梦奇遇',
          min: 2,
          max: 6,
          variantId: 'expansion',
          variants: [],
          decisionTimer: true,
        },
        catalog: [],
        ownerSeatId: null,
        capabilities: { manage: false, control: false, manageSeats: false },
        seats: seats.map((id, i) => ({
          id,
          name: i === 0 ? '研究赢家' : '同行伙伴',
          avatarId: `avatar-${i + 1}`,
          controller: 'human',
          ready: true,
          online: true,
        })),
        self: { role, seatId: role === 'player' ? 's0' : null },
        gameView: projection,
        actions: role === 'player' ? rules.legalActions(state, 's0') : [],
        decisionId: null,
        selectionToken: `${name}-${role}`,
        history: [],
        lifecycleActions: [],
        botError: null,
        endReason: null,
      };
    }
    fixtureViews[name] = { views };
    report.checks.push({
      name,
      winners: state.roundResult.winners,
      awardsBySeat: state.roundResult.awardsBySeat,
      winsBySeat: state.winsBySeat,
      matchWinners: state.matchWinners,
      scores: state.roundResult.scores,
    });
  }
  const fixturePath = resolve(
    'tools/test/fixtures/pokemon-expansion-awards.tsx',
  );
  report.fixtureSourceSha256 = hash(await readFile(fixturePath));
  await writeFile(
    join(work, 'entry.tsx'),
    `import ${JSON.stringify(fixturePath)};`,
  );
  await writeFile(
    join(work, 'index.html'),
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
  );
  await build({
    configFile: false,
    root: work,
    plugins: [
      react(),
      {
        name: 'actual-packaged-awards',
        enforce: 'pre',
        resolveId(source, importer) {
          if (
            !importer
              ?.replaceAll('\\', '/')
              .endsWith('/tools/test/fixtures/pokemon-expansion-awards.tsx')
          )
            return;
          if (source === '../../games/pokemon-encounters/expansion/web')
            return '\0packaged-awards-client';
          if (source === '../../packages/web-host/src')
            return { id: '/runtime/v1/web-host.js', external: true };
          if (source === '../../apps/web/src/styles.css')
            return '\0packaged-awards-css';
        },
        load(id) {
          if (id === '\0packaged-awards-client')
            return "import { clientsByVariant } from '/games/pokemon-encounters/web/entry.js'; export const client = clientsByVariant.expansion;";
          if (id === '\0packaged-awards-css') return '';
        },
      },
    ],
    build: {
      outDir: join(work, 'bundle'),
      emptyOutDir: false,
      target: 'chrome110',
      rolldownOptions: {
        external: [
          'react',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react-dom',
          'react-dom/client',
          '/games/pokemon-encounters/web/entry.js',
        ],
        output: {
          paths: {
            react: '/runtime/v1/react.js',
            'react/jsx-runtime': '/runtime/v1/jsx-runtime.js',
            'react/jsx-dev-runtime': '/runtime/v1/jsx-dev-runtime.js',
            'react-dom': '/runtime/v1/react-dom.js',
            'react-dom/client': '/runtime/v1/react-dom-client.js',
          },
        },
      },
    },
    logLevel: 'error',
  });
  await cp(join(extracted, 'web'), join(work, 'bundle'), {
    recursive: true,
    filter: (path) => path !== join(extracted, 'web/index.html'),
  });
  await writeFile(
    join(work, 'bundle/fixtures.json'),
    JSON.stringify(fixtureViews),
  );
  const styles = manifest.files
    .filter(
      (file) =>
        file.path.endsWith('.css') &&
        (file.path.startsWith('web/assets/') ||
          file.path.startsWith('web/runtime/v1/') ||
          file.path.startsWith('web/games/pokemon-encounters/')),
    )
    .map((file) => `<link rel="stylesheet" href="/${file.path.slice(4)}">`)
    .join('');
  const html = join(work, 'bundle/index.html');
  await writeFile(
    html,
    (await readFile(html, 'utf8')).replace('</head>', `${styles}</head>`),
  );
  if (args.includes('--prepare-only')) {
    report.status = 'prepared';
    report.scope +=
      ' Preparation only: rules and compiled fixture verified; no browser started or visual pass claimed.';
  } else {
    server = await serveFixture(join(work, 'bundle'));
    browser = await launchTestBrowser({
      channel: 'msedge',
      headless: true,
      soundEnabled: false,
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    page.on('pageerror', (error) =>
      report.pageErrors.push(error.stack ?? error.message),
    );
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (
        url.startsWith(new URL(server.url).origin + '/') ||
        url.startsWith('data:') ||
        url.startsWith('blob:')
      )
        return route.continue();
      report.externalRequests.push(url);
      await route.abort();
    });
    await page.goto(server.url);
    await page.waitForFunction(() => typeof window.awardsShow === 'function');
    async function capture(label) {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {})),
        );
      });
      const path = join(output, `${label}.png`);
      await page.screenshot({ path, fullPage: true });
      report.screenshots.push({ label, path });
    }
    for (const name of ['bonus', 'two', 'zero'])
      for (const [role, width, height] of [
        ['player', 320, 568],
        ['player', 390, 844],
        ['host', 1280, 720],
        ['public', 1280, 720],
      ]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(({ name, role }) => window.awardsShow(name, role), {
          name,
          role,
        });
        await page.locator('.ex-victory').waitFor();
        await capture(`${name}-${role}-${width}-settlement`);
        for (const seat of role === 'player' ? ['s0'] : seats) {
          const panel = page.locator(`.ex-player[data-seat="${seat}"]`);
          assert.equal(
            await panel
              .locator('header > img')
              .evaluate((image) => image.complete && image.naturalWidth > 0),
            true,
            'Fixture must use a packaged preset avatar',
          );
          const award = name === 'zero' ? 0 : 2,
            wins = name === 'zero' ? 0 : name === 'bonus' ? 2 : 3;
          assert.equal(await panel.locator('.win-pips i.earned').count(), wins);
          assert.ok(
            (
              await panel.locator('.win-track').getAttribute('aria-label')
            ).startsWith(`${wins} 胜`),
          );
          assert.equal(
            await panel.locator('.win-pips i.newly-earned').count(),
            0,
            'Historical settlement must not replay a star animation',
          );
          assert.match(
            await panel.locator('.ex-award').innerText(),
            new RegExp(`本局获\\s*${award}\\s*胜`),
          );
          assert.equal(
            await panel.locator('.winner-crown').count(),
            name === 'two' ? 1 : 0,
          );
          if (seat === 's0' || name !== 'zero')
            assert.ok((await panel.getAttribute('class')).includes('winner'));
        }
        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(
          horizontalOverflow,
          false,
          `${name}/${role}/${width}: horizontal overflow`,
        );
        await page
          .getByRole('button', { name: '查看研究赢家的计分明细', exact: true })
          .click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.match(
          await dialog.innerText(),
          new RegExp(`本局实际获\\s*${name === 'zero' ? 0 : 2}\\s*胜`),
        );
        const expectedScore =
          name === 'zero'
            ? zero.roundResult.scores.s0
            : two.roundResult.scores.s0;
        const adjustmentText = (deduction) =>
          deduction > 0
            ? `减 ${deduction} 分`
            : deduction < 0
              ? `加 ${-deduction} 分`
              : '分数不变';
        assert.ok(
          (await dialog.innerText()).includes(
            `场地 ${expectedScore.base} 分，研究${adjustmentText(expectedScore.deduction)}，最终 ${expectedScore.total} 分`,
          ),
        );
        for (const research of expectedScore.research) {
          assert.ok(
            (await dialog.innerText()).includes(
              research.achieved ? '已达成' : '未达成',
            ),
          );
          assert.ok(
            (await dialog.innerText()).includes(
              adjustmentText(research.deduction),
            ),
          );
          for (const effect of research.effects ?? []) {
            assert.ok((await dialog.innerText()).includes(effect.label));
            if (effect.adjustment !== 0)
              assert.ok(
                (await dialog.innerText()).includes(
                  adjustmentText(-effect.adjustment),
                ),
              );
          }
        }
        await capture(`${name}-${role}-${width}-score`);
        await dialog
          .getByRole('button', { name: '关闭面板', exact: true })
          .click();
        assert.deepEqual(await page.evaluate(() => window.awardsCommands), []);
      }
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.externalRequests, []);
    assert.equal(hash(await readFile(fixturePath)), report.fixtureSourceSha256);
    assert.equal(
      hash(await readFile(zip)),
      expectedSha,
      'Frozen ZIP must stay unchanged',
    );
    report.status = 'passed';
  }
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  report.allOwnedProcessesStopped = true;
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      status: report.status,
      output,
      screenshots: report.screenshots.length,
    }),
  );
}
