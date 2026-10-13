import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import test from 'node:test';
import { documentHeadings, readDocument } from './read-doc.mjs';

function fixture(t, content) {
  const root = mkdtempSync(resolve('tmp/efficiency-doc-reader-'));
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
  assert.throws(() => readDocument({ ...input, cursor: '0:0' }), /outside/);
  assert.throws(() => readDocument({ ...input, cursor: '1:999' }), /outside/);
  assert.throws(() =>
    readDocument({ root: input.root, file: '../../package.json' }),
  );
});
