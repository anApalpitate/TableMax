import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  cryProcessing,
  processingFilter,
  sampleMetrics,
  validateCryMetrics,
} from './soften-pokemon-cries.mjs';

test('softening lowers the existing cries while leaving the shared playback volume intact', async () => {
  assert.equal(
    cryProcessing.sourceGain / cryProcessing.previousSourceGain,
    0.6,
  );
  assert.equal(cryProcessing.playbackVolume, 0.45);
  const timing = await readFile(
    'games/pokemon-encounters/ui/sound-timing.ts',
    'utf8',
  );
  assert.match(timing, /SOUND_PLAYBACK_VOLUME = 0\.45/);
  assert.equal(
    processingFilter(1),
    'volume=0.45,treble=f=3000:g=-3:t=q:w=0.5,afade=t=in:st=0:d=0.005,afade=t=out:st=0.995000000:d=0.005',
  );
  assert.throws(() => processingFilter(0.005));
});

const valid = () => ({
  original: { samples: 48000 },
  previous: { samples: 48000 },
  next: { samples: 48000, rmsDb: -18, peakDb: -6, clippedSamples: 0 },
  rmsChangeDb: -4.7,
  highBandChangeDb: -6.2,
  waveformCorrelationBeforeEncoding: 0.99,
});

test('the quality gate catches truncation, clipping, absent attenuation/filtering and excessive changes', () => {
  validateCryMetrics(valid());
  for (const mutate of [
    (result) => result.next.samples--,
    (result) => result.next.clippedSamples++,
    (result) => (result.next.rmsDb = -75),
    (result) => (result.next.peakDb = -0.1),
    (result) => (result.rmsChangeDb = -1),
    (result) => (result.rmsChangeDb = -10),
    (result) => (result.highBandChangeDb = -1),
    (result) => (result.waveformCorrelationBeforeEncoding = 0.5),
  ]) {
    const result = valid();
    mutate(result);
    assert.throws(() => validateCryMetrics(result));
  }
  const measured = sampleMetrics(new Float32Array([0, 0.5, -0.5, 0]));
  assert.equal(measured.samples, 4);
  assert.equal(measured.clippedSamples, 0);
  assert.ok(measured.peakDb < -6);
  assert.equal(sampleMetrics(new Float32Array([1, -1])).clippedSamples, 2);
  assert.throws(() => sampleMetrics(new Float32Array([NaN])));
});

test('all 27 packaged cries retain full original sources and immutable prior derivations', async () => {
  const directory = 'assets/games/pokemon-encounters/expansion/audio/cries';
  const manifest = JSON.parse(
    await readFile(`${directory}/manifest.json`, 'utf8'),
  );
  assert.equal(manifest.assets.length, 27);
  assert.equal(manifest.encoder.volume, 0.45);
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  for (const asset of manifest.assets) {
    assert.equal(asset.runtimeRevision, 2);
    assert.equal(
      digest(await readFile(asset.originalFile)),
      asset.originalSha256,
    );
    assert.equal(
      digest(await readFile(`${directory}/${asset.file}`)),
      asset.sha256,
    );
    assert.equal(
      digest(await readFile(asset.previousDerivation.file)),
      asset.previousDerivation.sha256,
    );
    assert.equal(asset.processing.relativeGain, 0.6);
    assert.equal(asset.processing.playbackVolume, 0.45);
    assert.equal(asset.playbackVerification.humanListeningVerified, false);
    assert.equal(asset.playbackVerification.playbackCallsVerified, false);
    assert.equal(
      asset.sourceProvenance.projectRedistributionPermissionConfirmed,
      false,
    );
  }
});
