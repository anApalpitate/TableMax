import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { build } from 'esbuild';

const evidenceName = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice('--evidence='.length);
assert.ok(
  !evidenceName || /^[a-zA-Z0-9_-]+$/.test(evidenceName),
  'Invalid evidence directory',
);
const requested = process.argv
  .find((arg) => arg.startsWith('--reference='))
  ?.slice(12);
assert.ok(
  !requested || /^[a-f0-9]{40}$/.test(requested),
  'Reference must be a full local commit SHA',
);
const reference =
  requested ??
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
async function load(previous) {
  const bundle = await build({
    entryPoints: ['games/pokemon-encounters/rules/index.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: previous
      ? [
          {
            name: 'pre-refactor-rules',
            setup(b) {
              b.onLoad(
                {
                  filter:
                    /pokemon-encounters[\\/](rules|shared|variants)[\\/].*\.ts$/,
                },
                ({ path }) => ({
                  contents: execFileSync(
                    'git',
                    [
                      'show',
                      reference +
                        ':' +
                        relative(resolve('.'), path).replaceAll('\\', '/'),
                    ],
                    { encoding: 'utf8' },
                  ),
                  loader: 'ts',
                }),
              );
            },
          },
        ]
      : [],
  });
  const module = { exports: {} };
  new Function('module', 'exports', bundle.outputFiles[0].text)(
    module,
    module.exports,
  );
  return module.exports.rules;
}
const legacyProjection = (view) => {
  const legacy = { ...view };
  delete legacy.publicMatchedColumns;
  return legacy;
};
const old = await load(true),
  current = await load(false);
function random(seed) {
  return {
    state: seed,
    next() {
      let value = this.state;
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      this.state = value >>> 0;
      return this.state / 4294967296;
    },
  };
}
const checks = [],
  phases = new Set();
for (let players = 2; players <= 6; players++) {
  const seats = Array.from({ length: players }, (_, i) => 'S' + (i + 1));
  const a = random(71 + players),
    b = random(71 + players),
    choice = random(13 + players);
  let before = old.initialize({ seats, random: a }),
    after = current.initialize({ seats, random: b }),
    steps = 0;
  while (!old.ended(before) && steps++ < 2000) {
    assert.deepEqual(after, before);
    assert.equal(a.state, b.state);
    phases.add(before.phase);
    for (const viewer of [
      { role: 'public' },
      ...seats.map((seatId) => ({ role: 'player', seatId })),
    ])
      assert.deepEqual(
        legacyProjection(current.project(after, viewer)),
        old.project(before, viewer),
      );
    const lifecycle = old.lifecycleActions(before);
    assert.deepEqual(current.lifecycleActions(after), lifecycle);
    if (lifecycle.length) {
      before = old.applyLifecycle(before, lifecycle[0], {
        seats,
        random: a,
      }).state;
      after = current.applyLifecycle(after, lifecycle[0], {
        seats,
        random: b,
      }).state;
    } else {
      const decision = old.decisions(before)[0];
      assert.deepEqual(current.decisions(after), old.decisions(before));
      const actions = old.legalActions(before, decision.seatId);
      assert.deepEqual(current.legalActions(after, decision.seatId), actions);
      const action = actions[Math.floor(choice.next() * actions.length)];
      before = old.apply(before, action, decision.seatId, {
        seats,
        random: a,
      }).state;
      after = current.apply(after, action, decision.seatId, {
        seats,
        random: b,
      }).state;
    }
    current.validateState(after, seats);
    old.validateState(before, seats);
  }
  assert.ok(steps < 2000);
  assert.deepEqual(after, before);
  assert.equal(a.state, b.state);
  checks.push({
    players,
    steps,
    rounds: after.roundNumber,
    winners: after.matchWinners,
  });
}
const output = resolve(
  'artifacts/maintenance/v1.0.3',
  evidenceName ?? 'pokemon-bot-variant-20261005',
);
await mkdir(output, { recursive: true });
await writeFile(
  resolve(output, 'original-compatibility.json'),
  JSON.stringify(
    {
      result: 'passed',
      reference,
      scope:
        'Fixed RNG differential of actual pre-refactor/current rules, full state, all authorized projections, legal actions, scoring and lifecycle for 2–6 seats; no gameplay variant fields.',
      checks,
      phases: [...phases],
    },
    null,
    2,
  ),
);
console.info('Original rule differential passed against ' + reference);
