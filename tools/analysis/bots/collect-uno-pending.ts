import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import { isUnoLeafFeatureVersion } from '../../../games/uno/bot/calibration';
import {
  collectPendingSeed,
  pendingCalibration,
  type PendingSeedEvidence,
} from './uno-pending';
import { unoPilotEvidence } from './uno-pilot';

const { values } = parseArgs({
  options: {
    'fit-seeds': { type: 'string' },
    'feature-version': { type: 'string', default: '1' },
    'fit-data': { type: 'string' },
    'review-seeds': { type: 'string' },
    continuations: { type: 'string', default: '16' },
    'max-steps': { type: 'string', default: '15000' },
    jobs: { type: 'string', default: '1' },
    worker: { type: 'string' },
  },
});
const featureVersion = Number(values['feature-version']);
if (!isUnoLeafFeatureVersion(featureVersion))
  throw new Error('Invalid UNO leaf feature version');
const options = {
  continuations: Number(values.continuations),
  maxSteps: Number(values['max-steps']),
};
if (
  !Number.isSafeInteger(options.continuations) ||
  options.continuations < 16 ||
  !Number.isSafeInteger(options.maxSteps) ||
  options.maxSteps < 1
)
  throw new Error('Invalid UNO pending calibration rollout budget');

if (values.worker !== undefined) {
  console.log(
    JSON.stringify(
      await collectPendingSeed(Number(values.worker), options, featureVersion),
    ),
  );
} else {
  const seeds = (input: string | undefined) => input?.split(',').map(Number);
  const fitBytes = values['fit-data'] ? readFileSync(values['fit-data']) : null;
  const frozenFit =
    fitBytes &&
    pendingCalibration(JSON.parse(fitBytes.toString('utf8')), featureVersion);
  if (
    frozenFit &&
    (values['fit-seeds'] !== undefined ||
      !isDeepStrictEqual(frozenFit.options, options))
  )
    throw new Error(
      'Reusing pending fit data requires the original budget and no new fit seeds',
    );
  const fitSeeds = frozenFit
    ? frozenFit.fit.map(({ seed }) => seed)
    : seeds(values['fit-seeds']);
  const reviewSeeds = seeds(values['review-seeds']);
  if (!fitSeeds?.length || !reviewSeeds?.length)
    throw new Error('Provide fit data or fit seeds, and new review seeds');
  const earlierReview = new Set(
    frozenFit ? frozenFit.review.map(({ seed }) => seed) : [],
  );
  if (reviewSeeds.some((seed) => earlierReview.has(seed)))
    throw new Error(
      'The new pending review must use independent opening seeds',
    );
  const all = [...fitSeeds, ...reviewSeeds];
  if (
    new Set(all).size !== all.length ||
    all.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)
  )
    throw new Error('Use disjoint positive 32-bit pending calibration seeds');
  const work = frozenFit ? reviewSeeds : all;
  const maximum = Math.min(8, Math.max(1, availableParallelism() - 2));
  const jobs = Number(values.jobs);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > maximum)
    throw new Error('Invalid pending calibration job count');
  const output = new Map<number, PendingSeedEvidence>();
  const runChild = promisify(execFile);
  let assigned = 0;
  const stopped = new AbortController();
  const stop = () =>
    stopped.abort(new Error('Pending sample collection interrupted'));
  if (jobs > 1) {
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
  const collect = async () => {
    while (assigned < work.length && !stopped.signal.aborted) {
      const seed = work[assigned++]!;
      try {
        const result: PendingSeedEvidence =
          jobs === 1
            ? await collectPendingSeed(seed, options, featureVersion)
            : JSON.parse(
                (
                  await runChild(
                    process.execPath,
                    [
                      '--import',
                      'tsx',
                      fileURLToPath(import.meta.url),
                      '--worker=' + seed,
                      '--feature-version=' + featureVersion,
                      '--continuations=' + options.continuations,
                      '--max-steps=' + options.maxSteps,
                    ],
                    {
                      windowsHide: true,
                      encoding: 'utf8',
                      signal: stopped.signal,
                    },
                  )
                ).stdout,
              );
        if (result.seed !== seed)
          throw new Error('Wrong pending sample assignment');
        output.set(seed, result);
        console.error(
          JSON.stringify({
            seed,
            found: result.found,
            completed: output.size,
            total: work.length,
          }),
        );
      } catch (error) {
        stopped.abort(error);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(jobs, work.length) }, collect),
  );
  if (jobs > 1) {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
  stopped.signal.throwIfAborted();
  console.log(
    JSON.stringify(
      pendingCalibration(
        {
          type: 'uno-pending-calibration',
          version: 1,
          ...(featureVersion === 1 ? {} : { featureVersion }),
          pilot: unoPilotEvidence,
          options,
          fit: frozenFit
            ? frozenFit.fit
            : fitSeeds.map((seed) => output.get(seed)!),
          review: reviewSeeds.map((seed) => output.get(seed)!),
          ...(fitBytes
            ? {
                frozenFitSourceSha256: createHash('sha256')
                  .update(fitBytes)
                  .digest('hex'),
              }
            : {}),
        },
        featureVersion,
      ),
      null,
      2,
    ),
  );
}
