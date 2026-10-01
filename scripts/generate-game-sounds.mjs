import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'games/pokemon-encounters/assets/audio';
await mkdir(directory, { recursive: true });
const presets = {
  draw: [660, 880],
  replace: [520, 650],
  'effect-complete': [620, 780, 930],
  'round-result': [523, 659, 784, 1046],
  error: [330, 260],
};
const manifest = [];
for (const [name, frequencies] of Object.entries(presets)) {
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
    data.writeInt16LE(Math.round(amplitude * 32767), 44 + i * 2);
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
  });
}
await writeFile(
  `${directory}/manifest.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
