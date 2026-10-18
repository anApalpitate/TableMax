import {
  documentHeadings,
  formatDocumentError,
  loadMarkdown,
  validateByteBudget,
} from './markdown-source.mjs';
import { isDirectExecution } from '../shared/workspace-root.mjs';

export { documentHeadings };

function encodeCursor(document, selection, outline, line, column) {
  return (
    'v1.' +
    Buffer.from(
      JSON.stringify({
        p: document.path,
        h: document.sha256,
        s: [selection.start, selection.end],
        m: outline ? 'outline' : 'body',
        l: line,
        c: column,
      }),
    ).toString('base64url')
  );
}

function decodeCursor(cursor) {
  if (/^\d+:\d+$/.test(cursor))
    throw new Error(
      'Legacy line:column cursors are not version-bound; restart with --outline or --heading',
    );
  if (!/^v1\.[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 16384)
    throw new Error('Expected a v1 version-bound cursor');
  let value;
  try {
    const encoded = cursor.slice(3);
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded)
      throw new Error('Noncanonical cursor');
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Invalid v1 cursor; restart document selection');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.p !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.h) ||
    !Array.isArray(value.s) ||
    value.s.length !== 2 ||
    !value.s.every(Number.isSafeInteger) ||
    !['body', 'outline'].includes(value.m) ||
    !Number.isSafeInteger(value.l) ||
    !Number.isSafeInteger(value.c)
  )
    throw new Error('Invalid v1 cursor fields; restart document selection');
  return value;
}

function selectRange(document, heading, headingLine) {
  const { headings, lines } = document;
  if (heading !== undefined && headingLine !== undefined)
    throw new Error('Use either --heading or --heading-line, not both');
  let selected;
  if (heading !== undefined) {
    const matches = headings.filter((item) => item.title === heading);
    if (matches.length !== 1) {
      const error = new Error(
        'Heading must match exactly one section; use --outline or --heading-line',
      );
      error.candidates = matches.length ? matches : headings;
      throw error;
    }
    selected = matches[0];
  } else if (headingLine !== undefined) {
    if (!Number.isSafeInteger(headingLine) || headingLine < 1)
      throw new Error('heading-line must be a positive heading source line');
    selected = headings.find((item) => item.line === headingLine);
    if (!selected)
      throw new Error(
        'heading-line must identify the start of a Markdown heading',
      );
  }
  const start = selected?.line ?? 1;
  const end = selected
    ? headings.find((item) => item.line > start && item.level <= selected.level)
        ?.line - 1 || lines.length
    : lines.length;
  return { start, end };
}

export function readDocument({
  root = process.cwd(),
  file,
  heading,
  headingLine,
  outline,
  cursor,
  expectSha256,
  maxBytes = 8192,
}) {
  validateByteBudget(maxBytes);
  const document = loadMarkdown(root, file);
  if (expectSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(expectSha256))
    throw new Error('expect-sha256 must contain a full SHA256');
  if (
    expectSha256 !== undefined &&
    expectSha256.toLowerCase() !== document.sha256
  )
    throw new Error(
      'Document SHA256 changed; locate the current section again',
    );
  const continuation = cursor === undefined ? undefined : decodeCursor(cursor);
  if (
    continuation &&
    (continuation.p !== document.path || continuation.h !== document.sha256)
  )
    throw new Error(
      'Cursor file or SHA256 changed; restart document selection',
    );
  let range;
  if (continuation) {
    range = { start: continuation.s[0], end: continuation.s[1] };
    if (heading !== undefined || headingLine !== undefined) {
      const explicit = selectRange(document, heading, headingLine);
      if (explicit.start !== range.start || explicit.end !== range.end)
        throw new Error('Cursor section conflicts with the selected heading');
    }
    if (outline !== undefined && outline !== (continuation.m === 'outline'))
      throw new Error('Cursor mode conflicts with --outline');
    outline = continuation.m === 'outline';
    const validRange =
      (range.start === 1 && range.end === document.lines.length) ||
      document.sections.some(
        (section) => section.line === range.start && section.end === range.end,
      );
    if (!validRange)
      throw new Error('Cursor selection is not a current document section');
  } else range = selectRange(document, heading, headingLine);
  const { start, end } = range;
  const line = continuation?.l ?? start;
  let column = continuation?.c ?? 0;
  const { lines, headings } = document;
  const entryText = outline
    ? headings.find((item) => item.line === line)
    : undefined;
  const cursorText =
    outline && entryText
      ? '#'.repeat(entryText.level) + ' ' + entryText.title
      : lines[line - 1];
  if (
    line < start ||
    line > end ||
    column < 0 ||
    (continuation && outline && !entryText) ||
    column > Array.from(cursorText ?? '').length
  )
    throw new Error('Cursor is outside the selected document section');
  const entries = outline
    ? headings
        .filter((item) => item.line >= line && item.line <= end)
        .map((item) => ({
          line: item.line,
          text: '#'.repeat(item.level) + ' ' + item.title,
        }))
    : lines
        .slice(line - 1, end)
        .map((text, index) => ({ line: line + index, text }));
  const header = `${document.path} | lines ${start}-${end} | sha256=${document.sha256}\n`;
  const footer = (next) =>
    next
      ? `MORE: --cursor=${next}; omitted content is not an absent result\n`
      : 'END: selected content complete\n';
  let output = header;
  let next;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const points = Array.from(entry.text).slice(column);
    const prefix = `${entry.line}${column ? '+' : ''}: `;
    const after = entries[index + 1];
    const fullNext = after
      ? encodeCursor(document, range, outline, after.line, 0)
      : undefined;
    if (
      Buffer.byteLength(
        output + prefix + points.join('') + '\n' + footer(fullNext),
      ) <= maxBytes
    ) {
      output += prefix + points.join('') + '\n';
      next = fullNext;
      column = 0;
      continue;
    }
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const count = Math.ceil((low + high) / 2);
      const candidate = encodeCursor(
        document,
        range,
        outline,
        entry.line,
        column + count,
      );
      if (
        Buffer.byteLength(
          output +
            prefix +
            points.slice(0, count).join('') +
            '\n' +
            footer(candidate),
        ) <= maxBytes
      )
        low = count;
      else high = count - 1;
    }
    if (low > 0) {
      output += prefix + points.slice(0, low).join('') + '\n';
      column += low;
    }
    next = encodeCursor(document, range, outline, entry.line, column);
    if (
      output === header ||
      Buffer.byteLength(output + footer(next)) > maxBytes
    )
      throw new Error(
        'max-bytes cannot fit cursor metadata and source content; increase the byte budget',
      );
    break;
  }
  const text = output + footer(next);
  if (Buffer.byteLength(text) > maxBytes)
    throw new Error(
      'max-bytes cannot fit document metadata; increase the byte budget',
    );
  return {
    text,
    nextCursor: next,
    range,
    headings,
    sha256: document.sha256,
    path: document.path,
  };
}

export function readDocMain(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log(
      'docs:read <file.md> [--outline] [--heading=exact-title|--heading-line=N] [--expect-sha256=SHA256] [--cursor=v1.token] [--max-bytes=8192]',
    );
    return;
  }
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file || args.filter((arg) => !arg.startsWith('--')).length !== 1)
    throw new Error('Expected exactly one Markdown path');
  const options = { file };
  const seen = new Set();
  for (const arg of args.filter((item) => item.startsWith('--'))) {
    const name = arg.split('=')[0];
    if (seen.has(name)) throw new Error('Duplicate option: ' + name);
    seen.add(name);
    if (arg === '--outline') options.outline = true;
    else if (arg.startsWith('--heading=')) options.heading = arg.slice(10);
    else if (arg.startsWith('--heading-line='))
      options.headingLine = Number(arg.slice(15));
    else if (arg.startsWith('--expect-sha256='))
      options.expectSha256 = arg.slice(16);
    else if (arg.startsWith('--cursor=')) options.cursor = arg.slice(9);
    else if (arg.startsWith('--max-bytes='))
      options.maxBytes = Number(arg.slice(12));
    else throw new Error('Unknown option: ' + arg);
  }
  try {
    const result = readDocument(options);
    process.stdout.write(result.text);
    return result;
  } catch (error) {
    error.outputBudget = options.maxBytes;
    throw error;
  }
}

if (isDirectExecution(import.meta.url)) {
  try {
    readDocMain();
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
