import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { createGameRegistry } from '../../../apps/server/src/game-registry';
import { PackageStore } from '../../../apps/server/src/game-packages/store';
import { PROJECT_GAME_PUBLIC_KEY } from '../../../apps/server/src/game-packages/project-public-key';
import { LocalBotModels } from '../../../apps/server/src/local-bot-models';
import { botModelBinding } from '../../../packages/platform-core/src/bot-model';
import {
  summarizeUnoComparison,
  unoComparisonDecision,
} from './uno-paired-statistics';

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    'games-dir': { type: 'string' },
    calibration: { type: 'string' },
    correction: { type: 'string' },
    comparison: { type: 'string' },
    'runtime-proof': { type: 'string' },
    deactivate: { type: 'string' },
  },
});
if (!values['data-dir'])
  throw new Error('Specify the intended local application data directory');
const models = new LocalBotModels(values['data-dir']);
if (values.deactivate) {
  models.deactivate(values.deactivate);
  console.log(JSON.stringify({ deactivated: values.deactivate }));
} else {
  if (!values['games-dir'])
    throw new Error('Specify the signed installed game store');
  const sha = (bytes: string | Buffer) =>
    createHash('sha256').update(bytes).digest('hex');
  function report(path: string | undefined) {
    if (!path)
      throw new Error(
        'Supply the calibration, correction, comparison and Worker reports',
      );
    const bytes = readFileSync(path);
    return { value: JSON.parse(bytes.toString('utf8')), sha256: sha(bytes) };
  }
  const calibration = report(values.calibration);
  const correction = report(values.correction);
  const comparison = report(values.comparison);
  const runtime = report(values['runtime-proof']);
  const leafDigest = sha(JSON.stringify(calibration.value.calibration));
  const candidateDigest = sha(JSON.stringify(correction.value.model));
  const looks = comparison.value.plan?.looks;
  const seed = comparison.value.plan?.bootstrapSeed;
  const samples = calibration.value.options?.hypotheses;
  if (
    calibration.value.type !== 'uno-calibration-development' ||
    calibration.value.evaluation !== 'meets-measured-gates' ||
    calibration.value.calibrationDigest !== leafDigest ||
    (samples !== 8 && samples !== 16) ||
    correction.value.type !== 'uno-residual-candidate' ||
    !(correction.value.model?.weight > 0) ||
    correction.value.calibrationDigest !== leafDigest ||
    comparison.value.type !== 'uno-abc-acceptance' ||
    comparison.value.decision !== 'meets-win-rate-gate' ||
    comparison.value.calibrationDigest !== leafDigest ||
    comparison.value.candidateDigest !== candidateDigest ||
    comparison.value.failures !== 0 ||
    comparison.value.undispatched?.length !== 0 ||
    !Array.isArray(comparison.value.blocks) ||
    (looks !== 1 && looks !== 2) ||
    !Number.isInteger(seed) ||
    seed < 1 ||
    seed > 0xffffffff
  )
    throw new Error(
      'The UNO calibration and paired comparison do not approve this model',
    );

  const paired = summarizeUnoComparison(
    comparison.value.blocks,
    'C',
    'B',
    seed,
    looks,
  );
  if (
    unoComparisonDecision(paired, comparison.value.blocks, false) !==
    'meets-win-rate-gate'
  )
    throw new Error(
      'The declared acceptance does not match the paired block results',
    );

  const packages = new PackageStore({
    root: values['games-dir'],
    publicKey: PROJECT_GAME_PUBLIC_KEY,
  });
  const installed = packages.current('uno');
  if (!installed || !packages.resolveModule(installed.releaseId))
    throw new Error('The current signed UNO release is not available');
  const game = await createGameRegistry(false, packages).load(
    'uno',
    undefined,
    installed.releaseId,
  );
  const binding = botModelBinding(game, 'juewu');
  if (!binding || !game.bot.model)
    throw new Error('The current signed UNO release cannot pin a local model');
  const proof = runtime.value;
  if (
    proof?.type !== 'uno-model-worker-acceptance' ||
    proof.result !== 'passed' ||
    !isDeepStrictEqual(proof.binding, binding) ||
    proof.calibrationDigest !== leafDigest ||
    proof.candidateDigest !== candidateDigest ||
    proof.workerOldGenerationMiB !== 32 ||
    !Number.isFinite(proof.maxDecisionMs) ||
    proof.maxDecisionMs <= 0 ||
    proof.maxDecisionMs >= 2000 ||
    proof.failures !== 0 ||
    proof.restart !== 'passed' ||
    proof.rollback !== 'passed' ||
    proof.keyPositions !== 'passed'
  )
    throw new Error(
      'The Worker, recovery and key-position evidence does not approve this binding',
    );
  const model = game.bot.model.validate({
    version: 1,
    samples,
    calibration: calibration.value.calibration,
    calibrationDigest: leafDigest,
    correction: correction.value.model,
  });
  const modelRef = models.promote({
    version: 1,
    binding,
    reviews: {
      calibration: calibration.sha256,
      comparison: comparison.sha256,
      runtime: runtime.sha256,
    },
    model,
  });
  console.log(JSON.stringify({ modelRef, binding }));
}
