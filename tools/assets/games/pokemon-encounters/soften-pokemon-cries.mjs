import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRelative = 'assets/games/pokemon-encounters/expansion/audio/cries';
const manifestRelative = `${runtimeRelative}/manifest.json`;
const evidenceRelative =
  'artifacts/maintenance/v1.0.3/pokemon-ui-redesign/audio';
const representatives = new Set([
  'mewtwo',
  'groudon',
  'charizard',
  'rayquaza',
  'onix',
]);
export const cryProcessing = Object.freeze({
  previousSourceGain: 0.75,
  relativeGain: 0.6,
  sourceGain: 0.45,
  trebleFrequencyHz: 3000,
  trebleGainDb: -3,
  trebleQ: 0.5,
  fadeSeconds: 0.005,
  sampleRate: 48000,
  channels: 1,
  bitrate: '24k',
  playbackVolume: 0.45,
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const repoPath = (path) => {
  const absolute = resolve(root, path);
  assert.ok(absolute.startsWith(root + sep), `Outside workspace: ${path}`);
  return absolute;
};
export function processingFilter(seconds) {
  assert.ok(Number.isFinite(seconds) && seconds > 0.01);
  return [
    'volume=0.45',
    'treble=f=3000:g=-3:t=q:w=0.5',
    'afade=t=in:st=0:d=0.005',
    `afade=t=out:st=${(seconds - 0.005).toFixed(9)}:d=0.005`,
  ].join(',');
}
function samples(bytes) {
  assert.equal(bytes.length % 4, 0, 'Invalid decoded float PCM');
  const result = new Float32Array(bytes.length / 4);
  for (let index = 0; index < result.length; index++)
    result[index] = bytes.readFloatLE(index * 4);
  return result;
}
export function sampleMetrics(values) {
  assert.ok(values.length > 0, 'Empty audio');
  let peak = 0,
    energy = 0,
    clippedSamples = 0;
  for (const value of values) {
    assert.ok(Number.isFinite(value), 'Non-finite decoded sample');
    peak = Math.max(peak, Math.abs(value));
    energy += value * value;
    if (Math.abs(value) >= 1) clippedSamples++;
  }
  const rms = Math.sqrt(energy / values.length);
  return {
    samples: values.length,
    seconds: values.length / cryProcessing.sampleRate,
    peakDb: 20 * Math.log10(peak),
    rmsDb: 20 * Math.log10(rms),
    clippedSamples,
  };
}
function correlation(first, second) {
  assert.equal(first.length, second.length);
  let product = 0,
    firstEnergy = 0,
    secondEnergy = 0;
  for (let index = 0; index < first.length; index++) {
    product += first[index] * second[index];
    firstEnergy += first[index] ** 2;
    secondEnergy += second[index] ** 2;
  }
  return product / Math.sqrt(firstEnergy * secondEnergy);
}
export function validateCryMetrics(result) {
  assert.equal(
    result.original.samples,
    result.next.samples,
    'Duration changed',
  );
  assert.equal(
    result.previous.samples,
    result.next.samples,
    'Duration changed',
  );
  assert.ok(result.next.rmsDb > -70, 'Silent result');
  assert.equal(result.next.clippedSamples, 0, 'Clipped result');
  assert.ok(result.next.peakDb <= -3, 'Peak exceeds -3 dBFS');
  assert.ok(result.rmsChangeDb <= -3.8, 'Cry was not sufficiently quieter');
  assert.ok(result.rmsChangeDb >= -8, 'Cry was excessively attenuated');
  assert.ok(
    result.highBandChangeDb <= -4,
    'High-frequency harshness was not reduced',
  );
  assert.ok(
    result.waveformCorrelationBeforeEncoding >= 0.94,
    'Processing changed the recognizable waveform excessively',
  );
}
async function audioFiles(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await audioFiles(path)));
    else if (/\.(?:wav|mp3|ogg)$/i.test(entry.name)) files.push(path);
  }
  return files;
}
async function fingerprintRetainedAudio() {
  const files = await audioFiles(repoPath('assets/games/pokemon-encounters'));
  const preserved = {};
  for (const path of files) {
    if (path.startsWith(repoPath(runtimeRelative) + sep)) continue;
    preserved[relative(root, path).replaceAll('\\', '/')] = hash(
      await readFile(path),
    );
  }
  for (const path of [
    'assets/games/pokemon-encounters/audio/manifest.json',
    'assets/games/pokemon-encounters/expansion/audio/themes.json',
    'games/pokemon-encounters/ui/sound-timing.ts',
  ])
    preserved[path] = hash(await readFile(repoPath(path)));
  return preserved;
}
async function prepareBaseline(evidence) {
  const file = join(evidence, 'baseline.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const bytes = await readFile(repoPath(manifestRelative));
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.assets.length, 27);
  assert.equal(
    manifest.encoder.volume,
    0.75,
    'Expected the original derivation',
  );
  await mkdir(join(evidence, 'previous-runtime'), { recursive: true });
  await writeFile(join(evidence, 'previous-runtime/manifest.json'), bytes, {
    flag: 'wx',
  });
  const baseline = {
    generatedAt: new Date().toISOString(),
    sourceManifestSha256: hash(bytes),
    manifest,
    retainedAudio: await fingerprintRetainedAudio(),
  };
  for (const asset of manifest.assets) {
    const current = await readFile(
      repoPath(`${runtimeRelative}/${asset.file}`),
    );
    assert.equal(hash(current), asset.sha256, `Runtime mismatch: ${asset.id}`);
    const original = await readFile(repoPath(asset.originalFile));
    assert.equal(
      hash(original),
      asset.originalSha256,
      `Original mismatch: ${asset.id}`,
    );
    await writeFile(join(evidence, 'previous-runtime', asset.file), current, {
      flag: 'wx',
    });
  }
  await writeFile(file, JSON.stringify(baseline, null, 2) + '\n', {
    flag: 'wx',
  });
  return baseline;
}
export async function softenCries({
  apply = false,
  representativeOnly = false,
} = {}) {
  assert.ok(
    !(apply && representativeOnly),
    'Only a complete validated set can be applied',
  );
  const evidence = repoPath(evidenceRelative);
  await mkdir(join(evidence, 'staged'), { recursive: true });
  const baseline = await prepareBaseline(evidence);
  const currentManifestBytes = await readFile(repoPath(manifestRelative));
  if (hash(currentManifestBytes) !== baseline.sourceManifestSha256) {
    const currentManifest = JSON.parse(currentManifestBytes);
    const reportFile = join(evidence, 'all-results.json');
    const report = JSON.parse(await readFile(reportFile, 'utf8'));
    assert.equal(
      report.applied,
      true,
      'The runtime changed outside this processing run',
    );
    assert.equal(
      report.appliedManifestSha256,
      hash(currentManifestBytes),
      'Applied manifest changed',
    );
    assert.deepEqual(
      await fingerprintRetainedAudio(),
      baseline.retainedAudio,
      'Protected audio changed',
    );
    for (const asset of currentManifest.assets) {
      assert.equal(
        hash(await readFile(repoPath(asset.originalFile))),
        asset.originalSha256,
        `Original mismatch: ${asset.id}`,
      );
      assert.equal(
        hash(await readFile(repoPath(`${runtimeRelative}/${asset.file}`))),
        asset.sha256,
        `Runtime mismatch: ${asset.id}`,
      );
      assert.equal(
        hash(await readFile(repoPath(asset.previousDerivation.file))),
        asset.previousDerivation.sha256,
        `Baseline mismatch: ${asset.id}`,
      );
    }
    return {
      assets: report.assets,
      applied: true,
      alreadyApplied: true,
      previousBytes: report.previousBytes,
      nextBytes: report.nextBytes,
      evidence: relative(root, reportFile).replaceAll('\\', '/'),
    };
  }
  const manifest = structuredClone(baseline.manifest);
  const tool = JSON.parse(
    await readFile(
      repoPath('tmp/pokemon-expansion-materials/tools/ffmpeg-tool.json'),
      'utf8',
    ),
  );
  const ffmpeg = repoPath(tool.binary);
  assert.equal(
    hash(await readFile(ffmpeg)),
    tool.binarySha256,
    'FFmpeg fingerprint changed',
  );
  const decode = async (path, filter) => {
    const result = await run(
      ffmpeg,
      [
        '-nostdin',
        '-hide_banner',
        '-v',
        'error',
        '-i',
        path,
        ...(filter ? ['-af', filter] : []),
        '-ac',
        '1',
        '-ar',
        '48000',
        '-f',
        'f32le',
        'pipe:1',
      ],
      { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    );
    return samples(result.stdout);
  };
  const filterProfile = [];
  for (const frequency of [500, 6000]) {
    const measureTone = async (filter) => {
      const output = await run(
        ffmpeg,
        [
          '-nostdin',
          '-hide_banner',
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          `sine=frequency=${frequency}:sample_rate=48000:duration=1`,
          ...(filter ? ['-af', filter] : []),
          '-f',
          'f32le',
          'pipe:1',
        ],
        { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      );
      return sampleMetrics(samples(output.stdout));
    };
    const [before, after] = await Promise.all([
      measureTone('volume=0.75'),
      measureTone(processingFilter(1)),
    ]);
    filterProfile.push({ frequency, changeDb: after.rmsDb - before.rmsDb });
  }
  assert.ok(
    Math.abs(filterProfile[0].changeDb - 20 * Math.log10(0.6)) < 0.25,
    'Low-frequency gain changed excessively',
  );
  assert.ok(
    filterProfile[1].changeDb - filterProfile[0].changeDb <= -2,
    'High shelf failed its frequency response check',
  );
  const results = [];
  for (const asset of manifest.assets) {
    if (representativeOnly && !representatives.has(asset.id)) continue;
    const original = repoPath(asset.originalFile);
    assert.equal(
      hash(await readFile(original)),
      asset.originalSha256,
      `Original mismatch: ${asset.id}`,
    );
    const previous = join(evidence, 'previous-runtime', asset.file);
    assert.equal(
      hash(await readFile(previous)),
      asset.sha256,
      `Baseline mismatch: ${asset.id}`,
    );
    const staged = join(evidence, 'staged', asset.file);
    const originalSamples = await decode(original);
    const filter = processingFilter(originalSamples.length / 48000);
    const encode = await run(
      ffmpeg,
      [
        '-nostdin',
        '-hide_banner',
        '-v',
        'error',
        '-y',
        '-i',
        original,
        '-af',
        filter,
        '-ac',
        '1',
        '-ar',
        '48000',
        '-c:a',
        'libopus',
        '-b:a',
        '24k',
        '-map_metadata',
        '-1',
        staged,
      ],
      { windowsHide: true },
    );
    const before = sampleMetrics(await decode(previous));
    const after = sampleMetrics(await decode(staged));
    const oldHighBand = sampleMetrics(
      await decode(previous, 'highpass=f=3000:p=2'),
    );
    const newHighBand = sampleMetrics(
      await decode(staged, 'highpass=f=3000:p=2'),
    );
    const processedSamples = await decode(original, filter);
    const bytes = await readFile(staged);
    const result = {
      id: asset.id,
      category: asset.category,
      file: asset.file,
      sourceSha256: asset.originalSha256,
      previousSha256: asset.sha256,
      nextSha256: hash(bytes),
      previousBytes: asset.bytes,
      nextBytes: bytes.length,
      original: sampleMetrics(originalSamples),
      previous: before,
      next: after,
      rmsChangeDb: after.rmsDb - before.rmsDb,
      highBandChangeDb: newHighBand.rmsDb - oldHighBand.rmsDb,
      highBandRelativeChangeDb:
        newHighBand.rmsDb - oldHighBand.rmsDb - (after.rmsDb - before.rmsDb),
      waveformCorrelationBeforeEncoding: correlation(
        originalSamples,
        processedSamples,
      ),
      filter,
      encoderStderr: encode.stderr,
      verificationScope:
        'Offline decoding and waveform checks; no playback or human listening.',
    };
    const metricFile = join(evidence, `${asset.id}-metrics.json`);
    await writeFile(metricFile, JSON.stringify(result, null, 2) + '\n');
    try {
      validateCryMetrics(result);
    } catch (error) {
      await writeFile(
        join(evidence, `${asset.id}-failed-metrics.json`),
        JSON.stringify({ error: error.message, result }, null, 2) + '\n',
      );
      throw error;
    }
    results.push(result);
    asset.previousDerivation = {
      bytes: asset.bytes,
      sha256: asset.sha256,
      gain: 0.75,
      file: `${evidenceRelative}/previous-runtime/${asset.file}`,
      manifest: `${evidenceRelative}/previous-runtime/manifest.json`,
      playbackVerification: asset.playbackVerification,
    };
    asset.bytes = bytes.length;
    asset.sha256 = result.nextSha256;
    asset.runtimeRevision = 2;
    asset.transformation =
      'From preserved full original source: Ogg/Opus 24kbps mono 48000Hz, gain 0.45 (previous 0.75 × 0.6), 3kHz high shelf -3dB/Q0.5, first/last 5ms fade; no trimming or pitch change. Global playback volume remains 0.45.';
    asset.processing = { ...cryProcessing, filter };
    asset.runtimePeakDb = after.peakDb;
    asset.runtimeRmsDb = after.rmsDb;
    asset.runtimeDecodedAtImport = true;
    asset.runtimeDecodeRecord = `${evidenceRelative}/all-results.json`;
    asset.playbackVerification = {
      decodedVerified: true,
      playbackCallsVerified: false,
      humanListeningVerified: false,
      evidence: `${evidenceRelative}/all-results.json`,
      scope:
        'New derivation verified offline; final-package playback must be verified separately.',
    };
  }
  assert.deepEqual(
    await fingerprintRetainedAudio(),
    baseline.retainedAudio,
    'Protected audio changed',
  );
  const report = {
    generatedAt: new Date().toISOString(),
    applied: false,
    representativeOnly,
    processing: cryProcessing,
    filterProfile,
    toolSha256: tool.binarySha256,
    sourceManifestSha256: baseline.sourceManifestSha256,
    assets: results.length,
    previousBytes: results.reduce(
      (total, entry) => total + entry.previousBytes,
      0,
    ),
    nextBytes: results.reduce((total, entry) => total + entry.nextBytes, 0),
    protectedAudio: baseline.retainedAudio,
    results,
    humanListeningVerified: false,
  };
  const reportFile = join(
    evidence,
    representativeOnly ? 'representative-results.json' : 'all-results.json',
  );
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  if (apply) {
    assert.equal(results.length, 27);
    const currentManifest = await readFile(repoPath(manifestRelative));
    assert.equal(
      hash(currentManifest),
      baseline.sourceManifestSha256,
      'Manifest changed during derivation',
    );
    for (const result of results)
      assert.equal(
        hash(await readFile(repoPath(`${runtimeRelative}/${result.file}`))),
        result.previousSha256,
        `Runtime changed during derivation: ${result.id}`,
      );
    manifest.encoder = {
      ...manifest.encoder,
      volume: 0.45,
      processing: cryProcessing,
      script: 'tools/assets/games/pokemon-encounters/soften-pokemon-cries.mjs',
    };
    manifest.scope =
      'Expansion-only public draw feedback. Revision 2 softens the 27 imported cries relative to the previous runtime; full sources, prior derivations, user-provided audio and original themes are preserved. Human listening, source game generation and reuse license remain unverified.';
    try {
      for (const result of results)
        await copyFile(
          join(evidence, 'staged', result.file),
          repoPath(`${runtimeRelative}/${result.file}`),
        );
      await writeFile(
        repoPath(manifestRelative),
        JSON.stringify(manifest, null, 2) + '\n',
      );
    } catch (error) {
      for (const result of results)
        await copyFile(
          join(evidence, 'previous-runtime', result.file),
          repoPath(`${runtimeRelative}/${result.file}`),
        );
      await writeFile(repoPath(manifestRelative), currentManifest);
      throw error;
    }
    for (const result of results)
      assert.equal(
        hash(await readFile(repoPath(`${runtimeRelative}/${result.file}`))),
        result.nextSha256,
      );
    report.applied = true;
    report.appliedManifestSha256 = hash(
      await readFile(repoPath(manifestRelative)),
    );
    await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  }
  return {
    assets: results.length,
    applied: apply,
    previousBytes: report.previousBytes,
    nextBytes: report.nextBytes,
    maximumPeakDb: Math.max(...results.map((entry) => entry.next.peakDb)),
    rmsChangeDbRange: [
      Math.min(...results.map((entry) => entry.rmsChangeDb)),
      Math.max(...results.map((entry) => entry.rmsChangeDb)),
    ],
    evidence: relative(root, reportFile).replaceAll('\\', '/'),
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(
    JSON.stringify(
      await softenCries({
        apply: process.argv.includes('--apply'),
        representativeOnly: process.argv.includes('--representatives'),
      }),
    ),
  );
