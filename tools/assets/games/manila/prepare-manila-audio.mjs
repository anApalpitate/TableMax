import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
assertWorkspaceRoot();
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Original deterministic miniature-harbor foley. No downloaded recordings,
// speech or background music; these are original synthesis, not real samples.
const rate = 32000;
const directory = path.resolve('assets/games/manila/audio');
const originals = path.resolve(
  '../TMP/TableMaxMaterial/originals/manila/audio-v1',
);
const tool = JSON.parse(
  await readFile('tools/assets/ffmpeg-tool.json', 'utf8'),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(tool.binary)), tool.binarySha256);
const hit = (at, hz, type = 'wood', length = 0.22, gain = 0.22) => ({
  at,
  hz,
  type,
  length,
  gain,
});
const profiles = {
  wood: {
    seconds: 0.34,
    description: 'One warm wooden companion landing on the board',
    notes: [hit(0, 225), hit(0.022, 430, 'wood', 0.13, 0.07)],
  },
  coin: {
    seconds: 0.53,
    description: 'Two small metallic coins with a short brass ring',
    notes: [hit(0, 1520, 'metal', 0.33), hit(0.11, 1980, 'metal', 0.36, 0.16)],
  },
  dice: {
    seconds: 0.8,
    description:
      'Three uneven dice collisions on wood followed by water movement',
    notes: [
      hit(0, 320),
      hit(0.085, 540),
      hit(0.19, 280),
      hit(0.3, 380),
      hit(0.32, 120, 'water', 0.42, 0.1),
    ],
  },
  water: {
    seconds: 0.78,
    description: 'A soft short paddle stroke and filtered harbor water',
    notes: [hit(0, 95, 'water', 0.7, 0.36)],
  },
  bell: {
    seconds: 1.35,
    description: 'A warm miniature harbor bell with open-fifth resonance',
    notes: [
      hit(0, 440, 'metal', 1.25, 0.24),
      hit(0.11, 660, 'metal', 1.17, 0.09),
    ],
  },
  dock: {
    seconds: 0.78,
    description: 'Water against the quay, wooden hull contact and a rope tap',
    notes: [
      hit(0, 100, 'water', 0.6, 0.2),
      hit(0.15, 160, 'wood', 0.26),
      hit(0.3, 320, 'wood', 0.2, 0.1),
    ],
  },
  boarding: {
    seconds: 0.67,
    description: 'Two compact wooden footfalls over a gangplank',
    notes: [hit(0, 190), hit(0.18, 260), hit(0.12, 100, 'water', 0.45, 0.08)],
  },
  repair: {
    seconds: 0.7,
    description: 'Three gentle repair-hammer strikes, no machinery loop',
    notes: [
      hit(0, 690, 'metal', 0.23),
      hit(0.16, 620, 'metal', 0.23),
      hit(0.34, 800, 'metal', 0.27),
    ],
  },
  pirate: {
    seconds: 1.12,
    description:
      'A low wooden drum and sweeping water mark the pirate takeover',
    notes: [
      hit(0, 95, 'wood', 0.42, 0.34),
      hit(0.15, 130, 'wood', 0.36),
      hit(0.23, 90, 'water', 0.8, 0.3),
      hit(0.5, 660, 'metal', 0.52, 0.1),
    ],
  },
  celebration: {
    seconds: 1.4,
    description: 'Brief bright trading-harbor chimes; no looping fanfare',
    notes: [
      hit(0, 440, 'metal', 0.8),
      hit(0.15, 554.37, 'metal', 0.85),
      hit(0.3, 659.25, 'metal', 0.9),
      hit(0.45, 880, 'metal', 0.9, 0.16),
    ],
  },
};
let seed = 0x4d414e49;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x80000000 - 1;
}
function render(profile) {
  const end = Math.max(...profile.notes.map((note) => note.at + note.length));
  const count = Math.ceil(Math.min(profile.seconds, end + 0.032) * rate),
    mono = new Float64Array(count);
  let low = 0;
  for (let i = 0; i < count; i++) {
    const noise = random();
    low = low * 0.9 + noise * 0.1;
    for (const event of profile.notes) {
      const t = i / rate - event.at;
      if (t < 0 || t >= event.length) continue;
      const envelope =
        Math.min(1, t / 0.003) * Math.min(1, (event.length - t) / 0.055);
      const phase = Math.PI * 2 * event.hz * t;
      const sound =
        event.type === 'water'
          ? low * Math.sin((Math.PI * t) / event.length) +
            0.035 * Math.sin(phase)
          : event.type === 'metal'
            ? Math.exp(-t * 5) *
              (Math.sin(phase) +
                0.32 * Math.sin(phase * 2.756) +
                0.12 * Math.sin(phase * 5.404))
            : Math.exp(-t * 22) *
              (Math.sin(phase) + 0.35 * Math.sin(phase * 1.47) + noise * 0.28);
      mono[i] += event.gain * envelope * sound;
    }
  }
  const samples = new Float64Array(count * 2);
  let peak = 0,
    sum = 0;
  for (let i = 0; i < count; i++)
    for (let channel = 0; channel < 2; channel++) {
      const delay = channel ? 529 : 367;
      const value =
        (mono[i] + (i >= delay ? mono[i - delay] * 0.09 : 0)) *
        Math.min(1, (count - i - 1) / (rate * 0.04));
      samples[i * 2 + channel] = value;
      peak = Math.max(peak, Math.abs(value));
      sum += value * value;
    }
  const gain = Math.min(0.5 / peak, 0.085 / Math.sqrt(sum / samples.length));
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) =>
    pcm.writeInt16LE(Math.round(value * gain * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return {
    bytes: Buffer.concat([header, pcm]),
    peak: peak * gain,
    rms: Math.sqrt(sum / samples.length) * gain,
  };
}
function ffmpeg(args) {
  const result = spawnSync(
    tool.binary,
    ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
await mkdir(directory, { recursive: true });
await mkdir(originals, { recursive: true });
const files = [];
for (const [id, profile] of Object.entries(profiles)) {
  const { bytes, peak, rms } = render(profile);
  const original = path.join(originals, `${id}-v1.wav`),
    runtime = path.join(directory, `${id}-v1.flac`);
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
  assert.deepEqual(
    ffmpeg(['-i', runtime, '-f', 's16le', 'pipe:1']),
    bytes.subarray(44),
    `${id}: lossless PCM`,
  );
  assert.ok(
    peak <= 0.50001 && rms >= 0.025 && rms <= 0.08501,
    `${id}: peak and RMS`,
  );
  const final = await readFile(runtime);
  files.push({
    id,
    file: `${id}-v1.flac`,
    description: profile.description,
    seconds: (bytes.length - 44) / (rate * 4),
    sampleRate: rate,
    channels: 2,
    peak,
    rms,
    bytes: final.length,
    sha256: hash(final),
    original,
    originalSha256: hash(bytes),
    pcmVerified: true,
  });
}
await writeFile(
  path.join(directory, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      source:
        'TableMax original offline deterministic synthesis; no third-party samples',
      generator: 'tools/assets/games/manila/prepare-manila-audio.mjs',
      ffmpegSha256: tool.binarySha256,
      auditioned: false,
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    count: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    pcmVerified: true,
    manifest: 'assets/games/manila/audio/manifest.json',
  }),
);
