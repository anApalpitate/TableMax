import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { documentHeadings } from './read-doc.mjs';
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
  const canonical = (text) =>
    text.replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '').replace(/\s+/g, '');
  const failures = [];
  const texts = new Map();
  for (const item of [...migration.rules, ...migration.sections]) {
    if (!texts.has(item.destination))
      texts.set(
        item.destination,
        canonical(readFileSync(resolve(root, item.destination), 'utf8')),
      );
    if (!texts.get(item.destination).includes(item.expected))
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

export function auditDocumentLinks(root, documents) {
  const failures = [];
  const anchors = new Map();
  let checked = 0;
  function targetAnchors(file) {
    if (!anchors.has(file)) {
      const values = new Set();
      const duplicates = new Map();
      for (const heading of documentHeadings(readFileSync(file, 'utf8'))
        .headings) {
        const slug = headingSlug(heading.title);
        const count = duplicates.get(slug) ?? 0;
        values.add(slug + (count ? `-${count}` : ''));
        duplicates.set(slug, count + 1);
      }
      anchors.set(file, values);
    }
    return anchors.get(file);
  }
  for (const file of documents) {
    const source = readFileSync(resolve(root, file), 'utf8').replace(
      /```[\s\S]*?```|~~~[\s\S]*?~~~/g,
      '',
    );
    for (const match of source.matchAll(
      /!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g,
    )) {
      const href = match[1].replace(/^<|>$/g, '');
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
      const [path, anchor] = href.split('#');
      let target;
      try {
        target = path
          ? resolve(root, dirname(file), decodeURIComponent(path))
          : resolve(root, file);
      } catch {
        failures.push({ file, href, reason: 'invalid URL encoding' });
        continue;
      }
      checked++;
      if (!existsSync(target))
        failures.push({ file, href, reason: 'missing target' });
      else if (
        anchor &&
        target.endsWith('.md') &&
        !targetAnchors(target).has(decodeURIComponent(anchor))
      )
        failures.push({ file, href, reason: 'missing heading' });
    }
  }
  return { checked, failures };
}

export function auditEfficiencyDocs(args = process.argv.slice(2)) {
  const root = process.cwd();
  const documents = [
    ...new Set(
      execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], {
        encoding: 'utf8',
      })
        .split('\0')
        .filter((file) => file.endsWith('.md') && existsSync(file)),
    ),
  ];
  const report = auditDocumentLinks(root, documents);
  const baselinePath = args
    .find((arg) => arg.startsWith('--baseline='))
    ?.slice(11);
  const baseline = baselinePath
    ? JSON.parse(readFileSync(baselinePath, 'utf8'))
    : { failures: [] };
  const known = new Set(baseline.failures.map((item) => JSON.stringify(item)));
  report.newFailures = report.failures.filter(
    (item) => !known.has(JSON.stringify(item)),
  );
  report.agentBytes = Buffer.byteLength(readFileSync('AGENTS.md'));
  report.documents = documents.length;
  const migrationPath = args
    .find((arg) => arg.startsWith('--migration='))
    ?.slice(12);
  if (migrationPath)
    report.migration = auditMigration(
      root,
      JSON.parse(readFileSync(migrationPath, 'utf8')),
    );
  const output = args.find((arg) => arg.startsWith('--report='))?.slice(9);
  if (output) {
    const absolute = resolve(output);
    if (relative(root, absolute).startsWith('..'))
      throw new Error('Report must remain in this repository');
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(
    JSON.stringify({
      documents: report.documents,
      links: report.checked,
      knownFailures: report.failures.length - report.newFailures.length,
      newFailures: report.newFailures.length,
      agentBytes: report.agentBytes,
      migration: report.migration,
      report: output,
    }),
  );
  if (args.includes('--baseline-only')) return report;
  if (
    report.newFailures.length ||
    report.agentBytes > 8192 ||
    report.migration?.failures.length
  ) {
    console.error(JSON.stringify(report.newFailures.slice(0, 12), null, 2));
    process.exitCode = 1;
  }
  return report;
}

if (isDirectExecution(import.meta.url)) auditEfficiencyDocs();
