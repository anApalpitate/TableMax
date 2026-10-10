import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Original sound design: lute-like plucked strings, bronze bell, parchment,
// frame drum and a brief sword stroke. No samples or runtime network access.
const directory = fileURLToPath(
  new URL('../../../../assets/games/avalon/audio/', import.meta.url),
);
const originals = fileURLToPath(
  new URL(
    '../../../../artifacts/avalon/audio/source-originals/',
    import.meta.url,
  ),
);
const tool = JSON.parse(
  await readFile(
    new URL(
      '../../../../tmp/pokemon-expansion-materials/tools/ffmpeg-tool.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(
  hash(await readFile(tool.binary)),
  tool.binarySha256,
  'Pinned local ffmpeg hash',
);
const rate = 32000;
const note = (at, hz, gain = 0.2, length = 0.8, type = 'lute') => ({
  at,
  hz,
  gain,
  length,
  type,
});
const plucks = (frequencies, at = 0, gap = 0.11, gain = 0.2) =>
  frequencies.map((hz, index) => note(at + index * gap, hz, gain));
const profiles = {
  pledge: {
    seconds: 0.65,
    description: 'A sealed parchment and one quiet lute pledge',
    notes: [note(0, 165, 0.16, 0.2, 'paper'), note(0.05, 293.66, 0.19, 0.55)],
  },
  team: {
    seconds: 1.4,
    description:
      'Round-table summons: low frame drum and rising lute procession',
    notes: [
      note(0, 105, 0.24, 0.45, 'drum'),
      ...plucks([196, 293.66, 392, 440], 0.08, 0.13, 0.17),
      note(0.45, 587.33, 0.12, 0.9, 'bell'),
    ],
  },
  ballot: {
    seconds: 0.48,
    description:
      'Identical neutral parchment-and-wax cue for every secret choice',
    notes: [
      note(0, 150, 0.16, 0.16, 'paper'),
      note(0.07, 180, 0.18, 0.3, 'drum'),
    ],
  },
  approved: {
    seconds: 1.25,
    description:
      'Bronze council seal followed by a bright open-fifth lute figure',
    notes: [
      note(0, 120, 0.21, 0.25, 'drum'),
      ...plucks([293.66, 440, 587.33], 0.05, 0.12, 0.2),
      note(0.3, 880, 0.08, 0.85, 'bell'),
    ],
  },
  rejected: {
    seconds: 1.2,
    description:
      'Wax-seal rejection: two frame-drum strikes and descending strings',
    notes: [
      note(0, 118, 0.21, 0.25, 'drum'),
      note(0.16, 91, 0.24, 0.45, 'drum'),
      ...plucks([349.23, 293.66, 220], 0.08, 0.16, 0.17),
    ],
  },
  'quest-success': {
    seconds: 1.85,
    description:
      'Holy grail: luminous bronze harmonics and a graceful Dorian lute ascent',
    notes: [
      ...plucks([293.66, 349.23, 440, 587.33], 0.04, 0.12, 0.18),
      note(0.42, 587.33, 0.18, 1.35, 'bell'),
      note(0.5, 880, 0.11, 1.2, 'bell'),
    ],
  },
  'quest-fail': {
    seconds: 1.8,
    description:
      'Raven omen: soft wing sweep, low frame drum and falling minor strings',
    notes: [
      note(0, 120, 0.13, 0.4, 'paper'),
      note(0.18, 76, 0.25, 0.75, 'drum'),
      ...plucks([349.23, 293.66, 220, 146.83], 0.1, 0.15, 0.18),
      note(0.42, 155.56, 0.14, 1.25, 'bell'),
    ],
  },
  assassination: {
    seconds: 1.15,
    description: 'A single fine sword sweep ending in bronze resonance',
    notes: [
      note(0, 1650, 0.18, 0.36, 'sword'),
      note(0.22, 1174.66, 0.14, 0.8, 'bell'),
      note(0.24, 91, 0.2, 0.5, 'drum'),
    ],
  },
  'good-win': {
    seconds: 2.3,
    description:
      'Avalon dawn: stately modal lute cadence with gentle bronze finale',
    notes: [
      ...plucks([293.66, 349.23, 440, 587.33, 880], 0.04, 0.15, 0.17),
      note(0.65, 293.66, 0.16, 1.55, 'bell'),
      note(0.7, 587.33, 0.14, 1.5, 'bell'),
      note(0.75, 880, 0.08, 1.35, 'bell'),
    ],
  },
  'evil-win': {
    seconds: 2.3,
    description:
      'Mordred shadow: low modal cadence, dark bronze and restrained drum',
    notes: [
      ...plucks([293.66, 261.63, 220, 146.83], 0.05, 0.16, 0.19),
      note(0.52, 73.42, 0.22, 0.7, 'drum'),
      note(0.64, 146.83, 0.18, 1.55, 'bell'),
      note(0.7, 220, 0.13, 1.4, 'bell'),
    ],
  },
};
for (const winner of ['good', 'evil']) {
  profiles[`assassination-${winner}`] = {
    seconds: 2.6,
    description: `Sword landing followed after 1.1 seconds by the ${winner} faction finale`,
    notes: [
      ...profiles.assassination.notes,
      ...profiles[`${winner}-win`].notes.map((event) => ({
        ...event,
        at: event.at + 1.1,
        length: Math.min(event.length, 2.55 - event.at - 1.1),
      })),
    ],
  };
}
let seed = 0x4a6a19b3;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x80000000 - 1;
};
function render(profile) {
  const count = Math.ceil(profile.seconds * rate);
  const mono = new Float64Array(count);
  let softened = 0;
  for (let i = 0; i < count; i++) {
    const time = i / rate;
    const random = noise();
    softened = softened * 0.88 + random * 0.12;
    let value = 0;
    for (const event of profile.notes) {
      const t = time - event.at;
      if (t < 0 || t >= event.length || event.length <= 0) continue;
      const end = Math.min(1, (event.length - t) / 0.07);
      const attack = Math.min(1, t / 0.006);
      const phase = Math.PI * 2 * event.hz * t;
      if (event.type === 'lute') {
        value +=
          event.gain *
          attack *
          end *
          Math.exp(-t * 5) *
          (Math.sin(phase) +
            0.35 * Math.sin(phase * 2) * Math.exp(-t * 5) +
            0.13 * Math.sin(phase * 3) * Math.exp(-t * 10));
      } else if (event.type === 'bell') {
        value +=
          event.gain *
          attack *
          end *
          Math.exp(-t * 2.6) *
          (Math.sin(phase) +
            0.38 * Math.sin(phase * 2.756) * Math.exp(-t * 2) +
            0.16 * Math.sin(phase * 5.404) * Math.exp(-t * 5));
      } else if (event.type === 'drum') {
        value +=
          event.gain *
          attack *
          end *
          Math.exp(-t * 10) *
          (Math.sin(phase * (1 + 0.28 * Math.exp(-t * 20))) + softened * 0.6);
      } else if (event.type === 'paper') {
        value +=
          event.gain * attack * end * Math.exp(-t * 16) * (random - softened);
      } else if (event.type === 'sword') {
        const sweep = Math.sin((Math.PI * t) / event.length);
        value +=
          event.gain *
          end *
          sweep *
          ((random - softened) * 0.4 +
            0.2 * Math.sin(phase * (1 - (0.65 * t) / event.length)));
      }
    }
    mono[i] = value;
  }
  // Small deterministic room reflections preserve warmth without long tails.
  const stereo = new Float64Array(count * 2);
  let max = 0,
    sum = 0;
  for (let i = 0; i < count; i++) {
    for (let channel = 0; channel < 2; channel++) {
      const reflection =
        mono[Math.max(0, i - (channel ? 1109 : 739))] * 0.13 +
        mono[Math.max(0, i - 2107)] * 0.05;
      const sample = mono[i] + reflection;
      stereo[i * 2 + channel] = sample;
      max = Math.max(max, Math.abs(sample));
      sum += sample * sample;
    }
  }
  const gain = Math.min(0.66 / max, 0.115 / Math.sqrt(sum / stereo.length));
  const pcm = Buffer.alloc(count * 4);
  for (let i = 0; i < stereo.length; i++)
    pcm.writeInt16LE(Math.round(stereo[i] * gain * 32767), i * 2);
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
    peak: max * gain,
    rms: Math.sqrt(sum / stereo.length) * gain,
  };
}
function ffmpeg(args) {
  const run = spawnSync(
    tool.binary,
    ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
  if (run.status !== 0) throw new Error(run.stderr.toString());
  return run.stdout;
}
await mkdir(directory, { recursive: true });
await mkdir(originals, { recursive: true });
const files = [];
for (const [id, profile] of Object.entries(profiles)) {
  const { bytes, peak, rms } = render(profile);
  const original = path.join(originals, `${id}-v1.wav`);
  const runtime = path.join(directory, `${id}-v1.flac`);
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
    `${id} PCM lossless round-trip`,
  );
  assert.ok(
    peak <= 0.66001 && rms > 0.035 && rms <= 0.11501,
    `${id} safe peak and audible RMS`,
  );
  files.push({
    id,
    version: 1,
    description: profile.description,
    durationSeconds: profile.seconds,
    sampleRate: rate,
    channels: 2,
    peak,
    rms,
    original: `artifacts/avalon/audio/source-originals/${id}-v1.wav`,
    originalBytes: bytes.length,
    originalSha256: hash(bytes),
    runtime: `assets/games/avalon/audio/${id}-v1.flac`,
    runtimeBytes: compressed.length,
    runtimeSha256: hash(compressed),
    decodedPcm: 'Identical to source WAV samples',
  });
}
await writeFile(
  path.join(directory, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      attribution: 'TableMax original deterministic sound design',
      generator: 'tools/assets/games/avalon/prepare-avalon-audio.mjs',
      ffmpegBinarySha256: tool.binarySha256,
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Avalon audio: ${files.length} local FLAC cues, ${files.reduce((sum, file) => sum + file.runtimeBytes, 0)} bytes; every PCM round-trip and peak/RMS gate passed.`,
);
