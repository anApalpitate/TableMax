import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const tool = JSON.parse(
  await readFile(
    'tmp/pokemon-expansion-materials/tools/ffmpeg-tool.json',
    'utf8',
  ),
);
assert.equal(hash(await readFile(tool.binary)), tool.binarySha256);
const evidence = resolve(
  'artifacts/maintenance/v1.0.5/implementation/audio-lossless.json',
);
await mkdir(dirname(evidence), { recursive: true });
const files = [
  'games/pokemon-encounters/ui/audio.tsx',
  'games/modern-art/ui/audio.tsx',
  'games/power-grid/ui/audio.tsx',
];
const results = [];
function ffmpeg(args) {
  const run = spawnSync(
    tool.binary,
    ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args],
    { maxBuffer: 32 * 1024 * 1024, windowsHide: true },
  );
  if (run.status !== 0) throw new Error(run.stderr.toString());
  return run.stdout;
}
for (const file of files) {
  let source = await readFile(file, 'utf8');
  const matches = [...source.matchAll(/from '([^']+\.(?:wav|flac))'/g)].filter(
    ([, path]) =>
      !path.includes('team-rocket-entrance-user') &&
      !path.includes('meowth-coin-user'),
  );
  for (const [, relative] of matches) {
    const original = resolve(
        dirname(file),
        relative.replace(/\.flac$/, '.wav'),
      ),
      target = original.replace(/\.wav$/, '.flac');
    const bytes = await readFile(original);
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
      target,
    ]);
    const flac = await readFile(target);
    assert.deepEqual(
      ffmpeg(['-i', target, '-f', 's16le', 'pipe:1']),
      ffmpeg(['-i', original, '-f', 's16le', 'pipe:1']),
      original,
    );
    results.push({
      original: original.replace(resolve('.') + '\\', '').replaceAll('\\', '/'),
      runtime: target.replace(resolve('.') + '\\', '').replaceAll('\\', '/'),
      originalBytes: bytes.length,
      runtimeBytes: flac.length,
      originalSha256: hash(bytes),
      runtimeSha256: hash(flac),
      pcm: 'identical',
    });
    source = source.replaceAll(relative, relative.replace(/\.wav$/, '.flac'));
  }
  await writeFile(file, source);
}
assert.equal(results.length, 40);
const report = {
  ffmpeg: tool,
  originalsRetained: true,
  files: results,
  savedBytes: results.reduce(
    (total, file) => total + file.originalBytes - file.runtimeBytes,
    0,
  ),
};
assert.ok(report.savedBytes > 0);
await writeFile(evidence, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    converted: results.length,
    savedBytes: report.savedBytes,
    pcm: '40/40 identical',
    evidence,
  }),
);
