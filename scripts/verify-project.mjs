import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from './lib/package-limits.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const project = JSON.parse(readFileSync('package.json', 'utf8'));
const args = process.argv.slice(2);
assert.ok(
  args.length <= 1 &&
    args.every((arg) => /^--evidence=[A-Za-z0-9][A-Za-z0-9-]*$/.test(arg)),
  'Use a single safe --evidence name',
);
const evidence =
  args[0]?.slice('--evidence='.length) ?? `project-checks-${Date.now()}`;
const output = resolve(`artifacts/maintenance/v${project.version}/${evidence}`);
mkdirSync(output, { recursive: true });
const files = execFileSync(
  'git',
  ['ls-files', '-z', '-co', '--exclude-standard'],
  {
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);
const documents = [...new Set(files)].filter(
  (file) => file.endsWith('.md') && existsSync(file),
);
const failures = [],
  anchors = new Map();
let localLinks = 0,
  checkedAnchors = 0;
function headings(file) {
  if (anchors.has(file)) return anchors.get(file);
  const result = new Set(),
    duplicates = new Map();
  for (const match of readFileSync(file, 'utf8').matchAll(
    /^#{1,6}\s+(.+)$/gm,
  )) {
    const slug = match[1]
      .trim()
      .toLowerCase()
      .replace(/[`*_~]/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = duplicates.get(slug) ?? 0;
    result.add(slug + (count ? `-${count}` : ''));
    duplicates.set(slug, count + 1);
  }
  anchors.set(file, result);
  return result;
}
for (const file of documents) {
  const source = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of source.matchAll(
    /!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g,
  )) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
    const [path, anchor] = href.split('#');
    const target = path
      ? resolve(dirname(file), decodeURIComponent(path))
      : resolve(file);
    localLinks++;
    if (!existsSync(target))
      failures.push({ file, href, reason: 'missing file' });
    else if (anchor && target.endsWith('.md')) {
      checkedAnchors++;
      if (!headings(target).has(decodeURIComponent(anchor)))
        failures.push({ file, href, reason: 'missing heading' });
    }
  }
}
const manifestPath = `artifacts/releases/TableMax-${project.version}-win-x64-manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.version, project.version);
assert.equal(manifest.archive.name, `TableMax-${project.version}-win-x64.zip`);
assert.equal(
  statSync(`artifacts/releases/${manifest.archive.name}`).size,
  manifest.archive.bytes,
);
const hash = (file) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(
  manifest.archive.sha256,
  hash(`artifacts/releases/${manifest.archive.name}`),
);
assert.ok(
  manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES &&
    manifest.extractedBytes < MAXIMUM_PACKAGE_BYTES,
);
assert.equal(manifest.fileCount, manifest.files.length);
assert.equal(
  manifest.extractedBytes,
  manifest.files.reduce((sum, file) => sum + file.bytes, 0),
);
assert.ok(
  !manifest.files.some((file) =>
    /(?:^|\/)(?:node_modules|\.git|\.cache|tmp)\/|\.sqlite(?:-|$)|\.map$|\.pdb$/i.test(
      file.path,
    ),
  ),
);
for (const name of [
  'games/pokemon-encounters.cjs',
  'games/modern-art.cjs',
  'games/power-grid.cjs',
  'bots/pokemon-encounters.cjs',
  'bots/modern-art.cjs',
  'bots/power-grid.cjs',
]) {
  assert.ok(
    manifest.files.some((file) => file.path === name),
    name,
  );
}
const report = {
  result: failures.length ? 'failed' : 'passed',
  documents: documents.length,
  localLinks,
  checkedAnchors,
  failures,
  archiveSha256: manifest.archive.sha256,
  archiveBytes: manifest.archive.bytes,
  extractedBytes: manifest.extractedBytes,
  packageFiles: manifest.fileCount,
  engineeringBudgetRemainingBytes:
    PACKAGE_BUDGET_BYTES - manifest.extractedBytes,
  scope:
    'All tracked and new Markdown local files/headings; final ZIP hash, manifest totals, essential modules and exclusion gates. Runtime and permission checks are recorded separately.',
};
writeFileSync(
  `${output}/project-checks.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
process.exitCode = failures.length ? 1 : 0;
