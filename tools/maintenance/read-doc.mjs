import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isDirectExecution } from '../shared/workspace-root.mjs';

export function documentHeadings(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const headings = [];
  let fence;
  for (const [index, line] of lines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length)
        fence = undefined;
      continue;
    }
    if (fence) continue;
    const match = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (match)
      headings.push({
        level: match[1].length,
        title: match[2],
        line: index + 1,
      });
  }
  return { lines, headings };
}

export function readDocument({
  root = process.cwd(),
  file,
  heading,
  outline = false,
  cursor,
  maxBytes = 8192,
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 512 || maxBytes > 1048576)
    throw new Error('max-bytes must be an integer from 512 to 1048576');
  const realRoot = realpathSync(root);
  const absolute = realpathSync(resolve(root, file));
  const local = relative(realRoot, absolute);
  if (
    isAbsolute(local) ||
    local === '..' ||
    local.startsWith('..' + sep) ||
    !/\.md$/i.test(local) ||
    /^(?:\.git|node_modules|\.cache|artifacts|tmp)(?:[\\/]|$)/i.test(local)
  )
    throw new Error('Expected a Markdown source file inside this repository');
  const { lines, headings } = documentHeadings(readFileSync(absolute, 'utf8'));
  let start = 1;
  let end = lines.length;
  if (heading !== undefined) {
    const matches = headings.filter((item) => item.title === heading);
    if (matches.length !== 1) {
      const candidates = matches.length ? matches : headings;
      const error = new Error(
        'Heading must match exactly one section; use --outline and --cursor=line:0',
      );
      error.candidates = candidates;
      throw error;
    }
    const selected = matches[0];
    start = selected.line;
    end =
      headings.find((item) => item.line > start && item.level <= selected.level)
        ?.line - 1 || lines.length;
  }
  const match = cursor === undefined ? undefined : /^(\d+):(\d+)$/.exec(cursor);
  if (cursor !== undefined && !match)
    throw new Error('cursor must be line:column');
  let line = match ? Number(match[1]) : start;
  let column = match ? Number(match[2]) : 0;
  if (
    !Number.isSafeInteger(line) ||
    !Number.isSafeInteger(column) ||
    line < start ||
    line > end ||
    column > Array.from(lines[line - 1]).length
  )
    throw new Error('Cursor is outside the selected document section');
  const header = `${local.replaceAll('\\', '/')} | lines ${start}-${end}\n`;
  const reserve = 170;
  let output = header;
  const entries = outline
    ? headings
        .filter((item) => item.line >= line && item.line <= end)
        .map((item) => ({
          line: item.line,
          text: `${'#'.repeat(item.level)} ${item.title}`,
        }))
    : lines
        .slice(line - 1, end)
        .map((text, index) => ({ line: line + index, text }));
  let next;
  for (const entry of entries) {
    const prefix = `${entry.line}${column ? '+' : ''}: `;
    const available =
      maxBytes - reserve - Buffer.byteLength(output + prefix + '\n');
    const points = Array.from(entry.text).slice(column);
    let fragment = '';
    let used = 0;
    for (const point of points) {
      if (used + Buffer.byteLength(point) > available) break;
      fragment += point;
      used += Buffer.byteLength(point);
    }
    if (available < 0 || (!fragment && points.length)) {
      next = `${entry.line}:${column}`;
      break;
    }
    output += prefix + fragment + '\n';
    if (fragment.length !== points.join('').length) {
      next = `${entry.line}:${column + Array.from(fragment).length}`;
      break;
    }
    column = 0;
  }
  output += next
    ? `MORE: --cursor=${next}${outline ? ' --outline' : ''}; omitted content is not an absent result\n`
    : 'END: selected content complete\n';
  return { text: output, nextCursor: next, range: { start, end }, headings };
}

export function readDocMain(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log(
      'docs:read <file.md> [--outline] [--heading=exact-title] [--cursor=line:column] [--max-bytes=8192]',
    );
    return;
  }
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file || args.filter((arg) => !arg.startsWith('--')).length !== 1)
    throw new Error('Expected exactly one Markdown path');
  const options = { file };
  for (const arg of args.filter((item) => item.startsWith('--'))) {
    if (arg === '--outline') options.outline = true;
    else if (arg.startsWith('--heading=')) options.heading = arg.slice(10);
    else if (arg.startsWith('--cursor=')) options.cursor = arg.slice(9);
    else if (arg.startsWith('--max-bytes='))
      options.maxBytes = Number(arg.slice(12));
    else throw new Error('Unknown option: ' + arg);
  }
  try {
    process.stdout.write(readDocument(options).text);
  } catch (error) {
    if (error.candidates) {
      process.stderr.write(
        'Ambiguous or missing heading. Candidate outline:\n',
      );
      process.stderr.write(
        readDocument({ file, outline: true, maxBytes: 8192 }).text,
      );
    }
    throw error;
  }
}

if (isDirectExecution(import.meta.url)) {
  try {
    readDocMain();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
