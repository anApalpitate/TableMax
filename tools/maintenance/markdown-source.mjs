import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const excludedParts = new Set([
  '.git',
  'node_modules',
  '.cache',
  'artifacts',
  'tmp',
  'build',
  'dist',
  'coverage',
]);

export const sourceSha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

export function validateByteBudget(value = 8192) {
  if (!Number.isSafeInteger(value) || value < 512 || value > 1048576)
    throw new Error('max-bytes must be an integer from 512 to 1048576');
  return value;
}

export function clipUtf8(value, maxBytes) {
  let result = '';
  let used = 0;
  for (const point of String(value)) {
    const bytes = Buffer.byteLength(point);
    if (used + bytes > maxBytes) break;
    result += point;
    used += bytes;
  }
  return result;
}

export function boundedLines(
  lines,
  maxBytes,
  omitted = '\nTRUNCATED: more output omitted\n',
) {
  let text = '';
  for (let index = 0; index < lines.length; index++) {
    const line = String(lines[index]).replace(/\n?$/, '\n');
    if (
      Buffer.byteLength(text + line) <= maxBytes &&
      index === lines.length - 1
    )
      return { text: text + line, truncated: false };
    if (Buffer.byteLength(text + line + omitted) > maxBytes) {
      const available = maxBytes - Buffer.byteLength(text + omitted);
      return {
        text: text + clipUtf8(line, Math.max(0, available)) + omitted,
        truncated: true,
      };
    }
    text += line;
  }
  return { text, truncated: false };
}

export function formatDocumentError(error, maxBytes = 8192) {
  const budget =
    Number.isSafeInteger(maxBytes) && maxBytes >= 512 && maxBytes <= 1048576
      ? maxBytes
      : 8192;
  const lines = ['ERROR: ' + error.message];
  if (error.candidates) {
    lines.push('Candidate headings (use --heading-line=<line>):');
    for (const item of error.candidates)
      lines.push(`${item.line}: ${'#'.repeat(item.level)} ${item.title}`);
  }
  return boundedLines(lines, budget).text;
}

export function sourcePath(
  root,
  file,
  { markdown = true, directory = false } = {},
) {
  if (typeof file !== 'string' || !file.trim())
    throw new Error('Expected a nonempty repository source path');
  const realRoot = realpathSync(root);
  const absolute = resolve(realRoot, file);
  const local = relative(realRoot, absolute);
  if (
    isAbsolute(local) ||
    local === '..' ||
    local.startsWith('..' + sep) ||
    local
      .split(/[\\/]/)
      .some((part) => excludedParts.has(part.toLowerCase())) ||
    (markdown && !/\.md$/i.test(local))
  )
    throw new Error('Expected a Markdown source path inside this repository');
  for (let cursor = absolute; cursor !== realRoot; cursor = dirname(cursor)) {
    if (existsSync(cursor)) {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink())
        throw new Error('Linked source paths are not supported: ' + file);
      if (stat.isDirectory() && existsSync(resolve(cursor, '.git')))
        throw new Error(
          'Nested repository source paths are not supported: ' + file,
        );
    }
  }
  const stat = lstatSync(absolute);
  if (
    !(directory === 'either'
      ? stat.isDirectory() || stat.isFile()
      : directory
        ? stat.isDirectory()
        : stat.isFile())
  )
    throw new Error('Expected a source ' + (directory ? 'directory' : 'file'));
  return { root: realRoot, absolute, path: local.replaceAll('\\', '/') };
}

function markdownLines(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const visible = [];
  let fence;
  let comment = false;
  for (const line of lines) {
    const rawMarker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (
      !fence &&
      !comment &&
      rawMarker &&
      !(rawMarker[1][0] === '`' && rawMarker[2].includes('`'))
    ) {
      fence = rawMarker[1];
      visible.push('');
      continue;
    }
    let clean = line;
    if (!fence) {
      const commentLocations = line.replace(/(`+)(.*?)\1/g, (span) =>
        ' '.repeat(span.length),
      );
      clean = '';
      let position = 0;
      while (position < line.length) {
        if (comment) {
          const close = commentLocations.indexOf('-->', position);
          if (close < 0) break;
          comment = false;
          position = close + 3;
        } else {
          const open = commentLocations.indexOf('<!--', position);
          if (open < 0) {
            clean += line.slice(position);
            break;
          }
          clean += line.slice(position, open);
          comment = true;
          position = open + 4;
        }
      }
    }
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(clean);
    if (
      marker &&
      !fence &&
      !(marker[1][0] === '`' && marker[2].includes('`'))
    ) {
      fence = marker[1];
      visible.push('');
    } else if (
      marker &&
      fence &&
      marker[1][0] === fence[0] &&
      marker[1].length >= fence.length &&
      !marker[2].trim()
    ) {
      fence = undefined;
      visible.push('');
    } else visible.push(fence ? '' : clean);
  }
  return { lines, visible };
}

export function documentHeadings(source) {
  const { lines, visible } = markdownLines(source);
  const headings = [];
  for (const [index, line] of visible.entries()) {
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

export function documentSections(source) {
  const { lines, headings } = documentHeadings(source);
  const stack = [];
  const sections = headings.map((heading, index) => {
    while (stack.length && stack.at(-1).level >= heading.level) stack.pop();
    const section = {
      ...heading,
      end:
        headings.find(
          (item) => item.line > heading.line && item.level <= heading.level,
        )?.line - 1 || lines.length,
      leadEnd: (headings[index + 1]?.line ?? lines.length + 1) - 1,
      parents: [...stack],
      titles: [...stack.map((item) => item.title), heading.title],
    };
    stack.push(section);
    return section;
  });
  return { lines, headings, sections };
}

export function loadMarkdown(root, file) {
  const location = sourcePath(root, file);
  const bytes = readFileSync(location.absolute);
  const source = bytes.toString('utf8');
  return {
    ...location,
    bytes,
    sha256: sourceSha256(bytes),
    source,
    ...documentSections(source),
  };
}

export function listMarkdownSources(
  root,
  { path, history = false, onFallback } = {},
) {
  const realRoot = realpathSync(root);
  let filter = '';
  if (path !== undefined) {
    const location = sourcePath(realRoot, path, {
      markdown: false,
      directory: 'either',
    });
    if (lstatSync(location.absolute).isFile() && !/\.md$/i.test(location.path))
      throw new Error('Expected a Markdown source path inside this repository');
    filter = location.path;
    if (
      !history &&
      filter.split('/').some((part) => part.toLowerCase() === 'archive')
    )
      throw new Error('Historical paths require --history');
  }
  let inventory;
  try {
    inventory = execFileSync(
      'git',
      ['ls-files', '-z', '-co', '--exclude-standard'],
      {
        cwd: realRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  } catch (error) {
    if (
      !['EPERM', 'EACCES', 'ENOENT'].includes(error.code) ||
      path === undefined
    )
      throw error;
    if (!filter)
      throw new Error(
        'Git is unavailable; filesystem fallback requires a narrower --path than the repository root',
      );
    const files = [];
    const visit = (absolute) => {
      const name = relative(realRoot, absolute).replaceAll('\\', '/');
      const leaf = name.split('/').at(-1).toLowerCase();
      if (excludedParts.has(leaf) || (!history && leaf === 'archive')) return;
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink())
        throw new Error('Linked source paths are not supported: ' + name);
      if (stat.isDirectory()) {
        if (existsSync(resolve(absolute, '.git')))
          throw new Error(
            'Nested repository source paths are not supported: ' + name,
          );
        for (const entry of readdirSync(absolute).sort())
          visit(resolve(absolute, entry));
      } else if (stat.isFile() && /\.md$/i.test(name)) {
        sourcePath(realRoot, name);
        files.push(name);
      }
    };
    visit(resolve(realRoot, filter));
    onFallback?.({
      enumeration: 'filesystem-path-fallback',
      reason: error.code,
      notice:
        'Git ignore rules were not applied; search is confined to the explicit source path with fixed generated/history exclusions',
    });
    return files;
  }
  const documents = inventory.split('\0').filter((file) => {
    if (!/\.md$/i.test(file) || !existsSync(resolve(realRoot, file)))
      return false;
    const parts = file.replaceAll('\\', '/').split('/');
    return (
      !parts.some((part) => excludedParts.has(part.toLowerCase())) &&
      (history || !parts.some((part) => part.toLowerCase() === 'archive')) &&
      (!filter || file === filter || file.startsWith(filter + '/'))
    );
  });
  return [...new Set(documents)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function markdownLinks(source) {
  const { visible } = markdownLines(source);
  const references = new Map();
  const labelKey = (label) => label.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const line of visible) {
    const definition = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/.exec(line);
    if (definition)
      references.set(labelKey(definition[1]), definition[2] ?? definition[3]);
  }
  const links = [];
  for (const [index, raw] of visible.entries()) {
    const line = raw.replace(/(`+)(.*?)\1/g, '');
    if (/^ {0,3}\[[^\]]+\]:/.test(line)) continue;
    const matches = line.matchAll(
      /(?<!\\)!?\[([^\]\n]*)\](?:\((<[^>]*>|(?:\\.|[^\s)])+)(?:\s+"[^"]*")?\)|\[([^\]]*)\])?/g,
    );
    for (const match of matches) {
      const href =
        match[2] === undefined
          ? references.get(labelKey(match[3] || match[1]))
          : match[2].replace(/^<|>$/g, '');
      if (href !== undefined)
        links.push({
          href: href.replace(/\\([()[\]<> ])/g, '$1'),
          line: index + 1,
        });
    }
  }
  return links;
}

export function explicitMarkdownAnchors(source) {
  const { visible } = markdownLines(source);
  const text = visible
    .map((line) => line.replace(/(`+)(.*?)\1/g, ''))
    .join('\n');
  const anchors = new Set();
  for (const tag of text.matchAll(/<a\b([^>]*)>/gi)) {
    for (const attribute of tag[1].matchAll(
      /(?:^|\s)(?:id|name)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'"=<>`]+))/gi,
    ))
      anchors.add(attribute[1] ?? attribute[2] ?? attribute[3]);
  }
  return anchors;
}
