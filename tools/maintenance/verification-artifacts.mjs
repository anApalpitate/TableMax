import { mkdir, readFile, writeFile, lstat, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, relative, sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventory } from '../analysis/storage/space-analysis.mjs';
import { encodeScreenshotPreview } from '../shared/screenshot-preview.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (root, path) => {
  const absolute = resolve(root, path);
  const value = relative(root, absolute).split(sep).join('/');
  if (!value || value.startsWith('../') || value.includes(':'))
    throw new Error('Artifact escapes workspace');
  return value;
};
export class ScreenshotPolicy {
  constructor(
    mode = process.env.TABLEMAX_TEST_SCREENSHOTS ?? 'representative',
  ) {
    if (!['representative', 'all'].includes(mode))
      throw new Error('Screenshot mode must be representative or all');
    this.mode = mode;
    this.seen = new Set();
    this.skipped = 0;
  }
  path(filename, options = {}) {
    const {
      group = '',
      label = filename,
      layout = false,
      mustKeep = false,
      failure = false,
    } = options;
    if (!/^[a-zA-Z0-9_.-]+\.png$/.test(filename))
      throw new Error('Unsafe screenshot name');
    if (failure || mustKeep || /failure/i.test(label)) return filename;
    if (options.boundary === null) {
      if (this.mode === 'all') return `process/${filename}`;
      this.skipped++;
      return null;
    }
    const role =
      options.role ?? label.match(/host|public|player|phone/i)?.[0] ?? 'other';
    const boundary =
      options.boundary ??
      (/3840|2160/.test(label)
        ? '4k'
        : /844x390|landscape/.test(label)
          ? 'landscape'
          : 'first');
    const zoom = options.zoom ?? label.match(/zoom[=-]([\d.]+)/i)?.[1] ?? '';
    const dpi = options.dpi ?? '';
    const key =
      (layout && /\d+x\d+/.test(label)) || options.boundary !== undefined
        ? JSON.stringify([group, role, boundary, zoom, dpi])
        : `${group}:${label}`;
    if (this.seen.has(key)) {
      if (this.mode === 'all') return `process/${filename}`;
      this.skipped++;
      return null;
    }
    this.seen.add(key);
    return filename;
  }
}

const captured = new Map();
export async function writeScreenshot(
  output,
  filename,
  image,
  aliases = [],
  options = {},
) {
  if (!/^(?:process\/)?[a-zA-Z0-9_.-]+\.png$/.test(filename))
    throw new Error('Unsafe screenshot path');
  const sourceSha256 = hash(image);
  const critical =
    options.failure || options.mustKeep || /failure/i.test(filename);
  if (critical && filename.startsWith('process/'))
    throw new Error('Critical screenshots cannot be temporary');
  const preview =
    !critical && (options.preview || filename.startsWith('process/'));
  const key = `${resolve(output)}:${preview ? 'preview' : 'evidence'}:${sourceSha256}`;
  const previous = captured.get(key);
  if (previous && !critical) {
    let bytes;
    try {
      bytes = await readFile(resolve(output, previous.path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    // Repeated capture names can overwrite a representative in the same run.
    // An alias is valid only while the retained file still has these bytes.
    if (bytes && hash(bytes) === previous.sha256) {
      aliases.push({
        requested: filename,
        retained: previous.path,
        sha256: previous.sha256,
        sourceSha256,
        bytesSaved: previous.bytes,
      });
      return previous.path;
    }
    captured.delete(key);
  }
  if (preview) {
    const encoded = await encodeScreenshotPreview(image);
    filename = filename.replace(/\.png$/, '.webp');
    image = encoded.image;
    options.encodings?.push({
      path: filename,
      ...encoded.metadata,
      bytesSaved: encoded.metadata.sourceBytes - image.length,
    });
  }
  await mkdir(resolve(output, filename, '..'), { recursive: true });
  await writeFile(resolve(output, filename), image);
  // A permanent representative must never alias a temporary process screenshot.
  if (!filename.startsWith('process/'))
    captured.set(key, {
      path: filename,
      sha256: hash(image),
      bytes: image.length,
    });
  return filename;
}

export async function registerArtifacts({
  root = resolve('.'),
  output,
  reportPath,
  work,
  passed,
  policy,
}) {
  const { version } = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const outputPath = local(root, output);
  if (
    !/^artifacts\/(?:maintenance\/v\d+\.\d+\.\d+\/(?:box-seats\/|debug-20261008\/box\/|screenshot-storage-implementation-20261010\/rummikub\/)|(?:uno|avalon)\/validation\/|rummikub\/validation\/ui-preview\/)[\w-]+$/.test(
      outputPath,
    )
  )
    throw new Error('Unrecognized verification evidence');
  const report = local(root, reportPath);
  if (
    report !== `${outputPath}/results.json` &&
    report !== `${outputPath}/report.json`
  )
    throw new Error('Unexpected verification report');
  const resultBytes = await readFile(resolve(root, report));
  const result = JSON.parse(resultBytes);
  if (passed && result.result !== 'passed' && result.status !== 'passed')
    throw new Error('Cannot register unsuccessful result as passed');
  const record = {
    schemaVersion: 1,
    finishedAtUtc: new Date().toISOString(),
    passed: passed === true,
    evidence: { path: report, sha256: hash(resultBytes) },
    screenshotMode: policy?.mode ?? 'selected',
    skippedScreenshots: policy?.skipped ?? 0,
    entries: [],
  };
  // Failure runs retain all work and screenshots for diagnosis.
  if (record.passed) {
    const targets = [];
    if (work) {
      const path = local(root, work);
      if (
        !/^tmp\/(?:game-review|box-layout|rummikub-ui)-[a-zA-Z0-9]{6}$/.test(
          path,
        )
      )
        throw new Error('Unrecognized verification work');
      targets.push({ path, kind: 'temporary-directory' });
    }
    const processPath = `${outputPath}/process`;
    try {
      await lstat(resolve(root, processPath));
      targets.push({ path: processPath, kind: 'process-screenshots' });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const target of targets) {
      // WebView2 can release profile locks after desktop.close resolves.
      // Freeze exact members only after the engineering processes are idle.
      record.entries.push(target);
    }
  }
  const directory = resolve(
    root,
    `artifacts/maintenance/v${version}/artifact-runs`,
  );
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${randomUUID()}.json`);
  await writeFile(path, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  return path;
}

async function docText(root) {
  const parts = [];
  const pending = ['docs'];
  while (pending.length) {
    const folder = pending.pop();
    for (const item of await readdir(resolve(root, folder), {
      withFileTypes: true,
    })) {
      if (item.isSymbolicLink())
        throw new Error('Documentation link prevents safe reference audit');
      const path = `${folder}/${item.name}`;
      if (item.isDirectory()) pending.push(path);
      else if (item.name.endsWith('.md'))
        parts.push(await readFile(resolve(root, path), 'utf8'));
    }
  }
  parts.push(await readFile(resolve(root, 'README.md'), 'utf8'));
  return parts.join('\n').replaceAll('\\', '/').toLowerCase();
}
export async function retirementPlan(
  root = resolve('.'),
  { minimumAgeMinutes = 30 } = {},
) {
  const { version } = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const archive = resolve(
    root,
    `artifacts/releases/TableMax-${version}-win-x64.zip`,
  );
  const archiveHash = hash(await readFile(archive));
  const docs = await docText(root);
  const entries = [],
    skipped = [],
    seen = new Set();
  const maintenance = resolve(root, 'artifacts/maintenance');
  for (const directory of await readdir(maintenance, { withFileTypes: true })) {
    if (!directory.isDirectory() || !/^v\d+\.\d+\.\d+$/.test(directory.name))
      continue;
    const registry = join(maintenance, directory.name, 'artifact-runs');
    let names;
    try {
      names = await readdir(registry);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const name of names.filter((name) =>
      /^[a-f0-9-]+\.json$/.test(name),
    )) {
      const registryPath = local(root, join(registry, name));
      const bytes = await readFile(resolve(root, registryPath));
      const record = JSON.parse(bytes);
      if (record.schemaVersion !== 1 || !record.passed) continue;
      for (const entry of record.entries) {
        if (seen.has(entry.path)) continue;
        seen.add(entry.path);
        const target = resolve(root, entry.path);
        if (docs.includes(entry.path.toLowerCase())) {
          skipped.push({
            path: entry.path,
            reason: 'Document reference; retained',
          });
          continue;
        }
        try {
          await lstat(target);
        } catch (error) {
          if (error.code === 'ENOENT') continue;
          throw error;
        }
        const snapshot = await inventory(target);
        if (
          snapshot.errors.length ||
          snapshot.skippedLinks.length ||
          snapshot.skippedRepositories.length
        ) {
          skipped.push({
            path: entry.path,
            reason: 'Unsafe or unreadable artifact; retained',
          });
          continue;
        }
        const newest = snapshot.files.reduce(
          (value, file) => Math.max(value, file.mtimeMs),
          (await lstat(target)).mtimeMs,
        );
        if (Date.now() - newest < minimumAgeMinutes * 60000) {
          skipped.push({
            path: entry.path,
            reason: 'Recent artifact; next idle maintenance',
          });
          continue;
        }
        const files = [];
        for (const file of snapshot.files) {
          const path = `${entry.path}/${file.path}`;
          if (
            entry.kind === 'process-screenshots' &&
            !/\.(?:png|webp)$/i.test(path)
          )
            throw new Error('Unexpected process screenshot member');
          files.push({
            path,
            bytes: file.bytes,
            sha256: hash(await readFile(resolve(root, path))),
          });
        }
        if (files.some((file) => docs.includes(file.path.toLowerCase()))) {
          skipped.push({
            path: entry.path,
            reason: 'Document reference; retained',
          });
          continue;
        }
        entries.push({
          ...entry,
          files,
          reason: 'Registered completed verification artifact',
          evidence: [
            record.evidence,
            { path: registryPath, sha256: hash(bytes) },
          ],
        });
      }
    }
  }
  return {
    schemaVersion: 1,
    currentArchiveSha256: archiveHash,
    entries,
    skipped,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const output = process.argv[2];
  if (!output) throw new Error('Expected new retirement plan output path');
  const plan = await retirementPlan();
  await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      entries: plan.entries.length,
      skipped: plan.skipped.length,
    }),
  );
}
