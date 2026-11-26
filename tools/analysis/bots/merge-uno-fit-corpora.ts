import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { naturalFitCorpus } from './uno-fit-corpus';

const { values } = parseArgs({
  options: {
    fit: { type: 'string', multiple: true },
    report: { type: 'string' },
  },
});
if (!values.fit || values.fit.length < 2 || !values.report)
  throw new Error('Pass two or more --fit corpora and a --report path');

const sha = (contents: Buffer | string) =>
  createHash('sha256').update(contents).digest('hex');

const inputs = values.fit.map((path) => {
  const bytes = readFileSync(path);
  return { value: JSON.parse(bytes.toString('utf8')), sha256: sha(bytes) };
});
const naturalOptions = inputs[0]!.value?.naturalOptions;
if (!naturalOptions)
  throw new Error('The first corpus has no recorded sampling budget');

const corpora = inputs
  .map(({ value, sha256 }) => {
    if (!Array.isArray(value?.fit) || !value.fit.length)
      throw new Error(
        'Each natural fit corpus must identify a non-empty seed partition',
      );
    const seeds = value.fit.map(
      (entry: { seed?: number } | null) => entry?.seed,
    );
    if (
      seeds.some(
        (seed: unknown) =>
          typeof seed !== 'number' ||
          !Number.isInteger(seed) ||
          seed < 1 ||
          seed > 0xffffffff,
      )
    )
      throw new Error('Invalid natural fit opening seed');
    return {
      corpus: naturalFitCorpus(value, naturalOptions, seeds),
      sha256,
      seeds: seeds as number[],
    };
  })
  .sort((a, b) => a.sha256.localeCompare(b.sha256));

const all = corpora
  .flatMap(({ corpus }) => corpus.fit)
  .sort((a, b) => a.seed - b.seed);
const combined = all.map(({ seed }) => seed);
if (new Set(combined).size !== combined.length)
  throw new Error('Natural fit seed partitions overlap');

const pilot = corpora[0]!.corpus.pilot;
const sources = corpora.map(({ corpus, sha256, seeds }) => ({
  sha256,
  seeds,
  sourceBatchDigest: corpus.sourceBatchDigest,
  sourceReportSha256: corpus.sourceReportSha256,
  sourceSha256: corpus.sourceSha256,
}));
const sourceSha256 = sha(readFileSync(new URL(import.meta.url)));
const sourceBatchDigest = sha(
  JSON.stringify({ pilot, naturalOptions, sources, sourceSha256 }),
);
const report = {
  type: 'uno-natural-fit-merge',
  version: 1,
  sourceBatchDigest,
  sourceSha256,
  pilot,
  naturalOptions,
  sources,
  fitSeeds: combined,
  fitRows: all.reduce((sum, { rows }) => sum + rows.length, 0),
};
const reportBytes = JSON.stringify(report, null, 2) + '\n';
try {
  writeFileSync(values.report, reportBytes, { flag: 'wx' });
} catch (error) {
  if (
    (error as NodeJS.ErrnoException).code !== 'EEXIST' ||
    !readFileSync(values.report).equals(Buffer.from(reportBytes))
  )
    throw error;
}
const merged = {
  type: 'uno-natural-fit-corpus',
  version: 1,
  pilot,
  naturalOptions,
  sourceBatchDigest,
  sourceReportSha256: sha(reportBytes),
  sourceSha256,
  fit: all,
};
console.log(
  JSON.stringify(naturalFitCorpus(merged, naturalOptions, combined), null, 2),
);
