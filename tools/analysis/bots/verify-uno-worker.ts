import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createGameRegistry } from '../../../apps/server/src/game-registry';
import { PROJECT_GAME_PUBLIC_KEY } from '../../../apps/server/src/game-packages/project-public-key';
import { PackageStore } from '../../../apps/server/src/game-packages/store';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';
import { unoComparisonPasses } from './uno-comparison-plan';
import { verifyUnoWorker } from './uno-worker-verification';

const { values } = parseArgs({
  options: {
    'preinstalled-dir': { type: 'string' },
    worker: { type: 'string' },
    'application-manifest': { type: 'string' },
    'verification-dir': { type: 'string' },
    calibration: { type: 'string' },
    correction: { type: 'string' },
    comparison: { type: 'string' },
  },
});

function required(name: keyof typeof values) {
  const path = values[name];
  if (!path) throw new Error('Provide --' + name);
  return path;
}
const digest = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');
function report(path: string) {
  const bytes = readFileSync(path);
  return {
    contents: JSON.parse(bytes.toString('utf8')),
    sha256: digest(bytes),
  };
}
const { contents: b, sha256: bReportSha256 } = report(required('calibration'));
const { contents: c, sha256: cReportSha256 } = report(required('correction'));
const { contents: paired, sha256: comparisonDigest } = report(
  required('comparison'),
);
const samples = b.options?.hypotheses;
assert.ok(samples === 8 || samples === 16);
assert.ok(
  [b, c, paired].every((item) => isCurrentUnoPilot(item?.pilot)),
  'The results do not match the current UNO pilot',
);
const calibrationDigest = digest(JSON.stringify(b.calibration));
const candidateDigest = digest(JSON.stringify(c.model));
assert.ok(
  b.type === 'uno-calibration-development' &&
    b.evaluation === 'meets-measured-gates' &&
    c.type === 'uno-residual-candidate' &&
    c.model?.weight > 0 &&
    unoComparisonPasses(paired, bReportSha256, cReportSha256) &&
    [b, c, paired].every(
      (item) => item.calibrationDigest === calibrationDigest,
    ) &&
    paired.candidateDigest === candidateDigest,
  'Worker acceptance needs the same measured B and paired C results',
);

const preinstalled = required('preinstalled-dir');
const worker = required('worker');
const scratchArg = required('verification-dir');
assert.ok(
  lstatSync(scratchArg).isDirectory() &&
    !lstatSync(scratchArg).isSymbolicLink(),
);
const scratch = realpathSync(scratchArg);
assert.equal(
  readdirSync(scratch).length,
  0,
  'Use an empty isolated verification directory',
);
const { contents: manifest, sha256: applicationManifestSha256 } = report(
  required('application-manifest'),
);
assert.equal(manifest.edition, 'full');
assert.ok(Array.isArray(manifest.files));
const manifestRecord = (path: string) => {
  const matches = manifest.files.filter(
    (row: { path?: string }) => row.path === path,
  );
  assert.equal(
    matches.length,
    1,
    'The application manifest does not bind ' + path,
  );
  return matches[0];
};
const bootstrapDigest = digest(
  readFileSync(join(preinstalled, 'bootstrap.json')),
);
const workerBytes = readFileSync(worker);
const workerSha256 = digest(workerBytes);
const workerRecord = manifestRecord('bot-worker.cjs');
assert.equal(
  workerSha256,
  workerRecord.sha256,
  'The Worker bytes do not match the frozen manifest',
);
assert.equal(
  workerBytes.length,
  workerRecord.bytes,
  'The Worker size does not match the frozen manifest',
);
assert.equal(
  bootstrapDigest,
  manifestRecord('preinstalled-games/bootstrap.json').sha256,
);

const packages = new PackageStore({
  root: join(scratch, 'signed-games'),
  publicKey: PROJECT_GAME_PUBLIC_KEY,
  protectedReleaseIds: () => [],
});
await packages.importPreinstalled(preinstalled);
assert.equal(packages.currentMappingSha256, bootstrapDigest);
const release = packages.current('uno');
assert.ok(release, 'The signed package does not contain UNO');
const entry = packages.resolveModule(release.releaseId);
assert.ok(entry, 'Cannot load the verified UNO release');
const game = await createGameRegistry(false, packages).load(
  'uno',
  undefined,
  release.releaseId,
);
assert.ok(
  game.bot.id === unoPilotEvidence.strategyId &&
    game.bot.version === unoPilotEvidence.strategyVersion &&
    game.rules.manifest.rulesVersion === unoPilotEvidence.rulesVersion &&
    game.rules.manifest.gameVersion === unoPilotEvidence.gameVersion &&
    game.rules.manifest.stateVersion === unoPilotEvidence.stateVersion &&
    game.bot.model?.supportsMatch?.(
      unoPilotEvidence.seatCount,
      unoPilotEvidence.setup,
    ),
  'The signed UNO release does not match the current pilot',
);
const baseline = {
  version: 1,
  samples,
  calibrationDigest,
  calibration: b.calibration,
};
const evidence = await verifyUnoWorker({
  game,
  workerPath: worker,
  botEntry: join(entry.root, entry.release.module.entries.bot),
  scratch,
  baseline,
  candidate: { ...baseline, correction: c.model },
  calibrationDigest,
  comparisonDigest,
});
assert.equal(digest(readFileSync(worker)), workerSha256);
assert.equal(
  digest(readFileSync(join(preinstalled, 'bootstrap.json'))),
  bootstrapDigest,
);

console.log(
  JSON.stringify(
    {
      type: 'uno-model-worker-acceptance',
      pilot: unoPilotEvidence,
      ...evidence,
      workerSha256,
      applicationManifestSha256,
      preinstalledMappingSha256: bootstrapDigest,
      calibrationDigest,
      candidateDigest,
      comparisonDigest,
      host: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    },
    null,
    2,
  ),
);
