import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import {
  boundedLines,
  documentHeadings,
  documentSections,
  explicitMarkdownAnchors,
  formatDocumentError,
  listMarkdownSources,
  markdownLinks,
} from './markdown-source.mjs';
import { validateOwnedChanges } from '../test/runner/plan.mjs';
import { localFile } from '../test/runner/evidence.mjs';
import { isDirectExecution } from '../shared/workspace-root.mjs';

export function headingSlug(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

export function auditMigration(root, migration) {
  const canonical = (text) => {
    const compact = text
      .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
      .replace(/\s+/g, '');
    const normalizeSeparators = (prose) =>
      prose.replace(/(?<=\|)\|(?::?-{3,}:?\|){2,}(?=\|)/g, (row) =>
        row.replace(/-{3,}/g, '---'),
      );
    let result = '',
      position = 0;
    const markers = compact.matchAll(/`+|~{3,}/g);
    for (const marker of markers) {
      if (marker.index < position) continue;
      const close = compact.indexOf(marker[0], marker.index + marker[0].length);
      if (close < 0)
        return (
          result +
          normalizeSeparators(compact.slice(position, marker.index)) +
          compact.slice(marker.index)
        );
      result += normalizeSeparators(compact.slice(position, marker.index));
      result += compact.slice(marker.index, close + marker[0].length);
      position = close + marker[0].length;
    }
    return result + normalizeSeparators(compact.slice(position));
  };
  if (!Array.isArray(migration?.rules) || !Array.isArray(migration?.sections))
    throw new Error('Migration requires rules and sections arrays');
  const failures = [];
  const texts = new Map();
  for (const item of [...migration.rules, ...migration.sections]) {
    if (
      typeof item.destination !== 'string' ||
      typeof item.expected !== 'string'
    )
      throw new Error('Invalid migration destination or expected content');
    if (!texts.has(item.destination))
      texts.set(
        item.destination,
        canonical(readFileSync(localFile(root, item.destination), 'utf8')),
      );
    if (!texts.get(item.destination).includes(canonical(item.expected)))
      failures.push({
        destination: item.destination,
        title: item.title,
        sourceSha256: item.sourceSha256,
      });
  }
  return {
    rules: migration.rules.length,
    sections: migration.sections.length,
    failures,
  };
}

const pathKey = (path) =>
  process.platform === 'win32' ? path.toLowerCase() : path;

function linkTarget(root, file, href) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return undefined;
  const hash = href.indexOf('#');
  const path = hash < 0 ? href : href.slice(0, hash);
  const anchor = hash < 0 ? '' : decodeURIComponent(href.slice(hash + 1));
  const decoded = decodeURIComponent(path);
  return {
    target: decoded
      ? resolve(root, dirname(file), decoded)
      : resolve(root, file),
    anchor,
  };
}

function isInside(root, path) {
  const local = relative(root, path);
  return !isAbsolute(local) && local !== '..' && !local.startsWith('..' + sep);
}

export function auditDocumentLinks(
  root,
  documents,
  { changedPaths, changedSources } = {},
) {
  const failures = [];
  const warnings = [];
  const anchors = new Map();
  const selected = new Set();
  let checked = 0;
  const targets =
    changedPaths &&
    new Set(changedPaths.map((file) => pathKey(resolve(root, file))));
  const sources = changedSources && new Set(changedSources);
  function targetAnchors(file) {
    const key = pathKey(file);
    if (!anchors.has(key)) {
      const source = readFileSync(file, 'utf8');
      const values = explicitMarkdownAnchors(source);
      const duplicates = new Map();
      for (const heading of documentHeadings(source).headings) {
        const slug = headingSlug(heading.title);
        const count = duplicates.get(slug) ?? 0;
        values.add(slug + (count ? `-${count}` : ''));
        duplicates.set(slug, count + 1);
      }
      anchors.set(key, values);
    }
    return anchors.get(key);
  }
  for (const file of documents) {
    const source = readFileSync(localFile(root, file), 'utf8');
    const allOutgoing = !targets || sources?.has(file);
    if (allOutgoing) selected.add(file);
    for (const { href, line } of markdownLinks(source)) {
      let destination;
      try {
        destination = linkTarget(root, file, href);
      } catch {
        if (allOutgoing)
          failures.push({ file, href, reason: 'invalid URL encoding' });
        continue;
      }
      if (!destination) continue;
      if (!allOutgoing && !targets.has(pathKey(destination.target))) continue;
      selected.add(file);
      const { target, anchor } = destination;
      checked++;
      try {
        const stat = statSync(target);
        if (anchor && /\.md$/i.test(target)) {
          if (!stat.isFile())
            failures.push({
              file,
              href,
              reason: 'Markdown target is not a file',
            });
          else if (!targetAnchors(target).has(anchor))
            failures.push({ file, href, reason: 'missing heading' });
        }
      } catch (error) {
        failures.push({
          file,
          href,
          reason: ['ENOENT', 'ENOTDIR'].includes(error.code)
            ? 'missing target'
            : 'target read failed: ' + (error.code ?? error.message),
        });
      }
      if (
        isInside(resolve(root), target) &&
        /(?:^|[\\/])archive(?:[\\/]|$)/i.test(relative(root, target)) &&
        !/(?:^|\/)archive\//i.test(file) &&
        /(?:^|\/)(?:README|AGENTS)\.md$/i.test(file)
      )
        warnings.push({
          file,
          line,
          href,
          reason: 'history-entry-review',
          detail:
            'Confirm this is intentional historical navigation, not the current authoritative answer',
        });
    }
    if (!selected.has(file)) continue;
    const { lines, sections } = documentSections(source);
    const duplicates = new Map();
    for (const section of sections) {
      const previous = duplicates.get(section.title);
      if (previous)
        warnings.push({
          file,
          line: section.line,
          title: section.title,
          reason: 'duplicate-heading',
          firstLine: previous,
          detail: 'Exact-title reading is ambiguous; use --heading-line',
        });
      else duplicates.set(section.title, section.line);
      const bytes = Buffer.byteLength(
        lines.slice(section.line - 1, section.end).join('\n'),
      );
      if (bytes > 16384)
        warnings.push({
          file,
          line: section.line,
          title: section.title,
          reason: 'long-section',
          bytes,
          detail:
            'Review whether this section answers one independent question; size alone does not require splitting',
        });
    }
  }
  return {
    checked,
    failures,
    warnings,
    selectedDocuments: [...selected].sort(),
  };
}

function parseAuditOptions(args) {
  const options = {};
  const seen = new Set();
  for (const arg of args) {
    const name = arg.split('=')[0];
    if (seen.has(name)) throw new Error('Duplicate option: ' + name);
    seen.add(name);
    if (arg === '--baseline-only') options.baselineOnly = true;
    else if (arg.startsWith('--baseline=')) options.baseline = arg.slice(11);
    else if (arg.startsWith('--migration=')) options.migration = arg.slice(12);
    else if (arg.startsWith('--report=')) options.report = arg.slice(9);
    else if (arg.startsWith('--changes=')) options.changes = arg.slice(10);
    else throw new Error('Unknown option: ' + arg);
  }
  return options;
}

export function auditEfficiencyDocs(
  args = process.argv.slice(2),
  {
    root = process.cwd(),
    stdout = (text) => process.stdout.write(text),
    stderr = (text) => process.stderr.write(text),
  } = {},
) {
  if (args.includes('--help')) {
    stdout(
      'docs:audit [--changes=owned.json] [--baseline=report.json] [--migration=migration.json] [--report=output.json] [--baseline-only]\n',
    );
    return;
  }
  const options = parseAuditOptions(args);
  const documents = listMarkdownSources(root, { history: true });
  const readJson = (path) =>
    JSON.parse(readFileSync(localFile(root, path), 'utf8'));
  const changes =
    options.changes && validateOwnedChanges(root, readJson(options.changes));
  const changedPaths = changes?.files.map((item) =>
    item.path.replaceAll('\\', '/'),
  );
  const changedSources = changedPaths?.filter(
    (file) => /\.md$/i.test(file) && documents.includes(file),
  );
  const report = auditDocumentLinks(root, documents, {
    changedPaths,
    changedSources,
  });
  const baseline = options.baseline
    ? readJson(options.baseline)
    : { failures: [] };
  if (!Array.isArray(baseline.failures))
    throw new Error('Baseline requires a failures array');
  const failureKey = ({ file, href, reason }) =>
    JSON.stringify({ file, href, reason });
  const known = new Set(baseline.failures.map(failureKey));
  report.newFailures = report.failures.filter(
    (item) => !known.has(failureKey(item)),
  );
  report.agentBytes = Buffer.byteLength(
    readFileSync(localFile(root, 'AGENTS.md')),
  );
  report.documents = report.selectedDocuments.length;
  report.scannedDocuments = documents.length;
  report.mode = changes ? 'changes-and-incoming' : 'full';
  report.changes = changes ?? null;
  if (options.migration)
    report.migration = auditMigration(root, readJson(options.migration));
  report.failed =
    !options.baselineOnly &&
    Boolean(
      report.newFailures.length ||
      report.agentBytes > 8192 ||
      report.migration?.failures.length,
    );
  if (options.report) {
    const absolute = localFile(root, options.report);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, JSON.stringify(report, null, 2) + '\n');
  }
  const summary = {
    mode: report.mode,
    scannedDocuments: report.scannedDocuments,
    documents: report.documents,
    links: report.checked,
    knownFailures: report.failures.length - report.newFailures.length,
    newFailures: report.newFailures.length,
    warnings: report.warnings.length,
    agentBytes: report.agentBytes,
    migration: report.migration && {
      rules: report.migration.rules,
      sections: report.migration.sections,
      failures: report.migration.failures.length,
    },
    report: options.report,
    passed: !report.failed,
  };
  stdout(
    boundedLines(
      [JSON.stringify(summary)],
      2048,
      '\nTRUNCATED: summary metadata omitted; inspect --report output\n',
    ).text,
  );
  if (report.failed) {
    const details = [
      ...(report.agentBytes > 8192
        ? [{ reason: 'AGENTS.md exceeds 8192 bytes', bytes: report.agentBytes }]
        : []),
      ...report.newFailures,
      ...(report.migration?.failures ?? []),
    ];
    stderr(
      boundedLines(
        details.map((item) => JSON.stringify(item)),
        8192,
        '\nTRUNCATED: failure details omitted; use --report for the complete audit\n',
      ).text,
    );
  }
  return report;
}

if (isDirectExecution(import.meta.url)) {
  try {
    const report = auditEfficiencyDocs();
    if (report?.failed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(formatDocumentError(error, 8192));
    process.exitCode = 1;
  }
}
