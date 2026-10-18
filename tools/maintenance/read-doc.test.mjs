import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  symlinkSync,
  readFileSync,
} from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { documentHeadings, readDocument } from './read-doc.mjs';

function fixture(t, content) {
  const root = mkdtempSync(resolve('tmp/efficiency-doc-reader-'));
  assert.ok(root.startsWith(resolve('tmp') + sep));
  writeFileSync(join(root, 'example.md'), content);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, file: 'example.md' };
}

test('headings ignore fenced examples and preserve real source line numbers', () => {
  assert.deepEqual(
    documentHeadings('# Root\n```md\n## Fake\n```\n## Real\n').headings,
    [
      { level: 1, title: 'Root', line: 1 },
      { level: 2, title: 'Real', line: 5 },
    ],
  );
});

test('heading parsing ignores comments without treating comments inside code as markup', () => {
  const source =
    '# Root\n<!--\n## Hidden\n-->\n## Visible `<!--`\n```html <!-- literal\n## Code\n```\n## Last';
  assert.deepEqual(
    documentHeadings(source).headings.map(({ title, line }) => ({
      title,
      line,
    })),
    [
      { title: 'Root', line: 1 },
      { title: 'Visible `<!--`', line: 5 },
      { title: 'Last', line: 9 },
    ],
  );
});

test('a section includes nested headings and stops before its sibling', (t) => {
  const input = fixture(t, '# Root\n## Selected\na\n### Child\nb\n## Other\nc');
  const result = readDocument({ ...input, heading: 'Selected' });
  assert.deepEqual(result.range, { start: 2, end: 5 });
  assert.match(result.text, /4: ### Child/);
  assert.doesNotMatch(result.text, /Other/);
  const outline = readDocument({
    ...input,
    heading: 'Selected',
    outline: true,
  });
  assert.match(outline.text, /Child/);
  assert.doesNotMatch(outline.text, /Other/);
});

test('duplicate headings reject instead of silently choosing one', (t) => {
  const input = fixture(t, '# Root\n## Same\na\n## Same\nb');
  assert.throws(
    () => readDocument({ ...input, heading: 'Same' }),
    /exactly one/,
  );
});

test('byte budgeting resumes long Unicode lines without losing characters', (t) => {
  const content = '中😀'.repeat(1400);
  const input = fixture(t, '# Root\n' + content);
  let cursor;
  let reconstructed = '';
  let rounds = 0;
  do {
    const result = readDocument({ ...input, cursor, maxBytes: 512 });
    assert.ok(Buffer.byteLength(result.text) <= 512);
    for (const line of result.text.split('\n')) {
      const match = /^2\+?: (.*)$/.exec(line);
      if (match) reconstructed += match[1];
    }
    assert.notEqual(result.nextCursor, cursor || '1:0');
    cursor = result.nextCursor;
    assert.ok(++rounds < 100);
  } while (cursor);
  assert.equal(reconstructed, content);
});

test('outlines paginate; outside paths and invalid cursors fail', (t) => {
  const input = fixture(
    t,
    Array.from({ length: 100 }, (_, i) => `## Title ${i}`).join('\n'),
  );
  const first = readDocument({ ...input, outline: true, maxBytes: 512 });
  assert.ok(first.nextCursor);
  assert.ok(Buffer.byteLength(first.text) <= 512);
  assert.throws(() => readDocument({ ...input, cursor: '0:0' }), /Legacy/);
  assert.throws(() => readDocument({ ...input, cursor: '1:999' }), /Legacy/);
  assert.throws(() =>
    readDocument({ root: input.root, file: '../../package.json' }),
  );
});

test('heading-line disambiguates exact titles and verifies the search SHA', (t) => {
  const input = fixture(t, '# Root\n## Same\nfirst\n## Same\nsecond');
  const result = readDocument({ ...input, headingLine: 4 });
  assert.deepEqual(result.range, { start: 4, end: 5 });
  assert.match(result.text, /second/);
  assert.doesNotMatch(result.text, /first/);
  assert.equal(
    readDocument({
      ...input,
      headingLine: 4,
      expectSha256: result.sha256.toUpperCase(),
    }).sha256,
    result.sha256,
  );
  assert.throws(
    () => readDocument({ ...input, headingLine: 3 }),
    /start of a Markdown heading/,
  );
  assert.throws(
    () => readDocument({ ...input, headingLine: 4, heading: 'Same' }),
    /either/,
  );
  assert.throws(
    () => readDocument({ ...input, expectSha256: 'short' }),
    /full SHA256/,
  );
  assert.throws(
    () => readDocument({ ...input, expectSha256: '0'.repeat(64) }),
    /SHA256 changed/,
  );
});

test('continuation binds file, selected section and output mode', (t) => {
  const content =
    '# Root\n## Selected\n' + '中😀'.repeat(1000) + '\n## Other\nlast';
  const input = fixture(t, content);
  const first = readDocument({ ...input, heading: 'Selected', maxBytes: 512 });
  assert.match(first.nextCursor, /^v1\./);
  const next = readDocument({
    ...input,
    cursor: first.nextCursor,
    maxBytes: 512,
  });
  assert.deepEqual(next.range, first.range);
  assert.throws(
    () =>
      readDocument({ ...input, cursor: first.nextCursor, heading: 'Other' }),
    /section conflicts/,
  );
  assert.throws(
    () => readDocument({ ...input, cursor: first.nextCursor, outline: true }),
    /mode conflicts/,
  );
  writeFileSync(join(input.root, 'copy.md'), content);
  assert.throws(
    () => readDocument({ ...input, file: 'copy.md', cursor: first.nextCursor }),
    /file or SHA256 changed/,
  );
});

for (const change of ['insert', 'delete', 'move', 'line-endings']) {
  test('a stale cursor rejects after ' + change, (t) => {
    const source =
      '# Root\n## Selected\n' + '长行'.repeat(1000) + '\n## Other\nlast';
    const input = fixture(t, source);
    const first = readDocument({
      ...input,
      heading: 'Selected',
      maxBytes: 512,
    });
    const changed =
      change === 'insert'
        ? 'new preamble\n' + source
        : change === 'delete'
          ? source.replace('长行', '')
          : change === 'move'
            ? source.replace('## Selected', '### Selected')
            : source.replaceAll('\n', '\r\n');
    writeFileSync(join(input.root, input.file), changed);
    assert.throws(
      () => readDocument({ ...input, cursor: first.nextCursor }),
      /SHA256 changed/,
    );
    assert.throws(
      () => readDocument({ ...input, expectSha256: first.sha256 }),
      /SHA256 changed/,
    );
  });
}

test('outline continuation restores its own mode and preserves every heading', (t) => {
  const source = Array.from(
    { length: 40 },
    (_, i) => '## 标题' + i + '中'.repeat(30),
  ).join('\n');
  const input = fixture(t, source);
  const fragments = new Map();
  let cursor;
  let rounds = 0;
  do {
    const result = readDocument({
      ...input,
      ...(cursor ? { cursor } : { outline: true }),
      maxBytes: 512,
    });
    assert.ok(Buffer.byteLength(result.text) <= 512);
    for (const line of result.text.split('\n')) {
      const match = /^(\d+)\+?: (.*)$/.exec(line);
      if (match)
        fragments.set(
          Number(match[1]),
          (fragments.get(Number(match[1])) ?? '') + match[2],
        );
    }
    if (result.nextCursor) assert.notEqual(result.nextCursor, cursor);
    cursor = result.nextCursor;
    assert.ok(++rounds < 200);
  } while (cursor);
  assert.equal([...fragments.values()].join('\n'), source);
});

test('tampered cursor positions and unknown versions cannot select arbitrary source', (t) => {
  const input = fixture(t, '# Root\n' + 'long '.repeat(300));
  const first = readDocument({ ...input, maxBytes: 512 });
  const payload = JSON.parse(
    Buffer.from(first.nextCursor.slice(3), 'base64url').toString(),
  );
  const encode = (value) =>
    'v1.' + Buffer.from(JSON.stringify(value)).toString('base64url');
  assert.throws(
    () => readDocument({ ...input, cursor: encode({ ...payload, l: 0 }) }),
    /outside/,
  );
  assert.throws(
    () => readDocument({ ...input, cursor: encode({ ...payload, c: -1 }) }),
    /outside/,
  );
  assert.throws(
    () => readDocument({ ...input, cursor: encode({ ...payload, s: [2, 2] }) }),
    /selection/,
  );
  assert.throws(() => readDocument({ ...input, cursor: 'v2.unknown' }), /v1/);
  assert.throws(() => readDocument({ ...input, cursor: 'v1.ab' }), /Invalid/);
});

test('linked source directories and generated paths are rejected', (t) => {
  const input = fixture(t, '# Root');
  mkdirSync(join(input.root, 'source'));
  writeFileSync(join(input.root, 'source', 'linked.md'), '# Linked');
  symlinkSync(
    join(input.root, 'source'),
    join(input.root, 'link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(
    () => readDocument({ ...input, file: 'link/linked.md' }),
    /Linked/,
  );
  rmSync(join(input.root, 'link'), { recursive: true, force: true });
  assert.equal(
    readFileSync(join(input.root, 'source', 'linked.md'), 'utf8'),
    '# Linked',
  );
  mkdirSync(join(input.root, 'artifacts'));
  writeFileSync(join(input.root, 'artifacts', 'generated.md'), '# Generated');
  assert.throws(
    () => readDocument({ ...input, file: 'artifacts/generated.md' }),
    /source path/,
  );
});

test('long path metadata fails explicitly instead of exceeding a small byte budget', (t) => {
  const input = fixture(t, '# Root');
  const file = '长'.repeat(55) + '.md';
  writeFileSync(join(input.root, file), '# Root\n' + '内容'.repeat(600));
  assert.throws(
    () => readDocument({ ...input, file, maxBytes: 512 }),
    /increase the byte budget/,
  );
});

test('CLI ambiguity diagnostics share the requested byte budget', (t) => {
  const input = fixture(
    t,
    '# Root\n' +
      Array.from({ length: 80 }, () => '## 同名' + '长'.repeat(20)).join('\n'),
  );
  const result = spawnSync(
    process.execPath,
    [
      resolve('tools/maintenance/read-doc.mjs'),
      input.file,
      '--heading=missing',
      '--max-bytes=512',
    ],
    { cwd: input.root, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.ok(Buffer.byteLength(result.stderr) <= 512);
  assert.match(result.stderr, /TRUNCATED/);
  assert.match(result.stderr, /heading-line/);
  assert.equal(result.stdout, '');
});

test('CLI option parsing errors also obey the requested byte budget', (t) => {
  const input = fixture(t, '# Root');
  const result = spawnSync(
    process.execPath,
    [
      resolve('tools/maintenance/read-doc.mjs'),
      input.file,
      '--max-bytes=512',
      '--unknown=' + '中'.repeat(1000),
    ],
    { cwd: input.root, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.ok(Buffer.byteLength(result.stderr) <= 512);
  assert.match(result.stderr, /Unknown option/);
  assert.match(result.stderr, /TRUNCATED/);
});
