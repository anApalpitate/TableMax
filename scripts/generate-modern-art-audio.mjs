import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rate = 24000;
const version = 2;
const timerOnly = process.argv.includes('--time-reminder');
const output = resolve('assets/games/modern-art/audio');
const evidence = resolve(
  timerOnly
    ? 'artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio-generation'
    : 'artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio-generation',
);
const representativeOnly = process.argv.includes('--representatives');
assert.ok(!(timerOnly && representativeOnly));
const targetRms = 0.075;
const peakCeiling = 0.4;
const profiles = {
  'time-elapsed': {
    seconds: 0.34,
    description:
      'A single gentle gallery reminder: warm wooden strike and soft glass harmonic; no ticking or alarm loop',
    events: [
      { type: 'wood', at: 0, pitch: 330, gain: 0.3 },
      { type: 'glass', at: 0.035, pitch: 659.25, gain: 0.28 },
    ],
  },
  offer: {
    seconds: 0.3,
    description: 'Paper movement and a small wooden placement',
    events: [
      { type: 'paper', at: 0, gain: 0.34 },
      { type: 'wood', at: 0.07, pitch: 290, gain: 0.3 },
    ],
  },
  'auction-open': {
    seconds: 1.16,
    description:
      'Open auction: rising glass fanfare, airy sweep and bright final gallery chord',
    events: [
      {
        type: 'sweep',
        at: 0,
        pitch: 160,
        endPitch: 940,
        length: 0.34,
        gain: 0.22,
      },
      { type: 'glass', at: 0.07, pitch: 523.25, gain: 0.3 },
      { type: 'glass', at: 0.18, pitch: 659.25, gain: 0.34 },
      { type: 'glass', at: 0.29, pitch: 783.99, gain: 0.38 },
      {
        type: 'chord',
        at: 0.36,
        notes: [392, 523.25, 659.25],
        length: 0.74,
        gain: 0.46,
      },
    ],
  },
  'auction-once': {
    seconds: 0.96,
    description:
      'Once-round auction: a firm three-beat wooden procession ending in one low resonant strike',
    events: [
      { type: 'wood', at: 0, pitch: 290, gain: 0.28 },
      { type: 'wood', at: 0.12, pitch: 350, gain: 0.37 },
      { type: 'wood', at: 0.24, pitch: 430, gain: 0.45 },
      { type: 'drum', at: 0.34, pitch: 90, gain: 0.44 },
      {
        type: 'chord',
        at: 0.34,
        notes: [220, 329.63, 440],
        length: 0.57,
        gain: 0.39,
      },
    ],
  },
  'auction-sealed': {
    seconds: 1.08,
    description:
      'Sealed auction: folded-paper swish, muted low suspense harmony and two locking knocks',
    events: [
      { type: 'paper', at: 0, gain: 0.34 },
      {
        type: 'sweep',
        at: 0.05,
        pitch: 440,
        endPitch: 110,
        length: 0.42,
        gain: 0.18,
      },
      {
        type: 'chord',
        at: 0.08,
        notes: [146.83, 220, 293.66],
        length: 0.85,
        gain: 0.43,
      },
      { type: 'wood', at: 0.5, pitch: 175, gain: 0.43 },
      { type: 'wood', at: 0.66, pitch: 130, gain: 0.38 },
    ],
  },
  'auction-fixed': {
    seconds: 1.02,
    description:
      'Fixed-price auction: a descending bright price-tag melody, bell and a stable warm chord',
    events: [
      { type: 'glass', at: 0.01, pitch: 880, gain: 0.34 },
      { type: 'glass', at: 0.16, pitch: 659.25, gain: 0.35 },
      { type: 'glass', at: 0.31, pitch: 440, gain: 0.37 },
      { type: 'wood', at: 0.37, pitch: 330, gain: 0.25 },
      {
        type: 'chord',
        at: 0.39,
        notes: [261.63, 329.63, 440],
        length: 0.57,
        gain: 0.45,
      },
    ],
  },
  'double-open': {
    seconds: 1.24,
    description:
      'Double auction: two answered sweep-and-drum impacts followed by a broad paired harmony',
    events: [
      {
        type: 'sweep',
        at: 0,
        pitch: 170,
        endPitch: 620,
        length: 0.2,
        gain: 0.2,
      },
      { type: 'drum', at: 0.15, pitch: 82, gain: 0.43 },
      {
        type: 'sweep',
        at: 0.26,
        pitch: 220,
        endPitch: 840,
        length: 0.22,
        gain: 0.23,
      },
      { type: 'drum', at: 0.43, pitch: 110, gain: 0.44 },
      {
        type: 'chord',
        at: 0.46,
        notes: [220, 293.66, 440, 587.33],
        length: 0.72,
        gain: 0.43,
      },
    ],
  },
  'double-add': {
    seconds: 0.4,
    description:
      'A second painting joins the pair, two complementary glass harmonics',
    events: [
      { type: 'paper', at: 0, gain: 0.28 },
      { type: 'glass', at: 0.04, pitch: 523.25, gain: 0.42 },
      { type: 'glass', at: 0.12, pitch: 659.25, gain: 0.34 },
    ],
  },
  bid: {
    seconds: 0.3,
    description:
      'A soft gallery-glass harmonic for a saved public bid, independent of amount',
    events: [
      { type: 'glass', at: 0, pitch: 783.99, gain: 0.55 },
      { type: 'wood', at: 0.005, pitch: 390, gain: 0.15 },
    ],
  },
  'sealed-submit': {
    seconds: 0.32,
    description:
      'A paper envelope seals with a low wooden stamp; identical for every hidden amount',
    events: [
      { type: 'paper', at: 0, gain: 0.48 },
      { type: 'wood', at: 0.095, pitch: 175, gain: 0.5 },
    ],
  },
  'price-set': {
    seconds: 0.34,
    description:
      'Price label placement and a descending pair of warm harmonics',
    events: [
      { type: 'paper', at: 0, gain: 0.3 },
      { type: 'glass', at: 0.04, pitch: 659.25, gain: 0.37 },
      { type: 'glass', at: 0.12, pitch: 523.25, gain: 0.32 },
    ],
  },
  pass: {
    seconds: 0.22,
    description:
      'A quiet wooden touch acknowledges a saved pass or declined combination',
    events: [
      { type: 'wood', at: 0, pitch: 240, gain: 0.4 },
      { type: 'paper', at: 0.025, gain: 0.22 },
    ],
  },
  sale: {
    seconds: 0.54,
    description:
      'A rounded auction gavel with gentle frame-glass resonance; no amount-coded signal',
    events: [
      { type: 'wood', at: 0, pitch: 180, gain: 0.7 },
      { type: 'wood', at: 0.022, pitch: 290, gain: 0.24 },
      { type: 'glass', at: 0.055, pitch: 523.25, gain: 0.34 },
      { type: 'glass', at: 0.06, pitch: 783.99, gain: 0.18 },
    ],
  },
  'round-start': {
    seconds: 0.48,
    description: 'New paper and a brief warm gallery opening harmony',
    events: [
      { type: 'paper', at: 0, gain: 0.34 },
      {
        type: 'chord',
        at: 0.07,
        notes: [293.66, 440, 587.33],
        gain: 0.38,
        length: 0.36,
      },
    ],
  },
  'round-result': {
    seconds: 0.92,
    description:
      'Soft gallery harmony with a restrained final wooden settlement',
    events: [
      { type: 'wood', at: 0, pitch: 195, gain: 0.26 },
      {
        type: 'chord',
        at: 0.025,
        notes: [261.63, 329.63, 392, 523.25],
        gain: 0.48,
        length: 0.82,
      },
      { type: 'glass', at: 0.19, pitch: 783.99, gain: 0.13 },
    ],
  },
  'match-result': {
    seconds: 1.42,
    description: 'A spacious final gallery harmony, ending rather than looping',
    events: [
      { type: 'wood', at: 0, pitch: 180, gain: 0.22 },
      {
        type: 'chord',
        at: 0.025,
        notes: [261.63, 329.63, 392],
        gain: 0.37,
        length: 0.82,
      },
      {
        type: 'chord',
        at: 0.25,
        notes: [392, 523.25, 659.25],
        gain: 0.35,
        length: 1.02,
      },
      { type: 'glass', at: 0.39, pitch: 1046.5, gain: 0.09 },
    ],
  },
  error: {
    seconds: 0.3,
    description: 'Two soft low wooden touches for a rejected action, no alarm',
    events: [
      { type: 'wood', at: 0, pitch: 220, gain: 0.34 },
      { type: 'wood', at: 0.09, pitch: 185, gain: 0.31 },
    ],
  },
};

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0x100000000) * 2 - 1;
  };
}
function smooth(value) {
  return Math.sin((Math.PI / 2) * Math.max(0, Math.min(1, value))) ** 2;
}
function render(name, profile) {
  const seed =
    [...name].reduce(
      (value, character) =>
        Math.imul(value ^ character.charCodeAt(0), 16777619),
      2166136261,
    ) >>> 0;
  const random = generator(seed);
  const samples = new Float64Array(Math.round(profile.seconds * rate));
  for (const event of profile.events) {
    let low = 0,
      softer = 0;
    const start = Math.round(event.at * rate);
    for (let index = start; index < samples.length; index++) {
      const t = (index - start) / rate;
      let sample;
      if (event.type === 'paper') {
        low += 0.23 * (random() - low);
        softer += 0.075 * (low - softer);
        sample = (low - softer) * smooth(t / 0.014) * Math.exp(-t / 0.047);
      } else if (event.type === 'wood') {
        low += 0.19 * (random() - low);
        const body =
          Math.sin(2 * Math.PI * event.pitch * t) * Math.exp(-t / 0.045) +
          0.34 *
            Math.sin(2 * Math.PI * event.pitch * 1.79 * t) *
            Math.exp(-t / 0.028) +
          0.17 *
            Math.sin(2 * Math.PI * event.pitch * 3.04 * t) *
            Math.exp(-t / 0.017);
        sample =
          (body + low * 0.55 * Math.exp(-t / 0.011)) * smooth(t / 0.0035);
      } else if (event.type === 'glass') {
        sample =
          (Math.sin(2 * Math.PI * event.pitch * t) * Math.exp(-t / 0.14) +
            0.2 *
              Math.sin(2 * Math.PI * event.pitch * 2.18 * t) *
              Math.exp(-t / 0.075) +
            0.065 *
              Math.sin(2 * Math.PI * event.pitch * 3.76 * t) *
              Math.exp(-t / 0.04)) *
          smooth(t / 0.006);
      } else if (event.type === 'sweep') {
        if (t > event.length) break;
        low += 0.06 * (random() - low);
        const phase =
          2 *
          Math.PI *
          (event.pitch * t +
            ((event.endPitch - event.pitch) * t ** 2) / (2 * event.length));
        sample =
          (0.28 * Math.sin(phase) + low * 1.4) *
          smooth(t / 0.045) *
          smooth((event.length - t) / 0.08);
      } else if (event.type === 'drum') {
        const phase =
          2 * Math.PI * event.pitch * (t + 0.014 * (1 - Math.exp(-t / 0.035)));
        sample =
          (Math.sin(phase) + 0.16 * Math.sin(phase * 1.91)) *
          Math.exp(-t / 0.13) *
          smooth(t / 0.008);
      } else {
        if (t > event.length) break;
        const envelope =
          smooth(t / 0.026) *
          smooth((event.length - t) / 0.16) *
          Math.exp(-t / 0.58);
        sample =
          (event.notes.reduce(
            (total, pitch, note) =>
              total +
              Math.sin(2 * Math.PI * pitch * t + note * 0.21) +
              0.09 * Math.sin(2 * Math.PI * pitch * 2 * t + note * 0.21),
            0,
          ) /
            event.notes.length) *
          envelope;
      }
      samples[index] += sample * event.gain;
    }
  }
  let mean = 0,
    windowTotal = 0;
  const windows = new Float64Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    const t = index / rate;
    const window =
      smooth(t / 0.005) * smooth((profile.seconds - t - 1 / rate) / 0.03);
    windows[index] = window;
    samples[index] *= window;
    mean += samples[index];
    windowTotal += window;
  }
  // Weighted correction preserves the zero endpoints and does not add a click.
  const dcOffset = mean / windowTotal;
  let peak = 0,
    power = 0;
  for (let index = 0; index < samples.length; index++) {
    samples[index] -= dcOffset * windows[index];
    peak = Math.max(peak, Math.abs(samples[index]));
    power += samples[index] ** 2;
  }
  const gain = Math.min(
    targetRms / Math.sqrt(power / samples.length),
    peakCeiling / peak,
  );
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index++)
    pcm[index] = Math.round(samples[index] * gain * 32767);
  return { pcm, seed, normalizationGain: gain };
}
function wav(pcm) {
  const buffer = Buffer.alloc(44 + pcm.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(pcm.length * 2, 40);
  for (let index = 0; index < pcm.length; index++)
    buffer.writeInt16LE(pcm[index], 44 + index * 2);
  return buffer;
}
function spectralPower(pcm) {
  const size = 2 ** Math.ceil(Math.log2(pcm.length));
  const real = new Float64Array(size),
    imag = new Float64Array(size);
  for (let index = 0; index < pcm.length; index++)
    real[index] = pcm[index] / 32768;
  for (let index = 1, reverse = 0; index < size; index++) {
    let bit = size >> 1;
    while (reverse & bit) {
      reverse ^= bit;
      bit >>= 1;
    }
    reverse ^= bit;
    if (index < reverse)
      [real[index], real[reverse]] = [real[reverse], real[index]];
  }
  for (let span = 2; span <= size; span *= 2) {
    const angle = (-2 * Math.PI) / span;
    for (let start = 0; start < size; start += span) {
      for (let index = 0; index < span / 2; index++) {
        const a = start + index,
          b = a + span / 2;
        const cosine = Math.cos(angle * index),
          sine = Math.sin(angle * index);
        const r = real[b] * cosine - imag[b] * sine,
          i = real[b] * sine + imag[b] * cosine;
        real[b] = real[a] - r;
        imag[b] = imag[a] - i;
        real[a] += r;
        imag[a] += i;
      }
    }
  }
  let total = 0,
    high = 0;
  for (let index = 1; index < size / 2; index++) {
    const power = real[index] ** 2 + imag[index] ** 2;
    total += power;
    if ((index * rate) / size >= 4000) high += power;
  }
  return high / total;
}
function measurements(pcm) {
  let peak = 0,
    power = 0,
    mean = 0,
    clipped = 0,
    maxStep = 0;
  for (let index = 0; index < pcm.length; index++) {
    const value = pcm[index] / 32768;
    peak = Math.max(peak, Math.abs(value));
    power += value ** 2;
    mean += value;
    if (Math.abs(pcm[index]) >= 32767) clipped++;
    if (index)
      maxStep = Math.max(
        maxStep,
        Math.abs((pcm[index] - pcm[index - 1]) / 32768),
      );
  }
  const rms = Math.sqrt(power / pcm.length);
  return {
    samples: pcm.length,
    seconds: pcm.length / rate,
    peak,
    peakDbfs: 20 * Math.log10(peak),
    rms,
    rmsDbfs: 20 * Math.log10(rms),
    mean: mean / pcm.length,
    clippedSamples: clipped,
    firstSample: pcm[0],
    lastSample: pcm.at(-1),
    maxSampleStep: maxStep,
    powerAbove4khz: spectralPower(pcm),
  };
}

await mkdir(output, { recursive: true });
await mkdir(evidence, { recursive: true });
const ids = timerOnly
  ? ['time-elapsed']
  : representativeOnly
    ? ['auction-open', 'auction-sealed', 'double-open']
    : Object.keys(profiles);
const assets = [];
for (const id of ids) {
  const rendered = render(id, profiles[id]);
  const buffer = wav(rendered.pcm),
    stats = measurements(rendered.pcm);
  assert.equal(stats.clippedSamples, 0, id + ': no PCM clipping');
  assert.ok(stats.peak <= peakCeiling + 1 / 32768, id + ': peak headroom');
  assert.ok(Math.abs(stats.mean) < 0.00001, id + ': negligible DC');
  assert.equal(stats.firstSample, 0);
  assert.equal(stats.lastSample, 0);
  assert.ok(
    stats.powerAbove4khz < 0.03,
    id + ': limited high-frequency energy',
  );
  const path = `${id}-v${version}.wav`;
  await writeFile(resolve(output, path), buffer);
  assets.push({
    id: `modern-art/audio/${id}`,
    cue: id,
    path,
    source:
      'TableMax original deterministic DSP; acoustic-inspired synthesis, not a live recording',
    version,
    script: 'scripts/generate-modern-art-audio.mjs',
    encoding: 'PCM signed 16-bit mono',
    sampleRate: rate,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    parameters: {
      ...profiles[id],
      seed: rendered.seed,
      targetRms,
      peakCeiling,
      normalizationGain: rendered.normalizationGain,
      globalFadeInMs: 5,
      globalFadeOutMs: 30,
    },
    measurements: stats,
  });
}
const totalBytes = assets.reduce((total, asset) => total + asset.bytes, 0);
if (!representativeOnly)
  assert.ok(
    totalBytes < 650000,
    'Keep the complete game sound library within its portable budget',
  );
const record = {
  createdAt: new Date().toISOString(),
  version,
  representativeOnly,
  originalSource: true,
  rate,
  totalBytes,
  status:
    'Generated and measured; device decode/playback integration and human listening are separate checks',
  assets,
};
await writeFile(
  resolve(
    evidence,
    representativeOnly ? 'representatives-v2.json' : 'measurements-v2.json',
  ),
  JSON.stringify(record, null, 2) + '\n',
);
const preview = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>现代艺术原创短音效试听</title><style>body{margin:32px;background:#fff9ed;color:#493325;font:18px system-ui;max-width:960px}h1{font-size:28px}section{padding:16px 0;border-bottom:1px solid #d8c8ad}audio{width:min(100%,480px)}p{line-height:1.6}</style><h1>现代艺术原创短音效</h1><p>本地 DSP 合成；不包含音乐循环或实际录音。数值检查通过不代表真人试听通过。建议从较低系统音量开始试听。</p>${assets.map((asset) => `<section><strong>${asset.cue}</strong><p>${profiles[asset.cue].description}</p><audio controls preload="none" src="../../../../assets/games/modern-art/audio/${asset.path}"></audio></section>`).join('')}</html>`;
await writeFile(
  resolve(
    evidence,
    representativeOnly ? 'representatives-v2.html' : 'audition-v2.html',
  ),
  preview,
);
if (timerOnly) {
  const manifestPath = resolve('assets/games/modern-art/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.audio.assets = [
    ...manifest.audio.assets.filter((asset) => asset.cue !== 'time-elapsed'),
    ...assets,
  ];
  manifest.audio.totalBytes = manifest.audio.assets.reduce(
    (total, asset) => total + asset.bytes,
    0,
  );
  manifest.audio.timerReminder = {
    policy:
      'Once per saved decision clock crossing zero; no action, penalty, replay or automatic auction completion; shares mute, gesture unlock and desktop owner claim',
    measurementEvidence:
      'artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio-generation/measurements-v2.json',
    integrationStatus: 'Generated and measured; application playback pending',
    humanListeningVerified: false,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
} else if (!representativeOnly) {
  const manifestPath = resolve('assets/games/modern-art/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.audio = {
    version,
    source: 'TableMax original procedural gallery and auction cues',
    policy:
      'One short cue per newly saved action; fixed sealed-bid sound independent of amount; no continuous music; host/public authorization, persistent mute and no replay are handled by the game audio controller',
    totalBytes,
    measurementEvidence:
      'artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio-generation/measurements-v2.json',
    audition:
      'artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio-generation/audition-v2.html',
    integrationStatus:
      'Generated and numerically verified; actual application playback pending',
    humanListeningVerified: false,
    assets,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
console.log(
  JSON.stringify(
    {
      representativeOnly,
      cues: assets.length,
      totalBytes,
      evidence,
      measurements: assets.map((asset) => ({
        cue: asset.cue,
        seconds: asset.measurements.seconds,
        peak: asset.measurements.peak,
        rmsDbfs: asset.measurements.rmsDbfs,
        dc: asset.measurements.mean,
        powerAbove4khz: asset.measurements.powerAbove4khz,
      })),
    },
    null,
    2,
  ),
);
