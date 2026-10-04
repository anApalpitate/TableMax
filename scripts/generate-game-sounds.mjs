import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'assets/games/pokemon-encounters/audio';
await mkdir(directory, { recursive: true });
const presets = {
  draw: [660, 880],
  replace: [520, 650],
  'effect-complete': [620, 780, 930],
  'round-result': [523, 659, 784, 1046],
  error: [330, 260],
  mew: [440, 659, 880, 1319],
  zapdos: [180, 960, 240, 1440],
  snorlax: [110, 82, 146],
  charizard: [160, 220, 350, 180, 100],
  rocket: [300, 420, 600, 880],
  'rocket-return': [1046, 740, 440, 220, 880],
  'match-result': [523, 659, 784, 1046, 784, 1046, 1319],
};
// Keep independently sourced and user-provided sounds when regenerating cues.
const previous = JSON.parse(
  await readFile(`${directory}/manifest.json`, 'utf8').catch(() => '[]'),
);
const manifest = previous.filter(
  (entry) => entry.sourceUrl || entry.sourceFile,
);
for (const [name, frequencies] of Object.entries(presets)) {
  // A user's replacement (notably Rocket entrance BGM) owns this stable ID.
  if (manifest.some((entry) => entry.id === `pokemon-encounters/audio/${name}`))
    continue;
  const rate = 22050,
    duration = frequencies.length * 0.09 + 0.06,
    count = Math.floor(rate * duration);
  const data = Buffer.alloc(44 + count * 2);
  data.write('RIFF');
  data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    let amplitude = 0;
    frequencies.forEach((frequency, index) => {
      const age = t - index * 0.09;
      if (age >= 0 && age < 0.15)
        amplitude +=
          0.16 *
          Math.sin(2 * Math.PI * frequency * age) *
          Math.min(age / 0.008, 1) *
          Math.pow(1 - age / 0.15, 2);
    });
    if (name === 'zapdos')
      amplitude +=
        Math.sin(t * 17383) *
        Math.sin(t * 7111) *
        0.09 *
        Math.max(0, 1 - t / duration);
    if (name === 'charizard')
      amplitude =
        (amplitude * 0.3 + Math.sin(t * 23317) * Math.sin(t * 6143) * 0.22) *
        Math.sin((Math.PI * t) / duration);
    if (name === 'snorlax')
      amplitude +=
        Math.sin(2 * Math.PI * (140 * t - 65 * t * t)) *
        0.16 *
        Math.max(0, 1 - t / duration);
    if (name === 'rocket' || name === 'rocket-return')
      amplitude +=
        Math.sin(2 * Math.PI * (250 * t + 1600 * t * t)) *
        0.09 *
        Math.sin((Math.PI * t) / duration);
    data.writeInt16LE(
      Math.round(Math.max(-0.95, Math.min(0.95, amplitude)) * 32767),
      44 + i * 2,
    );
  }
  await writeFile(`${directory}/${name}-v1.wav`, data);
  manifest.push({
    id: `pokemon-encounters/audio/${name}`,
    path: `${name}-v1.wav`,
    source: 'TableMax original procedural chime',
    script: 'scripts/generate-game-sounds.mjs',
    encoding: 'PCM signed 16-bit mono',
    sampleRate: rate,
    seconds: count / rate,
    sha256: createHash('sha256').update(data).digest('hex'),
    ...(name === 'rocket-return'
      ? {
          note: 'Original rocket whistle used with the on-screen Chinese return line. No verified Chinese Team Rocket dialogue recording was found or included.',
        }
      : {}),
  });
}
await writeFile(
  `${directory}/manifest.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
