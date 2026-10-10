import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';

assert.ok(
  process.argv
    .slice(2)
    .every((arg) =>
      /^--(?:seeds|seed-base|players|round-cap|evidence)=.+$/.test(arg),
    ),
  'Unknown measurement argument',
);

const argument = (name, fallback) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const seeds = Number(argument('seeds', '4')),
  seedBase = Number(argument('seed-base', '820700'));
const playerCounts = argument('players', '2,3,4,5,6').split(',').map(Number),
  roundCap = Number(argument('round-cap', '1200'));
const name = argument('evidence', `run-${Date.now()}`);
assert.ok(Number.isSafeInteger(seeds) && seeds >= 1 && seeds <= 100);
assert.ok(
  Number.isSafeInteger(seedBase) && seedBase > 0 && seedBase < 0x7fffffff,
);
assert.ok(
  Number.isSafeInteger(roundCap) && roundCap >= 100 && roundCap <= 10000,
);
assert.ok(
  playerCounts.length > 0 &&
    playerCounts.every((n) => Number.isInteger(n) && n >= 2 && n <= 6),
);
assert.equal(new Set(playerCounts).size, playerCounts.length);
assert.match(name, /^[a-zA-Z0-9_-]+$/);
const evidence = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-matches',
  name,
);
await mkdir(resolve(evidence, '..'), { recursive: true });
await mkdir(evidence, { recursive: false });
const temporary = resolve('tmp/pokemon-expansion-matches', name);
await mkdir(temporary, { recursive: true });
const bundle = join(temporary, 'runner.cjs');
const compilation = await build({
  entryPoints: [
    'tools/analysis/games/pokemon-encounters/pokemon-expansion-match-runner.mjs',
  ],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  metafile: true,
  logLevel: 'silent',
});
const inputs = [
  ...new Set([
    ...Object.keys(compilation.metafile.inputs).filter(
      (p) => !p.includes('node_modules'),
    ),
    'tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-matches.mjs',
    'games/pokemon-encounters/game-module.json',
    'package.json',
    'pnpm-lock.yaml',
  ]),
].sort();
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      inputs.map(async (p) => [
        p,
        createHash('sha256')
          .update(await readFile(p))
          .digest('hex'),
      ]),
    ),
  );
const before = await sourceHashes();
const { measureMatch } = createRequire(import.meta.url)(bundle);
const grades = ['default', 'doubao', 'juewu'],
  matches = [],
  started = performance.now();
let error = null;
try {
  for (const players of playerCounts)
    for (let index = 0; index < seeds; index++) {
      const seed = seedBase + players * 1009 + (index + 1) * 1777;
      const configurations =
        players === 2
          ? [
              [0, 1],
              [1, 0],
              [0, 2],
              [2, 0],
              [1, 2],
              [2, 1],
            ]
          : [0, 1, 2].map((rotation) =>
              Array.from({ length: players }, (_, i) => (i + rotation) % 3),
            );
      for (let rotation = 0; rotation < configurations.length; rotation++) {
        const result = await measureMatch(
          players,
          seed,
          configurations[rotation].map((i) => grades[i]),
          roundCap,
          (progress) => {
            if (progress.roundsCompleted % 4 === 0)
              console.log(
                JSON.stringify({
                  cohort: 'match-round',
                  seedIndex: index,
                  rotation,
                  ...progress,
                }),
              );
          },
        );
        matches.push({ ...result, seedIndex: index, rotation });
        console.log(
          JSON.stringify({
            cohort: 'completed-match',
            players,
            seedIndex: index,
            rotation,
            completed: result.completed,
            rounds: result.rounds.length,
            matches: matches.length,
            elapsedMs: Math.round(performance.now() - started),
          }),
        );
        assert.equal(
          result.completed,
          true,
          'Match exhausted per-round action cap',
        );
      }
    }
} catch (caught) {
  error = caught.stack;
}
const after = await sourceHashes(),
  stable = JSON.stringify(before) === JSON.stringify(after);
const summary = playerCounts.map((players) => {
  const cohort = matches.filter((m) => m.players === players);
  return {
    players,
    matches: cohort.length,
    rounds: cohort.reduce((n, m) => n + m.rounds.length, 0),
    actions: cohort.reduce((n, m) => n + m.actions, 0),
    maxComputeMs: Math.max(0, ...cohort.map((m) => m.maxComputeMs)),
    arceus: cohort.reduce((n, m) => n + m.arceusActivations, 0),
    hoenn: cohort.reduce((n, m) => n + m.hoennEvents, 0),
    tiers: grades.map((difficulty) => {
      const seats = cohort.flatMap((m) =>
        Object.entries(m.difficulties)
          .filter(([, d]) => d === difficulty)
          .map(([seat]) => ({ seat, m })),
      );
      const winShare = seats.reduce(
        (n, { seat, m }) =>
          n + (m.matchWinners.includes(seat) ? 1 / m.matchWinners.length : 0),
        0,
      );
      return {
        difficulty,
        seatMatches: seats.length,
        fractionalMatchWins: winShare,
        winSharePerSeat: seats.length ? winShare / seats.length : null,
        meanRoundWins: seats.length
          ? seats.reduce((n, { seat, m }) => n + m.winsBySeat[seat], 0) /
            seats.length
          : null,
      };
    }),
  };
});
const report = {
  generatedAt: new Date().toISOString(),
  seeds,
  seedBase,
  playerCounts,
  roundCap,
  sourceHashesBefore: before,
  sourceHashesAfter: after,
  sourceStable: stable,
  elapsedMs: performance.now() - started,
  error,
  completed: !error && stable,
  summary,
  matches,
  scope:
    'Authorized in-process strategy/rules simulation of complete three-win matches. Per-seat and per-player-count summaries; dual-player paired seat reversals and higher counts cyclic grade rotations. No real Worker, human timing, physical devices or audio certification. Each seed block remains correlated.',
};
await writeFile(
  join(evidence, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    evidence,
    completed: report.completed,
    sourceStable: stable,
    matches: matches.length,
    elapsedMs: Math.round(report.elapsedMs),
    summary,
  }),
);
assert.equal(stable, true, 'Sources changed during run');
assert.equal(error, null, error);
