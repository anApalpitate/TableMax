import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
const name = process.argv[2];
assert.equal(process.argv.length, 3);
assert.match(name, /^[a-zA-Z0-9_-]+$/);
const evidence = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-flow-audit',
  name,
);
await mkdir(resolve(evidence, '..'), { recursive: true });
await mkdir(evidence, { recursive: false });
const temporary = resolve('tmp/pokemon-expansion-flow', name);
await mkdir(temporary, { recursive: true });
const bundle = join(temporary, 'runner.cjs');
const compilation = await build({
  entryPoints: ['scripts/pokemon-expansion-flow-runner.mjs'],
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
    'scripts/measure-pokemon-expansion-flow.mjs',
    'package.json',
    'pnpm-lock.yaml',
  ]),
].sort();
const hashes = async () =>
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
const before = await hashes(),
  { measureFlow } = createRequire(import.meta.url)(bundle),
  matches = [],
  started = performance.now();
let error = null;
try {
  for (const players of [2, 3, 4, 5, 6]) {
    const levels =
      players === 2
        ? ['doubao', 'juewu']
        : Array.from(
            { length: players },
            (_, i) => ['default', 'doubao', 'juewu'][i % 3],
          );
    const result = await measureFlow(
      players,
      1060201 + players * 1009,
      levels,
      1200,
      (progress) => {
        if (progress.roundsCompleted % 4 === 0)
          console.log(JSON.stringify({ kind: 'flow-round', ...progress }));
      },
    );
    matches.push(result);
    console.log(
      JSON.stringify({
        kind: 'completed-flow-match',
        players,
        rounds: result.rounds.length,
        actions: result.actions,
        completed: result.completed,
      }),
    );
    assert.equal(result.completed, true, 'Action cap exceeded');
  }
} catch (caught) {
  error = caught.stack;
}
const after = await hashes(),
  sourceStable = JSON.stringify(before) === JSON.stringify(after);
const report = {
  generatedAt: new Date().toISOString(),
  seedBase: 1060201,
  sourceHashesBefore: before,
  sourceHashesAfter: after,
  sourceStable,
  completed: !error && sourceStable,
  error,
  elapsedMs: performance.now() - started,
  matches,
  scope:
    'Five serial mixed-tier full matches, one fixed seed per player count. Supplemental flow observation, not tier-strength replication or human timing. Identity-based cover episodes; Arceus same-action reveal included; settlement forced reveals excluded. Delays count saved game actions, not turns or seconds. No card identities or values in flow summaries.',
};
await writeFile(
  join(evidence, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    evidence,
    completed: report.completed,
    sourceStable,
    matches: matches.length,
    rounds: matches.reduce((n, m) => n + m.rounds.length, 0),
    actions: matches.reduce((n, m) => n + m.actions, 0),
    elapsedMs: report.elapsedMs,
  }),
);
assert.equal(sourceStable, true, 'Measurement sources changed');
assert.equal(error, null, error);
