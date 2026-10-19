import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { format, resolveConfig } from 'prettier';

// Original offline sound design: deterministic stereo PCM (v1 44.1 kHz,
// compact layered v2 24 kHz). Both generations retain lossless source WAVs.
// Paper transients, warm pitched percussion and brief musical accents are
// synthesized here; no downloaded sample or runtime network is required.
const directory = fileURLToPath(
  new URL('../../../../assets/games/uno/audio/', import.meta.url),
);
const originals = fileURLToPath(
  new URL('../../../../artifacts/uno/audio/source-originals/', import.meta.url),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const tool = JSON.parse(
  await readFile(
    new URL('../../../../tools/assets/ffmpeg-tool.json', import.meta.url),
    'utf8',
  ),
);
assert.equal(
  hash(await readFile(tool.binary)),
  tool.binarySha256,
  'Pinned local ffmpeg hash',
);
function ffmpeg(args) {
  const run = spawnSync(
    tool.binary,
    ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args],
    { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  );
  if (run.error) throw run.error;
  if (run.status !== 0)
    throw new Error(run.stderr?.toString() ?? `ffmpeg exited ${run.status}`);
  return run.stdout;
}
// v1 recipes and renderer below remain available for read-only reproduction.
// New production output is additive v2; legacy bytes are never rewritten.
const version = process.argv.includes('--verify-v1') ? 1 : 2;
assert(
  process.argv.slice(2).every((arg) => arg === '--verify-v1'),
  'Supported option: --verify-v1',
);
const sampleRateV2 = 24000;
const recipesV2 = {
  place: {
    duration: 0.3,
    theme: 'Paper slap, maple knock and a soft upper partial',
    paper: [[0, 0.075, 0.24, -0.2]],
    strikes: [[0.015, 195, 0.12, 0.22, 0.1]],
    tones: [[0.026, 520, 0.2, 0.12, 510, 0.2]],
  },
  draw: {
    duration: 0.4,
    theme: 'Two dry paper flicks and a rising fingertip pluck',
    paper: [
      [0, 0.065, 0.2, -0.35],
      [0.095, 0.07, 0.17, 0.3],
    ],
    tones: [[0.12, 310, 0.22, 0.18, 440, 0.2]],
  },
  skip: {
    duration: 0.54,
    theme: 'Closed gate: double wood stop, clipped bell and a low final knock',
    paper: [[0, 0.045, 0.1, 0]],
    strikes: [
      [0.02, 240, 0.09, 0.3, -0.25],
      [0.145, 180, 0.12, 0.32, 0.25],
    ],
    tones: [
      [0.015, 880, 0.1, 0.16, 880, -0.2],
      [0.145, 440, 0.22, 0.17, 392, 0.2],
    ],
  },
  reverse: {
    duration: 0.68,
    theme: 'Mirrored marimba sweep with a left-right-return air ribbon',
    paper: [[0, 0.055, 0.12, -0.4]],
    air: [
      [0.03, 0.18, 0.07, -0.65],
      [0.2, 0.24, 0.07, 0.65],
    ],
    tones: [
      [0, 330, 0.23, 0.18, 880, -0.5],
      [0.18, 880, 0.28, 0.18, 330, 0.5],
      [0.43, 660, 0.19, 0.13, 660, 0],
    ],
  },
  'draw-two': {
    duration: 0.66,
    theme:
      'Two emphatic card beats, paired bass taps and an ascending major third',
    paper: [
      [0, 0.06, 0.22, -0.25],
      [0.18, 0.06, 0.25, 0.25],
    ],
    strikes: [
      [0.015, 130, 0.15, 0.2, -0.2],
      [0.195, 165, 0.18, 0.24, 0.2],
    ],
    tones: [
      [0.02, 440, 0.23, 0.16, 440, -0.2],
      [0.2, 554.37, 0.36, 0.18, 554.37, 0.2],
      [0.205, 1108.74, 0.21, 0.055, 1108.74, 0.35],
    ],
  },
  wild: {
    duration: 0.72,
    theme: 'Four-color glass arpeggio opening into a warm suspended chord',
    paper: [[0, 0.055, 0.1, 0]],
    air: [[0.02, 0.15, 0.045, 0]],
    tones: [
      [0, 523.25, 0.3, 0.15, 523.25, -0.45],
      [0.075, 659.25, 0.32, 0.14, 659.25, -0.15],
      [0.15, 783.99, 0.34, 0.14, 783.99, 0.15],
      [0.225, 1046.5, 0.4, 0.13, 1046.5, 0.45],
    ],
  },
  'draw-four': {
    duration: 0.9,
    theme:
      'Four rising paper impacts, increasing bass weight and a four-color crown',
    paper: [
      [0, 0.05, 0.12, -0.4],
      [0.12, 0.05, 0.15, -0.12],
      [0.24, 0.05, 0.18, 0.12],
      [0.36, 0.07, 0.22, 0.4],
    ],
    strikes: [
      [0.02, 110, 0.12, 0.12, -0.3],
      [0.14, 130, 0.14, 0.15, -0.1],
      [0.26, 165, 0.16, 0.18, 0.1],
      [0.38, 220, 0.22, 0.22, 0.3],
    ],
    tones: [
      [0, 330, 0.18, 0.1, 330, -0.35],
      [0.12, 440, 0.22, 0.12, 440, -0.1],
      [0.24, 554.37, 0.25, 0.14, 554.37, 0.1],
      [0.36, 659.25, 0.44, 0.16, 659.25, 0.35],
      [0.37, 987.77, 0.34, 0.07, 987.77, -0.2],
    ],
  },
  'accept-four': {
    duration: 0.64,
    theme:
      'Four measured dealing flicks with descending mallets and a closed turn',
    paper: [
      [0, 0.045, 0.15, -0.3],
      [0.1, 0.045, 0.16, -0.1],
      [0.2, 0.045, 0.17, 0.1],
      [0.3, 0.055, 0.18, 0.3],
    ],
    tones: [
      [0.015, 659.25, 0.12, 0.1, 659.25, -0.3],
      [0.115, 554.37, 0.13, 0.1, 554.37, -0.1],
      [0.215, 440, 0.15, 0.12, 440, 0.1],
      [0.315, 330, 0.24, 0.15, 330, 0.3],
    ],
    strikes: [[0.33, 165, 0.18, 0.18, 0]],
  },
  uno: {
    duration: 0.84,
    theme:
      'Call-and-response open fifth, bright octave answer and a small handclap',
    paper: [
      [0, 0.045, 0.1, -0.2],
      [0.19, 0.055, 0.13, 0.2],
    ],
    tones: [
      [0, 659.25, 0.24, 0.2, 659.25, -0.25],
      [0.19, 987.77, 0.36, 0.21, 987.77, 0.25],
      [0.2, 1318.51, 0.4, 0.08, 1318.51, 0.4],
      [0.39, 1975.53, 0.28, 0.045, 1975.53, -0.3],
    ],
    strikes: [[0.2, 330, 0.2, 0.12, 0]],
  },
  'catch-uno': {
    duration: 0.72,
    theme:
      'A quick discovery whistle, two penalty shuffles and a distinct wooden stamp',
    air: [[0, 0.09, 0.035, -0.3]],
    tones: [
      [0, 660, 0.16, 0.15, 1174.66, -0.4],
      [0.14, 587.33, 0.2, 0.17, 440, 0.3],
      [0.36, 293.66, 0.26, 0.14, 293.66, 0],
    ],
    paper: [
      [0.23, 0.055, 0.15, -0.2],
      [0.34, 0.06, 0.18, 0.2],
    ],
    strikes: [[0.36, 147, 0.2, 0.23, 0]],
  },
  'challenge-success': {
    duration: 0.94,
    theme:
      'Question knocks resolve into a bright upward verdict and a four-card return',
    strikes: [
      [0, 220, 0.13, 0.15, -0.3],
      [0.14, 233.08, 0.14, 0.15, 0.3],
    ],
    tones: [
      [0.01, 440, 0.19, 0.11, 466.16, -0.25],
      [0.15, 622.25, 0.2, 0.11, 587.33, 0.25],
      [0.36, 523.25, 0.27, 0.17, 523.25, -0.25],
      [0.47, 659.25, 0.3, 0.16, 659.25, 0],
      [0.58, 1046.5, 0.29, 0.17, 1046.5, 0.3],
    ],
    paper: [
      [0.36, 0.045, 0.1, -0.3],
      [0.42, 0.045, 0.1, -0.1],
      [0.48, 0.045, 0.1, 0.1],
      [0.54, 0.045, 0.1, 0.3],
    ],
  },
  'challenge-failure': {
    duration: 1,
    theme:
      'Question knocks fall into six restrained penalty pulses and a low closing verdict',
    strikes: [
      [0, 220, 0.12, 0.14, -0.3],
      [0.13, 207.65, 0.13, 0.15, 0.3],
      [0.35, 165, 0.12, 0.12, -0.3],
      [0.43, 155.56, 0.12, 0.12, -0.18],
      [0.51, 146.83, 0.12, 0.13, -0.06],
      [0.59, 138.59, 0.12, 0.13, 0.06],
      [0.67, 130.81, 0.12, 0.14, 0.18],
      [0.75, 110, 0.18, 0.16, 0.3],
    ],
    tones: [
      [0.02, 440, 0.18, 0.1, 415.3, -0.2],
      [0.15, 622.25, 0.2, 0.1, 440, 0.2],
      [0.36, 392, 0.26, 0.14, 293.66, -0.2],
      [0.65, 220, 0.28, 0.15, 196, 0.2],
    ],
    paper: [
      [0.35, 0.04, 0.09, -0.3],
      [0.43, 0.04, 0.09, -0.18],
      [0.51, 0.04, 0.09, -0.06],
      [0.59, 0.04, 0.09, 0.06],
      [0.67, 0.04, 0.09, 0.18],
      [0.75, 0.05, 0.11, 0.3],
    ],
  },
  win: {
    duration: 1.2,
    theme:
      'Compact tabletop fanfare, ascending triad, octave crown and a soft confetti finish',
    paper: [
      [0.05, 0.07, 0.075, -0.3],
      [0.5, 0.09, 0.065, 0.3],
    ],
    tones: [
      [0, 523.25, 0.28, 0.14, 523.25, -0.35],
      [0.13, 659.25, 0.3, 0.14, 659.25, 0],
      [0.26, 783.99, 0.31, 0.15, 783.99, 0.35],
      [0.43, 1046.5, 0.64, 0.16, 1046.5, 0.1],
      [0.43, 659.25, 0.61, 0.09, 659.25, -0.25],
      [0.43, 783.99, 0.61, 0.09, 783.99, 0.25],
    ],
    strikes: [[0.43, 262, 0.22, 0.13, 0]],
  },
};

function renderV2(name, definition) {
  const frames = Math.ceil(definition.duration * sampleRateV2);
  const left = new Float64Array(frames),
    right = new Float64Array(frames);
  let randomState = createHash('sha256')
    .update(`uno-v2:${name}`)
    .digest()
    .readUInt32LE(0);
  let low = 0;
  for (let i = 0; i < frames; i++) {
    const time = i / sampleRateV2;
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    const random = (randomState >>> 0) / 0x80000000 - 1;
    low = low * 0.84 + random * 0.16;
    const mix = (value, pan = 0) => {
      left[i] += value * (1 - pan * 0.35);
      right[i] += value * (1 + pan * 0.35);
    };
    for (const [start, length, gain, pan] of definition.paper ?? []) {
      const t = time - start;
      if (t < 0 || t >= length) continue;
      const envelope =
        Math.min(1, t / 0.003) *
        Math.exp(-t * 42) *
        Math.min(1, (length - t) / 0.012);
      mix((random - low) * gain * envelope, pan);
    }
    for (const [start, length, gain, pan] of definition.air ?? []) {
      const t = time - start;
      if (t < 0 || t >= length) continue;
      mix(
        low * Math.sin((Math.PI * t) / length) ** 2 * gain,
        pan * (1 - (2 * t) / length),
      );
    }
    for (const [start, frequency, length, gain, pan] of definition.strikes ??
      []) {
      const t = time - start;
      if (t < 0 || t >= length) continue;
      const phase = 2 * Math.PI * frequency * t;
      const envelope =
        Math.min(1, t / 0.002) *
        Math.exp((-t * 7) / length) *
        Math.min(1, (length - t) / 0.015);
      mix(
        (Math.sin(phase) +
          0.22 * Math.sin(phase * 1.498) +
          0.08 * Math.sin(phase * 2.401)) *
          gain *
          envelope,
        pan,
      );
    }
    for (const [
      start,
      frequency,
      length,
      gain,
      end = frequency,
      pan = 0,
    ] of definition.tones ?? []) {
      const t = time - start;
      if (t < 0 || t >= length) continue;
      const phase =
        2 *
        Math.PI *
        (frequency * t + ((end - frequency) * t * t) / (2 * length));
      const envelope =
        Math.min(1, t / 0.008) *
        Math.exp((-t * 3.1) / length) *
        Math.min(1, (length - t) / 0.045);
      mix(
        (Math.sin(phase) +
          0.2 * Math.sin(phase * 2) +
          0.045 * Math.sin(phase * 3)) *
          gain *
          envelope,
        pan,
      );
    }
  }
  // Correlated stereo reflections enrich the short cues while keeping lossless
  // compression efficient; every cue has an independent deterministic noise seed.
  const reflectedLeft = new Float64Array(frames),
    reflectedRight = new Float64Array(frames);
  const leftDelay = Math.round(sampleRateV2 * 0.052);
  const rightDelay = Math.round(sampleRateV2 * 0.077);
  let rawPeak = 0;
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, (frames - 1 - i) / (sampleRateV2 * 0.018));
    reflectedLeft[i] = (left[i] + (right[i - leftDelay] ?? 0) * 0.065) * fade;
    reflectedRight[i] = (right[i] + (left[i - rightDelay] ?? 0) * 0.055) * fade;
    rawPeak = Math.max(
      rawPeak,
      Math.abs(reflectedLeft[i]),
      Math.abs(reflectedRight[i]),
    );
  }
  const pcm = Buffer.alloc(frames * 4);
  const gain = 0.66 / rawPeak;
  let peak = 0,
    power = 0;
  for (let i = 0; i < frames; i++) {
    const l = reflectedLeft[i] * gain,
      r = reflectedRight[i] * gain;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    power += l * l + r * r;
    pcm.writeInt16LE(Math.round(l * 32767), i * 4);
    pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRateV2, 24);
  header.writeUInt32LE(sampleRateV2 * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return {
    bytes: Buffer.concat([header, pcm]),
    peak,
    rms: Math.sqrt(power / (frames * 2)),
  };
}
const sampleRate = 44100;
let seed = 0x55c8a311;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 0x100000000) * 2 - 1;
};
const definitions = {
  place: {
    duration: 0.32,
    paper: [[0, 0.18, 0.3]],
    tones: [
      [0.025, 260, 0.08, 0.24],
      [0.03, 520, 0.07, 0.1],
    ],
  },
  draw: {
    duration: 0.45,
    paper: [
      [0, 0.18, 0.22],
      [0.11, 0.2, 0.25],
    ],
    tones: [[0.19, 392, 0.13, 0.15]],
  },
  reverse: {
    duration: 0.62,
    paper: [[0, 0.16, 0.18]],
    tones: [
      [0, 330, 0.21, 0.19, 880],
      [0.15, 880, 0.32, 0.17, 330],
      [0.36, 660, 0.13, 0.12],
    ],
  },
  skip: {
    duration: 0.48,
    paper: [[0, 0.11, 0.14]],
    tones: [
      [0.025, 660, 0.12, 0.2],
      [0.15, 440, 0.18, 0.19],
    ],
  },
  'draw-two': {
    duration: 0.63,
    paper: [
      [0, 0.12, 0.25],
      [0.16, 0.14, 0.3],
    ],
    tones: [
      [0.025, 440, 0.18, 0.2],
      [0.18, 554.37, 0.24, 0.21],
      [0.18, 1108.74, 0.14, 0.06],
    ],
  },
  'draw-four': {
    duration: 0.89,
    paper: [
      [0, 0.1, 0.18],
      [0.12, 0.1, 0.2],
      [0.24, 0.1, 0.22],
      [0.36, 0.1, 0.24],
    ],
    tones: [
      [0, 330, 0.16, 0.15],
      [0.12, 440, 0.2, 0.17],
      [0.24, 554.37, 0.22, 0.19],
      [0.36, 659.25, 0.35, 0.21],
    ],
  },
  wild: {
    duration: 0.65,
    paper: [[0, 0.2, 0.15]],
    tones: [
      [0, 523.25, 0.27, 0.16],
      [0.06, 659.25, 0.29, 0.14],
      [0.12, 783.99, 0.32, 0.13],
    ],
  },
  uno: {
    duration: 0.85,
    paper: [[0, 0.09, 0.1]],
    tones: [
      [0, 659.25, 0.23, 0.22],
      [0.18, 987.77, 0.35, 0.23],
      [0.19, 1318.51, 0.29, 0.08],
    ],
  },
  challenge: {
    duration: 0.79,
    paper: [[0, 0.11, 0.2]],
    tones: [
      [0, 220, 0.18, 0.24],
      [0.14, 277.18, 0.2, 0.19],
      [0.34, 440, 0.29, 0.2],
    ],
  },
  win: {
    duration: 1.8,
    paper: [
      [0.05, 0.21, 0.11],
      [0.45, 0.3, 0.09],
    ],
    tones: [
      [0, 523.25, 0.32, 0.16],
      [0.16, 659.25, 0.32, 0.16],
      [0.32, 783.99, 0.32, 0.18],
      [0.52, 1046.5, 0.87, 0.22],
      [0.52, 659.25, 0.85, 0.13],
      [0.52, 783.99, 0.85, 0.13],
    ],
  },
};
definitions['catch-uno'] = {
  duration: 0.58,
  paper: [[0, 0.12, 0.16]],
  tones: [
    [0, 740, 0.17, 0.2],
    [0.17, 370, 0.28, 0.22],
  ],
};
function render(definition) {
  const frames = Math.ceil(definition.duration * sampleRate);
  const samples = new Float64Array(frames);
  let smoothed = 0;
  for (let i = 0; i < frames; i++) {
    const time = i / sampleRate;
    const random = noise();
    smoothed = smoothed * 0.76 + random * 0.24;
    let sample = 0;
    for (const [start, length, gain] of definition.paper) {
      const t = time - start;
      if (t < 0 || t > length) continue;
      const envelope = Math.min(1, t / 0.006) * Math.exp(-t * 27);
      sample += (random - smoothed) * envelope * gain;
      sample +=
        Math.sin(2 * Math.PI * 155 * t) * Math.exp(-t * 50) * gain * 0.33;
    }
    for (const [
      start,
      frequency,
      length,
      gain,
      endFrequency = frequency,
    ] of definition.tones) {
      const t = time - start;
      if (t < 0 || t > length) continue;
      const envelope =
        Math.min(1, t / 0.008) *
        Math.exp((-t * 4) / length) *
        Math.min(1, (length - t) / 0.04);
      const phase =
        2 *
        Math.PI *
        (frequency * t + (((endFrequency - frequency) / length) * t * t) / 2);
      sample +=
        (Math.sin(phase) +
          Math.sin(phase * 2.003) * 0.18 +
          Math.sin(phase * 3.01) * 0.04) *
        gain *
        envelope;
    }
    samples[i] = Math.tanh(sample * 1.5) * 0.77;
  }
  const pcm = Buffer.alloc(frames * 4);
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const delayed = samples[Math.max(0, i - 251)] * 0.035;
    const left = Math.max(-1, Math.min(1, samples[i] + delayed));
    const right = Math.max(
      -1,
      Math.min(1, samples[i] * 0.96 + samples[Math.max(0, i - 373)] * 0.04),
    );
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    pcm.writeInt16LE(Math.round(left * 32767), i * 4);
    pcm.writeInt16LE(Math.round(right * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return { bytes: Buffer.concat([header, pcm]), peak };
}
if (version === 1) {
  for (const [name, definition] of Object.entries(definitions)) {
    const { bytes } = render(definition);
    assert.deepEqual(
      await readFile(path.join(originals, `${name}-v1.wav`)),
      bytes,
      `${name} v1 original reproduction`,
    );
    assert.deepEqual(
      ffmpeg([
        '-i',
        path.join(directory, `${name}-v1.flac`),
        '-f',
        's16le',
        'pipe:1',
      ]),
      bytes.subarray(44),
      `${name} v1 PCM reproduction`,
    );
  }
  console.log('v1 original and runtime PCM reproduced; no files written.');
} else {
  const legacyManifest = path.join(directory, 'manifest.json');
  const legacyBytes = await readFile(legacyManifest);
  const legacy = JSON.parse(legacyBytes);
  const preserved = [
    legacyManifest,
    ...legacy.files.flatMap((file) => [
      path.resolve(file.runtime),
      path.resolve(file.original),
    ]),
  ];
  const originalHashes = await Promise.all(
    preserved.map(async (file) => [file, hash(await readFile(file))]),
  );
  await mkdir(directory, { recursive: true });
  await mkdir(originals, { recursive: true });
  const immutableWrite = async (file, bytes) => {
    try {
      await writeFile(file, bytes, { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      assert.equal(
        hash(await readFile(file)),
        hash(bytes),
        `${file}: versioned content already exists; use a new version for a changed recipe`,
      );
    }
  };
  const records = [];
  for (const [name, definition] of Object.entries(recipesV2)) {
    const { bytes, peak, rms } = renderV2(name, definition);
    assert(
      peak > 0.1 && peak < 0.8 && rms > 0.015 && rms < 0.3,
      `${name}: bounded audible signal without clipping`,
    );
    const original = path.join(originals, `${name}-v2.wav`);
    const runtime = path.join(directory, `${name}-v2.flac`);
    await immutableWrite(original, bytes);
    let compressed;
    try {
      compressed = await readFile(runtime);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      ffmpeg([
        '-n',
        '-i',
        original,
        '-c:a',
        'flac',
        '-compression_level',
        '12',
        '-metadata_header_padding',
        '0',
        runtime,
      ]);
      compressed = await readFile(runtime);
    }
    const decoded = ffmpeg(['-i', runtime, '-f', 's16le', 'pipe:1']);
    assert.deepEqual(
      decoded,
      bytes.subarray(44),
      `${name} v2 lossless PCM round-trip`,
    );
    records.push({
      id: name,
      version: 2,
      theme: definition.theme,
      source:
        'Original deterministic layered PCM synthesis; no external samples',
      durationSeconds: definition.duration,
      sampleRate: sampleRateV2,
      channels: 2,
      bitsPerSample: 16,
      frames: (bytes.length - 44) / 4,
      peak,
      rms,
      layers: Object.fromEntries(
        ['paper', 'strikes', 'air', 'tones']
          .filter((key) => definition[key]?.length)
          .map((key) => [key, definition[key].length]),
      ),
      recipe: definition,
      original: `artifacts/uno/audio/source-originals/${name}-v2.wav`,
      originalBytes: bytes.length,
      originalSha256: hash(bytes),
      runtime: `assets/games/uno/audio/${name}-v2.flac`,
      runtimeBytes: compressed.length,
      runtimeSha256: hash(compressed),
      decodedPcmSha256: hash(decoded),
      decodedPcm: 'Identical to source WAV samples',
    });
    console.log(
      `${name}: ${definition.duration}s, ${compressed.length} bytes, PCM identical, peak ${peak.toFixed(3)}, RMS ${rms.toFixed(3)}`,
    );
  }
  assert.equal(
    new Set(records.map((record) => record.decodedPcmSha256)).size,
    records.length,
    'All thirteen cues have distinct PCM',
  );
  for (const [file, sha] of originalHashes)
    assert.equal(
      hash(await readFile(file)),
      sha,
      `Preserved v1 bytes: ${file}`,
    );
  const totalRuntimeBytes = records.reduce(
    (sum, record) => sum + record.runtimeBytes,
    0,
  );
  const manifestPath = path.join(directory, 'manifest-v2.json');
  await immutableWrite(
    manifestPath,
    Buffer.from(
      await format(
        JSON.stringify(
          {
            version: 2,
            attribution: 'TableMax original sound design',
            generator: 'tools/assets/games/uno/prepare-uno-audio.mjs',
            ffmpegBinarySha256: tool.binarySha256,
            preservedV1ManifestSha256: hash(legacyBytes),
            totalRuntimeBytes,
            files: records,
          },
          null,
          2,
        ),
        { ...(await resolveConfig(manifestPath)), parser: 'json' },
      ),
    ),
  );
  console.log(
    `v2 total: ${totalRuntimeBytes} bytes; thirteen distinct decoded cues; all legacy originals/runtime/manifest unchanged.`,
  );
}
