import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const sampleRate = 22050;
const directory = resolve('assets/games/power-grid/audio');
const evidence = resolve('artifacts/maintenance/v1.0.1/power-grid/ui/audio');
await mkdir(directory, { recursive: true });
await mkdir(evidence, { recursive: true });
const cues = {
  bid: { seconds: 0.22, notes: [740, 990], strikes: [0, 0.11], metal: 0.15 },
  fuel: {
    seconds: 0.32,
    notes: [170, 230],
    strikes: [0, 0.095, 0.2],
    metal: 0.55,
  },
  build: {
    seconds: 0.39,
    notes: [260, 520, 780],
    strikes: [0, 0.12, 0.25],
    metal: 0.65,
  },
  plant: {
    seconds: 0.5,
    notes: [130, 196, 260],
    strikes: [0, 0.15, 0.3],
    metal: 0.28,
  },
  run: {
    seconds: 0.57,
    notes: [196, 246.94, 293.66],
    strikes: [0, 0.08, 0.16],
    metal: 0.06,
  },
  end: {
    seconds: 0.86,
    notes: [196, 246.94, 293.66, 392],
    strikes: [0, 0.13, 0.26, 0.4],
    metal: 0.04,
  },
};
const report = {
  version: 1,
  sampleRate,
  channels: 1,
  bitDepth: 16,
  model:
    'Original deterministic metallic impacts and electric harmonic starts; no music or recorded samples.',
  files: [],
};
for (const [name, cue] of Object.entries(cues)) {
  const length = Math.ceil(cue.seconds * sampleRate);
  const samples = new Float64Array(length);
  let seed = 0x1234abcd;
  for (let i = 0; i < length; i++) {
    const time = i / sampleRate;
    let value = 0;
    for (let j = 0; j < cue.strikes.length; j++) {
      const elapsed = time - cue.strikes[j];
      if (elapsed < 0) continue;
      const frequency = cue.notes[j % cue.notes.length];
      const envelope =
        Math.min(1, elapsed / 0.003) *
        Math.exp(-elapsed * (name === 'end' ? 7 : name === 'run' ? 11 : 20));
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const noise = ((seed >>> 0) / 0xffffffff) * 2 - 1;
      const fundamental = Math.sin(2 * Math.PI * frequency * elapsed);
      const electric =
        0.28 * Math.sin(2 * Math.PI * frequency * 2 * elapsed) +
        0.12 * Math.sin(2 * Math.PI * frequency * 3 * elapsed);
      const metallic =
        0.38 * Math.sin(2 * Math.PI * frequency * 2.73 * elapsed) +
        0.22 * Math.sin(2 * Math.PI * frequency * 4.19 * elapsed) +
        noise * 0.08 * Math.exp(-elapsed * 80);
      value +=
        envelope * (fundamental + electric + cue.metal * metallic) * 0.19;
    }
    samples[i] = value * Math.min(1, (cue.seconds - time) / 0.02);
  }
  const peak = Math.max(...samples.map((sample) => Math.abs(sample)));
  const gain = Math.min(1, 0.72 / peak);
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
  let square = 0;
  for (let i = 0; i < length; i++) {
    const sample = samples[i] * gain;
    square += sample * sample;
    bytes.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  const file = `${name}-v1.wav`;
  await writeFile(join(directory, file), bytes);
  report.files.push({
    cue: name,
    file,
    bytes: bytes.length,
    durationSeconds: length / sampleRate,
    peak: peak * gain,
    rms: Math.sqrt(square / length),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...cue,
  });
}
await writeFile(
  join(evidence, 'generation.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    files: report.files.length,
    totalBytes: report.files.reduce((sum, file) => sum + file.bytes, 0),
    evidence,
  }),
);
