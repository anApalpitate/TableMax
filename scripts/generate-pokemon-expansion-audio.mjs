import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const directory = 'assets/games/pokemon-encounters/expansion/audio';
await mkdir(directory, { recursive: true });
const originalDirectory =
  'artifacts/pokemon-expansion/continuation-audio/originals';
await mkdir(originalDirectory, { recursive: true });
const ffmpegRecord = JSON.parse(
  await readFile(
    'tmp/pokemon-expansion-materials/tools/ffmpeg-tool.json',
    'utf8',
  ),
);
const ffmpeg = ffmpegRecord.binary;
const ffmpegSha256 = createHash('sha256')
  .update(await readFile(ffmpeg))
  .digest('hex');
if (ffmpegSha256 !== ffmpegRecord.binarySha256)
  throw new Error('FFmpeg binary differs from locked tool record');
const sampleRate = 16000;
const themes = [
  {
    id: 'mewtwo',
    seconds: 0.95,
    notes: [196, 293.66, 392],
    sweep: 190,
    noise: 0.05,
  },
  {
    id: 'arceus',
    seconds: 1.15,
    notes: [523.25, 659.25, 783.99],
    sweep: 0,
    noise: 0,
  },
  {
    id: 'groudon',
    seconds: 0.9,
    notes: [58.27, 87.31, 116.54],
    sweep: -35,
    noise: 0.45,
  },
  {
    id: 'kyogre',
    seconds: 1.05,
    notes: [130.81, 174.61, 261.63],
    sweep: 70,
    noise: 0.2,
  },
  {
    id: 'rayquaza',
    seconds: 0.85,
    notes: [220, 329.63, 440],
    sweep: 430,
    noise: 0.12,
  },
  {
    id: 'greninja',
    seconds: 0.75,
    notes: [293.66, 440, 587.33],
    sweep: -120,
    noise: 0.42,
  },
  {
    id: 'lucario',
    seconds: 0.8,
    notes: [146.83, 220, 293.66],
    sweep: 100,
    noise: 0.08,
  },
  {
    id: 'research',
    seconds: 0.7,
    notes: [523.25, 659.25, 987.77],
    sweep: 0,
    noise: 0,
  },
];
const assets = [];
for (const [index, theme] of themes.entries()) {
  let state = 9973 + index;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 4294967296) * 2 - 1;
  };
  const count = Math.ceil(theme.seconds * sampleRate);
  const samples = new Float64Array(count);
  let peak = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate,
      phase = t / theme.seconds;
    const envelope =
      Math.min(1, t / 0.035) *
      Math.min(1, (theme.seconds - t) / 0.09) *
      Math.exp(-phase * 1.4);
    const pulse =
      theme.id === 'lucario' || theme.id === 'mewtwo'
        ? 0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t) ** 2
        : 1;
    const chord =
      theme.notes.reduce(
        (sum, frequency, note) =>
          sum +
          Math.sin(2 * Math.PI * (frequency * t + (theme.sweep * t * t) / 2)) *
            (1 - note * 0.18),
        0,
      ) / 3;
    const sample =
      (chord * (1 - theme.noise) + random() * theme.noise) * envelope * pulse;
    samples[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(count * 2, 40);
  let sumSquares = 0,
    sum = 0,
    maximum = 0;
  for (let i = 0; i < count; i++) {
    const sample = Math.round((samples[i] / peak) * 0.6 * 32767);
    wav.writeInt16LE(sample, 44 + i * 2);
    sumSquares += sample * sample;
    sum += sample;
    maximum = Math.max(maximum, Math.abs(sample));
  }
  const originalFile = `${originalDirectory}/${theme.id}-theme-original-v1.wav`;
  const file = `${theme.id}-theme-original-v1.ogg`;
  await writeFile(originalFile, wav);
  await promisify(execFile)(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      originalFile,
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-application',
      'audio',
      '-map_metadata',
      '-1',
      `${directory}/${file}`,
    ],
    { windowsHide: true },
  );
  const encoded = await readFile(`${directory}/${file}`);
  assets.push({
    ...theme,
    file,
    bytes: encoded.length,
    sha256: createHash('sha256').update(encoded).digest('hex'),
    originalFile,
    originalBytes: wav.length,
    originalSha256: createHash('sha256').update(wav).digest('hex'),
    runtimeCodec: 'Ogg/Opus 32kbps mono',
    sourceSampleRate: sampleRate,
    channels: 1,
    sourceBitsPerSample: 16,
    sourcePeakFraction: maximum / 32767,
    sourceRmsFraction: Math.sqrt(sumSquares / count) / 32767,
    sourceMeanFraction: sum / count / 32767,
    sourceKind: 'original-procedural-theme',
    officialCharacterCry: false,
    runtimeDecoded: false,
    humanListeningVerified: false,
  });
}
await writeFile(
  `${directory}/themes.json`,
  JSON.stringify(
    {
      schemaVersion: 1,
      generator: 'scripts/generate-pokemon-expansion-audio.mjs',
      status:
        'original PCM generated/measured; Ogg/Opus runtime encoding; runtime decoding and human listening separate',
      encoder: {
        package: ffmpegRecord.package,
        version: ffmpegRecord.version,
        binarySha256: ffmpegSha256,
        toolRecord: 'tmp/pokemon-expansion-materials/tools/ffmpeg-tool.json',
      },
      purpose:
        'Original ability/research theme feedback while official voice gap remains',
      assets,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    assets: assets.length,
    totalBytes: assets.reduce((sum, item) => sum + item.bytes, 0),
  }),
);
