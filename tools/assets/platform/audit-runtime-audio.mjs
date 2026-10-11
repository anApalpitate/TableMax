import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
assertWorkspaceRoot();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function files(root) {
  const found = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (
      entry.isSymbolicLink() ||
      ['node_modules', 'build'].includes(entry.name)
    )
      continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) found.push(...(await files(path)));
    else found.push(path);
  }
  return found;
}
const assetFiles = await files('assets');
const audio = assetFiles.filter((p) => /\.(wav|flac|mp3|ogg)$/i.test(p));
const sourcePairs = new Map();
const unavailableReferences = [];
async function collectReferences(value, manifest) {
  if (
    typeof value === 'string' &&
    /^(assets|artifacts)\/.+\.(wav|flac|mp3|ogg)$/i.test(value)
  ) {
    const path = resolve(value);
    try {
      const entry = await stat(path);
      if (entry.isFile() && !audio.includes(path)) audio.push(path);
    } catch {
      unavailableReferences.push({
        manifest,
        path: value,
        disposition: 'Historical reference; never loaded from runtime package',
      });
    }
  } else if (value && typeof value === 'object') {
    if (typeof value.original === 'string' && typeof value.runtime === 'string')
      sourcePairs.set(resolve(value.runtime), resolve(value.original));
    for (const entry of Object.values(value))
      await collectReferences(entry, manifest);
  }
}
for (const path of assetFiles.filter((entry) => entry.endsWith('.json')))
  await collectReferences(
    JSON.parse(await readFile(path, 'utf8')),
    relative('.', path),
  );
const sources = (
  await Promise.all(['games', 'apps/web/src', 'tools/assets'].map(files))
)
  .flat()
  .filter((p) => /\.(tsx?|json|mjs)$/.test(p));
const direct = new Set();
const referenceTexts = [];
for (const path of sources) {
  const text = await readFile(path, 'utf8');
  referenceTexts.push({
    path: relative('.', path).replaceAll('\\', '/'),
    text,
  });
  for (const match of text.matchAll(
    /(?:from\s*|import\s*|new URL\(\s*)['"]([^'"]+\.(?:wav|flac|mp3|ogg))['"]/g,
  ))
    direct.add(resolve(dirname(path), match[1]));
}
const tool = JSON.parse(
  await readFile('tools/assets/ffmpeg-tool.json', 'utf8'),
);
assert.equal(hash(await readFile(tool.binary)), tool.binarySha256);
const decode = (path) => {
  const run = spawnSync(
    tool.binary,
    [
      '-hide_banner',
      '-nostdin',
      '-loglevel',
      'error',
      '-i',
      path,
      '-f',
      'wav',
      '-c:a',
      'pcm_s16le',
      'pipe:1',
    ],
    { maxBuffer: 128 * 1024 * 1024, windowsHide: true },
  );
  assert.equal(run.status, 0, run.error?.message ?? run.stderr?.toString());
  return run.stdout;
};
const records = [];
for (const path of audio) {
  const bytes = await readFile(path);
  const record = {
    path: relative('.', path).replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: hash(bytes),
    directRuntimeImport: direct.has(path),
    referenceMentions: referenceTexts
      .filter((source) => source.text.includes(basename(path)))
      .map((source) => source.path),
    classification: direct.has(path) ? 'runtime' : 'source-or-data-referenced',
  };
  if (extname(path) === '.flac') {
    const wav = sourcePairs.get(path) ?? path.replace(/\.flac$/, '.wav');
    if (audio.includes(wav)) {
      record.originalWav = relative('.', wav).replaceAll('\\', '/');
      record.decodedPcmIdentical = hash(decode(path)) === hash(decode(wav));
    }
  }
  const decoded = decode(path);
  assert.equal(decoded.toString('ascii', 8, 12), 'WAVE');
  let offset = 12,
    format,
    pcm;
  while (offset + 8 <= decoded.length) {
    const kind = decoded.toString('ascii', offset, offset + 4);
    const length = decoded.readUInt32LE(offset + 4);
    if (kind === 'fmt ')
      format = {
        channels: decoded.readUInt16LE(offset + 10),
        sampleRate: decoded.readUInt32LE(offset + 12),
        bits: decoded.readUInt16LE(offset + 22),
      };
    if (kind === 'data') {
      pcm = decoded.subarray(
        offset + 8,
        Math.min(decoded.length, offset + 8 + length),
      );
      break;
    }
    offset += 8 + length + (length % 2);
  }
  assert.ok(format && pcm);
  record.decoded = {
    ...format,
    durationSeconds:
      pcm.length / ((format.channels * format.sampleRate * format.bits) / 8),
    pcmSha256: hash(pcm),
  };
  records.push(record);
}
const packaged = process.argv
  .find((a) => a.startsWith('--package='))
  ?.slice(10);
let packageAudio = [];
if (packaged)
  for (const path of (await files(packaged)).filter((p) =>
    /\.(wav|flac|mp3|ogg)$/i.test(p),
  )) {
    const bytes = await readFile(path);
    packageAudio.push({
      path: relative(packaged, path).replaceAll('\\', '/'),
      bytes: bytes.length,
      sha256: hash(bytes),
    });
  }
const groups = new Map();
for (const record of records) {
  record.packageMembers = packageAudio
    .filter((entry) => entry.sha256 === record.sha256)
    .map((entry) => entry.path);
  if (record.packageMembers.length) record.classification = 'runtime-packaged';
  else if (extname(record.path) === '.wav')
    record.classification = 'protected-source-original';
  else record.classification = 'unpackaged-source-or-legacy-reference';
  record.disposition = record.packageMembers.length
    ? 'Retain verified runtime format'
    : 'Retain source/reference; excluded from actual package, no deletion authorized by duplicate filename';
}
for (const item of packageAudio) {
  const group = groups.get(item.sha256) ?? [];
  group.push(item.path);
  groups.set(item.sha256, group);
}
const report = {
  version: '1.0.6',
  records,
  unavailableReferences,
  packageAudio,
  duplicatePackageAudio: [...groups.values()].filter(
    (paths) => paths.length > 1,
  ),
  runtimeFormatDuplicates: packageAudio.filter((entry, index, all) =>
    all.some(
      (other, otherIndex) =>
        index < otherIndex &&
        entry.path.replace(/-[\w-]{8}(?=\.)/, '').replace(/\.[^.]+$/, '') ===
          other.path.replace(/-[\w-]{8}(?=\.)/, '').replace(/\.[^.]+$/, '') &&
        extname(entry.path) !== extname(other.path),
    ),
  ),
  actualPackageRoot: packaged ? resolve(packaged) : null,
  originalsProtected: true,
  deletedFiles: [],
  repositorySavedBytes: 0,
  packageSavedBytes: 0,
  reason:
    'WAV originals and earlier source versions remain protected. Production assets are selected by module imports; no blanket format deletion.',
  ffmpegSha256: tool.binarySha256,
};
await mkdir('artifacts/maintenance/v1.0.6/bug-five-seven', { recursive: true });
await writeFile(
  'artifacts/maintenance/v1.0.6/bug-five-seven/audio-audit.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    sourceAudio: records.length,
    formatPairs: records.filter((r) => r.originalWav).length,
    identicalPairs: records.filter((r) => r.decodedPcmIdentical).length,
    packagedAudio: packageAudio.length,
    duplicatePackageAudio: report.duplicatePackageAudio.length,
    evidence: 'artifacts/maintenance/v1.0.6/bug-five-seven/audio-audit.json',
  }),
);
