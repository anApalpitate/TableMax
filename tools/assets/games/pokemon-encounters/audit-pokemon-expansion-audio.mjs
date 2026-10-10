import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve('assets/games/pokemon-encounters/expansion/audio');
const provenancePath =
  'artifacts/pokemon-expansion/encyclopedia-cries/public-api-file-provenance-20261006/provenance.json';
const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
const criesPath = join(root, 'cries/manifest.json');
const cries = JSON.parse(await readFile(criesPath, 'utf8'));
const themesPath = join(root, 'themes.json');
const themes = JSON.parse(await readFile(themesPath, 'utf8'));
const checks = [];
const digest = (buffer, algorithm = 'sha256') =>
  createHash(algorithm).update(buffer).digest('hex');
assert.equal(cries.assets.length, 27);
assert.equal(themes.assets.length, 8);
for (const asset of cries.assets) {
  const source = provenance.rows.find((row) => row.id === asset.id);
  assert.ok(source?.sourceSha1Matches);
  const original = await readFile(resolve(asset.originalFile));
  const runtime = await readFile(join(root, 'cries', asset.file));
  assert.equal(digest(original), asset.originalSha256);
  assert.equal(digest(original, 'sha1'), source.apiSha1);
  assert.equal(digest(runtime), asset.sha256);
  assert.equal(runtime.length, asset.bytes);
  asset.sourceProvenance = {
    evidence: provenancePath,
    descriptionUrl: source.descriptionUrl,
    uploadedAt: source.uploadedAt,
    originalSha1: source.apiSha1,
    originalMatchesPublicFile: true,
    wikiUsageLabel: 'I-Fairuse-audio-effects',
    projectRedistributionPermissionConfirmed: false,
    gameGeneration: null,
  };
  asset.playbackVerification = {
    decodedAndPlaybackCallsVerified: true,
    evidence:
      'artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/forecast-match-final-20261006/results.json',
    scope:
      'Existing same-byte audio in the prior verified package; final-package playback is recorded separately in acceptance. Human listening unverified.',
  };
  checks.push({
    id: asset.id,
    sourceSha256: digest(original),
    runtimeSha256: digest(runtime),
    sourceSha1: digest(original, 'sha1'),
  });
}
for (const asset of themes.assets) {
  const original = await readFile(resolve(asset.originalFile));
  const runtime = await readFile(join(root, asset.file));
  assert.equal(digest(original), asset.originalSha256);
  assert.equal(digest(runtime), asset.sha256);
  assert.equal(runtime.length, asset.bytes);
  assert.equal(asset.sourceKind, 'original-procedural-theme');
  checks.push({
    id: `${asset.id}-theme`,
    sourceSha256: digest(original),
    runtimeSha256: digest(runtime),
  });
}
themes.purpose =
  'Original procedural ability and research themes complement existing character cries; they do not replace the 27 imported cries.';
await writeFile(criesPath, JSON.stringify(cries, null, 2) + '\n');
await writeFile(themesPath, JSON.stringify(themes, null, 2) + '\n');
const output = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/audio',
);
await mkdir(output, { recursive: true });
await writeFile(
  join(output, 'provenance-audit.json'),
  JSON.stringify(
    {
      result: 'passed',
      resourcesPreserved: true,
      downloadedOrReencoded: false,
      checks,
      unknowns: [
        'game generation',
        'project redistribution permission',
        'human listening',
      ],
    },
    null,
    2,
  ) + '\n',
);
process.stdout.write(
  JSON.stringify({ result: 'passed', cries: 27, themes: 8, output }) + '\n',
);
