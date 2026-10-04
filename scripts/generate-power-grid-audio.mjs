import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const sampleRate = 22050;
const directory = resolve('assets/games/power-grid/audio');
const evidence = resolve(
  'artifacts/maintenance/v1.0.2/power-grid-debug-20261004/rules-audio',
);
if (
  !directory.endsWith('assets\\games\\power-grid\\audio') &&
  !directory.endsWith('assets/games/power-grid/audio')
)
  throw new Error('Audio target must remain game-owned');
await mkdir(directory, { recursive: true });
await mkdir(join(evidence, 'before'), { recursive: true });
const cues = {
  bid: {
    seconds: 0.32,
    notes: [880, 1174.66, 1567.98],
    strikes: [0, 0.1, 0.21],
    decay: 30,
    metal: 0.2,
    noise: 0.02,
    character:
      'Short relay clicks and bright descending-price-register bell; public auction result only.',
  },
  fuel: {
    seconds: 0.48,
    notes: [120, 170, 140, 210],
    strikes: [0, 0.1, 0.22, 0.34],
    decay: 23,
    metal: 0.56,
    noise: 0.14,
    character:
      'Four compact cargo-and-trolley impacts with a soft pneumatic release.',
  },
  build: {
    seconds: 0.6,
    notes: [220, 329.63, 440, 659.25],
    strikes: [0, 0.13, 0.27, 0.42],
    decay: 17,
    metal: 0.7,
    noise: 0.1,
    character: 'Rivet strikes climbing into a clean connected-line chime.',
  },
  plant: {
    seconds: 0.72,
    notes: [146.83, 220, 293.66, 440],
    strikes: [0, 0.14, 0.29, 0.44],
    decay: 11,
    metal: 0.3,
    noise: 0.06,
    character: 'Heavy generator latch followed by resonant motor engagement.',
  },
  run: {
    seconds: 0.82,
    notes: [196, 246.94, 293.66, 392],
    strikes: [0, 0.1, 0.24, 0.42],
    decay: 8,
    metal: 0.05,
    noise: 0.015,
    character:
      'Rising current and a luminous electrical chord, fading without a loop.',
  },
  end: {
    seconds: 1.15,
    notes: [261.63, 329.63, 392, 523.25, 659.25],
    strikes: [0, 0.12, 0.27, 0.43, 0.6],
    decay: 5.5,
    metal: 0.03,
    noise: 0,
    character:
      'Compact warm victory fanfare over a low electrical resonance; no background music.',
  },
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = {
  version: 2,
  sampleRate,
  channels: 1,
  bitDepth: 16,
  source:
    'Original deterministic additive synthesis, shaped metallic/noise impacts and electrical harmonics; no recordings, external samples or online runtime.',
  generator: 'scripts/generate-power-grid-audio.mjs',
  createdAt: new Date().toISOString(),
  previous: [],
  files: [],
};
for (const [name, cue] of Object.entries(cues)) {
  const previous = await readFile(join(directory, `${name}-v1.wav`));
  const preserved = join(evidence, 'before', `${name}-v1.wav`);
  await writeFile(preserved, previous);
  if (digest(await readFile(preserved)) !== digest(previous))
    throw new Error('Previous audio archive mismatch');
  report.previous.push({
    cue: name,
    file: `${name}-v1.wav`,
    bytes: previous.length,
    sha256: digest(previous),
    evidence: preserved,
  });
  const length = Math.ceil(cue.seconds * sampleRate);
  const samples = new Float64Array(length);
  let seed = 0x1234abcd;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const time = i / sampleRate;
    let value = 0;
    for (let j = 0; j < cue.strikes.length; j++) {
      const elapsed = time - cue.strikes[j];
      if (elapsed < 0) continue;
      const f = cue.notes[j % cue.notes.length];
      const envelope =
        Math.min(1, elapsed / 0.004) * Math.exp(-elapsed * cue.decay);
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const noise = ((seed >>> 0) / 0xffffffff) * 2 - 1;
      const hum = Math.sin(
        2 * Math.PI * f * elapsed +
          (name === 'run' ? 0.18 * Math.sin(elapsed * 30) : 0),
      );
      const electric =
        0.25 * Math.sin(2 * Math.PI * f * 2 * elapsed) +
        0.11 * Math.sin(2 * Math.PI * f * 3 * elapsed);
      const metal =
        0.36 * Math.sin(2 * Math.PI * f * 2.73 * elapsed) +
        0.2 * Math.sin(2 * Math.PI * f * 4.19 * elapsed);
      value +=
        envelope *
        (hum +
          electric +
          cue.metal * metal +
          cue.noise * noise * Math.exp(-elapsed * 35)) *
        0.16;
    }
    samples[i] = value * Math.min(1, (cue.seconds - time) / 0.035);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const gain = Math.min(1, 0.64 / peak);
  const bytes = Buffer.alloc(44 + length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(length * 2, 40);
  let square = 0,
    encodedPeak = 0;
  for (let i = 0; i < length; i++) {
    const sample = Math.round(samples[i] * gain * 32767);
    bytes.writeInt16LE(sample, 44 + i * 2);
    square += (sample / 32768) ** 2;
    encodedPeak = Math.max(encodedPeak, Math.abs(sample / 32768));
  }
  const file = `${name}-v2.wav`;
  await writeFile(join(directory, file), bytes);
  report.files.push({
    cue: name,
    file,
    bytes: bytes.length,
    durationSeconds: length / sampleRate,
    peak: encodedPeak,
    rms: Math.sqrt(square / length),
    sha256: digest(bytes),
    ...cue,
  });
}
report.totalBytes = report.files.reduce((sum, file) => sum + file.bytes, 0);
report.previousBytes = report.previous.reduce(
  (sum, file) => sum + file.bytes,
  0,
);
report.runtimeDeltaBytes = report.totalBytes - report.previousBytes;
await writeFile(
  join(evidence, 'generation-v2.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    files: report.files.length,
    totalBytes: report.totalBytes,
    previousBytes: report.previousBytes,
    runtimeDeltaBytes: report.runtimeDeltaBytes,
    evidence,
  }),
);
