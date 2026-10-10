import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Original offline sound design: deterministic stereo PCM at 44.1 kHz.
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
    new URL(
      '../../../../tmp/pokemon-expansion-materials/tools/ffmpeg-tool.json',
      import.meta.url,
    ),
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
  if (run.status !== 0) throw new Error(run.stderr.toString());
  return run.stdout;
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
await mkdir(directory, { recursive: true });
await mkdir(originals, { recursive: true });
const records = [];
for (const [name, definition] of Object.entries(definitions)) {
  const { bytes, peak } = render(definition);
  const original = path.join(originals, `${name}-v1.wav`);
  const runtime = path.join(directory, `${name}-v1.flac`);
  await writeFile(original, bytes);
  ffmpeg([
    '-y',
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
  const compressed = await readFile(runtime);
  assert.deepEqual(
    ffmpeg(['-i', runtime, '-f', 's16le', 'pipe:1']),
    bytes.subarray(44),
    `${name} PCM lossless round-trip`,
  );
  records.push({
    id: name,
    version: 1,
    source: 'Original deterministic PCM synthesis, prepare-uno-audio.mjs',
    durationSeconds: definition.duration,
    sampleRate,
    channels: 2,
    peak,
    original: `artifacts/uno/audio/source-originals/${name}-v1.wav`,
    originalBytes: bytes.length,
    originalSha256: hash(bytes),
    runtime: `assets/games/uno/audio/${name}-v1.flac`,
    runtimeBytes: compressed.length,
    runtimeSha256: hash(compressed),
    decodedPcm: 'Identical to source WAV samples',
  });
  // Retire only this script's named production WAV after verified FLAC output.
  const oldRuntime = path.resolve(directory, `${name}-v1.wav`);
  assert.equal(path.dirname(oldRuntime), path.resolve(directory));
  await unlink(oldRuntime).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  console.log(
    `${name}: ${definition.duration}s, FLAC ${compressed.length} bytes, PCM identical`,
  );
}
await writeFile(
  path.join(directory, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      attribution: 'TableMax original sound design',
      generator: 'tools/assets/games/uno/prepare-uno-audio.mjs',
      ffmpegBinarySha256: tool.binarySha256,
      files: records,
    },
    null,
    2,
  ) + '\n',
);
