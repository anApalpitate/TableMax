import {
  boundedLines,
  clipUtf8,
  formatDocumentError,
  listMarkdownSources,
  loadMarkdown,
  markdownLinks,
  validateByteBudget,
} from './markdown-source.mjs';
import { isDirectExecution } from '../shared/workspace-root.mjs';

const normalize = (text) =>
  text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

function readArguments(document, section) {
  return [
    document.path,
    ...(section ? [`--heading-line=${section.line}`] : []),
    `--expect-sha256=${document.sha256}`,
  ];
}

function excerpt(lines, start, end, query) {
  const selected = lines.slice(start - 1, end);
  const needle = query.split(' ')[0];
  const index = selected.findIndex((line) => normalize(line).includes(needle));
  const line = index < 0 ? start : start + index;
  const text = lines[line - 1] ?? '';
  const normalized = normalize(text);
  const position = Math.max(0, normalized.indexOf(needle));
  const from = Math.max(
    0,
    Array.from(normalized.slice(0, position)).length - 30,
  );
  const tail = Array.from(text).slice(from).join('');
  const prefix = from ? '…' : '';
  const budget = 240 - Buffer.byteLength(prefix);
  const clipped = Buffer.byteLength(tail) > budget;
  return {
    line,
    text:
      prefix +
      clipUtf8(tail, budget - (clipped ? 3 : 0)) +
      (clipped ? '…' : ''),
    truncated: Boolean(from || clipped),
  };
}

function findInDocument(document, query) {
  const candidates = [];
  const preambleEnd =
    (document.headings[0]?.line ?? document.lines.length + 1) - 1;
  const sections = [
    ...(preambleEnd
      ? [
          {
            line: 1,
            end: preambleEnd,
            leadEnd: preambleEnd,
            title: '',
            titles: [],
            parents: [],
            preamble: true,
          },
        ]
      : []),
    ...document.sections,
  ];
  const links = markdownLinks(document.source);
  for (const section of sections) {
    const title = normalize(section.title);
    const body = normalize(
      document.lines
        .slice(
          section.preamble ? section.line - 1 : section.line,
          section.leadEnd,
        )
        .join('\n'),
    );
    const rank =
      title === query
        ? 0
        : title.includes(query)
          ? 1
          : body.includes(query)
            ? 2
            : undefined;
    if (rank === undefined) continue;
    const ranges = [section, ...section.parents];
    const related = links.filter((link) =>
      ranges.some(
        (range) => link.line >= range.line && link.line <= range.leadEnd,
      ),
    );
    candidates.push({
      path: document.path,
      sha256: document.sha256,
      heading: section.title || '(document preamble)',
      headingPath: section.titles,
      line: section.line,
      range: { start: section.line, end: section.end },
      match: ['heading-exact', 'heading-contains', 'body'][rank],
      rank,
      excerpt: excerpt(document.lines, section.line, section.leadEnd, query),
      readArgs: readArguments(document, section.preamble ? undefined : section),
      context: {
        complete: false,
        reason:
          'Locator excerpt only; read the section, parent prerequisites and referenced exceptions before relying on it',
        parents: section.parents.map((parent) => ({
          headingPath: parent.titles,
          leadRange: { start: parent.line, end: parent.leadEnd },
          readArgs: readArguments(document, parent),
        })),
        related: related.slice(0, 3),
        omittedRelated: Math.max(0, related.length - 3),
      },
    });
  }
  return candidates;
}

function renderResult(result, index) {
  const parents = result.context.parents.map(
    (parent) =>
      `${parent.headingPath.join(' > ')} [lines ${parent.leadRange.start}-${parent.leadRange.end}; --heading-line=${parent.leadRange.start}]`,
  );
  return [
    `${index + 1}. ${result.path}:${result.line} | sha256=${result.sha256}`,
    `TITLE: ${result.headingPath.join(' > ') || result.heading} | lines ${result.range.start}-${result.range.end} | ${result.match}`,
    `EXCERPT ${result.excerpt.line}: ${result.excerpt.text}${result.excerpt.truncated ? ' [excerpt truncated]' : ''}`,
    'READ: node tools/maintenance/read-doc.mjs ' +
      result.readArgs
        .map((value) => "'" + value.replaceAll("'", "''") + "'")
        .join(' '),
    'CONTEXT: partial; locator excerpt does not establish complete prerequisites, scope, status or exceptions',
    ...(parents.length
      ? ['PARENT READS (same file/SHA): ' + parents.join('; ')]
      : []),
    ...(result.context.related.length
      ? [
          'RELATED SOURCE LINKS: ' +
            result.context.related
              .map((link) => `line ${link.line}: ${link.href}`)
              .join('; '),
        ]
      : []),
    ...(result.context.omittedRelated
      ? [
          `RELATED OMITTED: ${result.context.omittedRelated}; read the source section`,
        ]
      : []),
  ];
}

export function findDocuments({
  root = process.cwd(),
  query,
  path,
  history = false,
  limit = 5,
  maxBytes = 8192,
}) {
  validateByteBudget(maxBytes);
  if (typeof query !== 'string' || !normalize(query))
    throw new Error('Expected a nonempty search query');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error('limit must be an integer from 1 to 100');
  const needle = normalize(query);
  let enumeration = 'git';
  let enumerationNotice;
  const documents = listMarkdownSources(root, {
    path,
    history,
    onFallback: (fallback) => {
      enumeration = fallback.enumeration;
      enumerationNotice = fallback.notice;
    },
  });
  const matches = documents
    .flatMap((file) => findInDocument(loadMarkdown(root, file), needle))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line),
    );
  const results = matches.slice(0, limit);
  const header = `SEARCH: ${JSON.stringify(query)} | path=${path ?? '.'} | enumeration=${enumeration} | archive=${history ? 'included' : 'excluded'} | files=${documents.length} | matches=${matches.length}`;
  const footer = `END: matched ${matches.length}; selected ${results.length}; omitted by limit ${Math.max(0, matches.length - results.length)}; locator context remains partial`;
  const rendered = boundedLines(
    [
      header,
      ...(enumerationNotice ? ['BOUNDARY: ' + enumerationNotice] : []),
      ...results.flatMap(renderResult),
      ...(matches.length
        ? []
        : [
            'NO MATCH: within the stated source boundary; this does not prove absence outside it',
          ]),
      footer,
    ],
    maxBytes,
    '\nTRUNCATED: candidate/context output omitted; narrow --path, increase --max-bytes or read the indicated source; results are not complete\n',
  );
  return {
    query,
    path: path ?? '.',
    history,
    enumeration,
    enumerationNotice,
    documents: documents.length,
    totalMatches: matches.length,
    results,
    omittedByLimit: Math.max(0, matches.length - results.length),
    ...rendered,
  };
}

export function findDocMain(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log(
      'docs:find <query> [--path=repository/file-or-directory] [--history] [--limit=5] [--max-bytes=8192]',
    );
    return;
  }
  const positional = args.filter((arg) => !arg.startsWith('--'));
  if (positional.length !== 1)
    throw new Error('Expected exactly one quoted query');
  const options = { query: positional[0] };
  const seen = new Set();
  for (const arg of args.filter((value) => value.startsWith('--'))) {
    const name = arg.split('=')[0];
    if (seen.has(name)) throw new Error('Duplicate option: ' + name);
    seen.add(name);
    if (arg === '--history') options.history = true;
    else if (arg.startsWith('--path=')) options.path = arg.slice(7);
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice(8));
    else if (arg.startsWith('--max-bytes='))
      options.maxBytes = Number(arg.slice(12));
    else throw new Error('Unknown option: ' + arg);
  }
  try {
    const result = findDocuments(options);
    process.stdout.write(result.text);
    return result;
  } catch (error) {
    error.outputBudget = options.maxBytes;
    throw error;
  }
}

if (isDirectExecution(import.meta.url)) {
  try {
    findDocMain();
  } catch (error) {
    const requestedBudget = Number(
      process.argv
        .slice(2)
        .find((arg) => arg.startsWith('--max-bytes='))
        ?.slice(12),
    );
    process.stderr.write(
      formatDocumentError(error, error.outputBudget ?? requestedBudget),
    );
    process.exitCode = 1;
  }
}
