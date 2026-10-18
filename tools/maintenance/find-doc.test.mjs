import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { findDocuments } from './find-doc.mjs';
import { readDocument } from './read-doc.mjs';

function fixture(t, files) {
  const root = mkdtempSync(resolve('tmp/efficiency-doc-finder-'));
  assert.ok(root.startsWith(resolve('tmp') + sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), source);
  }
  return { root };
}

function withoutGit(run) {
  const key =
    Object.keys(process.env).find((name) => name.toUpperCase() === 'PATH') ??
    'PATH';
  const previous = process.env[key];
  process.env[key] = '';
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

test('exact titles, title substrings and Chinese body matches rank in that order', (t) => {
  const input = fixture(t, {
    'docs/z.md': '# 平台\n## 换机授权\n当前实现：撤销旧凭证。',
    'docs/a.md': '# 换机授权的例外\n约束。',
    'docs/b.md': '# 身份\n换机授权必须先保存。',
  });
  const result = findDocuments({ ...input, query: '换机授权' });
  assert.deepEqual(
    result.results.map((item) => item.match),
    ['heading-exact', 'heading-contains', 'body'],
  );
  assert.deepEqual(
    result.results.map((item) => item.path),
    ['docs/z.md', 'docs/a.md', 'docs/b.md'],
  );
  assert.deepEqual(result.results[0].headingPath, ['平台', '换机授权']);
  assert.equal(result.results[0].line, 2);
  assert.equal(result.totalMatches, 3);
  assert.match(result.text, /sha256=[a-f0-9]{64}/);
});

test('same-titled sections remain separately addressable using bound read parameters', (t) => {
  const input = fixture(t, {
    'docs/example.md': '# Root\n## 同名\nfirst\n## 同名\nsecond',
  });
  const result = findDocuments({ ...input, query: '同名' });
  assert.equal(result.results.length, 2);
  assert.deepEqual(
    result.results.map((item) => item.line),
    [2, 4],
  );
  for (const item of result.results) {
    const section = readDocument({
      root: input.root,
      file: item.path,
      headingLine: item.line,
      expectSha256: item.sha256,
    });
    assert.equal(section.range.start, item.line);
  }
  writeFileSync(join(input.root, 'docs/example.md'), '# Changed\n## 同名\nnew');
  const previous = result.results[0];
  assert.throws(
    () =>
      readDocument({
        root: input.root,
        file: previous.path,
        headingLine: previous.line,
        expectSha256: previous.sha256,
      }),
    /SHA256 changed/,
  );
});

test('default discovery excludes history and generated content without requiring YAML', (t) => {
  const input = fixture(t, {
    'docs/plain.md': '# 当前\n关键词',
    'docs/research.md':
      '---\ntype: research\nstatus: draft\n---\n# 研究\n关键词',
    'docs/archive/old.md': '# 关键词',
    'artifacts/generated.md': '# 关键词',
    'tmp/log.md': '# 关键词',
    '.cache/log.md': '# 关键词',
  });
  const current = findDocuments({ ...input, query: '关键词' });
  assert.equal(current.documents, 2);
  assert.equal(current.totalMatches, 2);
  assert.equal(
    findDocuments({ ...input, query: '关键词', history: true }).totalMatches,
    3,
  );
  assert.throws(
    () => findDocuments({ ...input, query: '关键词', path: 'docs/archive' }),
    /--history/,
  );
  const history = findDocuments({
    ...input,
    query: '关键词',
    path: 'docs/archive',
    history: true,
  });
  assert.equal(history.results[0].path, 'docs/archive/old.md');
});

test('path narrowing covers real files or directories, and no-match states the boundary', (t) => {
  const input = fixture(t, {
    'docs/platform/a.md': '# Topic',
    'docs/game/b.md': '# Topic',
  });
  assert.equal(
    findDocuments({ ...input, query: 'topic', path: 'docs/platform' })
      .totalMatches,
    1,
  );
  assert.equal(
    findDocuments({ ...input, query: 'ｔｏｐｉｃ', path: 'docs/platform/a.md' })
      .totalMatches,
    1,
  );
  const result = findDocuments({
    ...input,
    query: 'missing',
    path: 'docs/platform',
  });
  assert.equal(result.totalMatches, 0);
  assert.match(result.text, /NO MATCH: within the stated source boundary/);
  assert.match(result.text, /path=docs\/platform/);
  assert.throws(
    () => findDocuments({ ...input, query: 'topic', path: '../outside' }),
    /inside this repository/,
  );
  assert.throws(
    () => findDocuments({ ...input, query: 'topic', path: 'docs/missing' }),
    /ENOENT/,
  );
});

test('locator excerpts retain parent read locations and label mixed state as incomplete context', (t) => {
  const input = fixture(t, {
    'docs/platform.md':
      '# 平台\n仅管理员适用；例外见[权限](other.md#权限)。\n## 未来要求\n换机授权将增加确认。\n## 当前实现\n换机授权撤销旧凭证。\n### 保存例外\n先写盘再响应。',
    'docs/other.md': '# 权限',
  });
  const result = findDocuments({ ...input, query: '换机授权' });
  assert.equal(result.results.length, 2);
  const [future, current] = result.results;
  assert.deepEqual(future.headingPath, ['平台', '未来要求']);
  assert.deepEqual(current.headingPath, ['平台', '当前实现']);
  assert.equal(future.context.complete, false);
  assert.deepEqual(future.context.parents[0].leadRange, { start: 1, end: 2 });
  assert.ok(future.context.parents[0].readArgs.includes('--heading-line=1'));
  assert.equal(future.context.related[0].href, 'other.md#权限');
  assert.match(result.text, /PARENT READS/);
  assert.match(result.text, /RELATED SOURCE LINKS/);
  assert.match(result.text, /CONTEXT: partial/);
});

test('fenced examples never become headings and pre-heading prose is searchable', (t) => {
  const input = fixture(t, {
    'docs/example.md':
      '前言关键词\n# Real\n````md\n## Fake\n```\n<a id="fake"></a>\n````\n## Real child\ntext',
  });
  const preamble = findDocuments({ ...input, query: '前言关键词' });
  assert.equal(preamble.results[0].heading, '(document preamble)');
  assert.deepEqual(preamble.results[0].readArgs.slice(0, 1), [
    'docs/example.md',
  ]);
  const example = findDocuments({ ...input, query: 'Fake' });
  assert.equal(example.results[0].heading, 'Real');
  assert.equal(example.results[0].match, 'body');
});

test('limits and Unicode byte truncation explicitly retain incomplete-result notices', (t) => {
  const input = fixture(
    t,
    Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [
        'docs/' + i + '.md',
        '# 关键词' + i + '中'.repeat(100) + '\n关键词' + '😀'.repeat(150),
      ]),
    ),
  );
  const limited = findDocuments({ ...input, query: '关键词', limit: 2 });
  assert.equal(limited.totalMatches, 8);
  assert.equal(limited.omittedByLimit, 6);
  assert.match(limited.text, /omitted by limit 6/);
  const short = findDocuments({ ...input, query: '关键词', maxBytes: 512 });
  assert.ok(Buffer.byteLength(short.text) <= 512);
  assert.equal(short.truncated, true);
  assert.match(short.text, /TRUNCATED/);
  assert.match(short.text, /results are not complete/);
  assert.doesNotMatch(short.text, /\uFFFD/);
});

test('body excerpts keep the matching term even near the end of a long Unicode line', (t) => {
  const input = fixture(t, {
    'docs/long.md':
      '# Contract\n' + '😀'.repeat(500) + '换机授权' + '中'.repeat(500),
  });
  const result = findDocuments({ ...input, query: '换机授权' });
  assert.match(result.results[0].excerpt.text, /换机授权/);
  assert.ok(Buffer.byteLength(result.results[0].excerpt.text) <= 240);
  assert.equal(result.results[0].excerpt.truncated, true);
});

test('path links and invalid CLI choices fail explicitly', (t) => {
  const input = fixture(t, { 'docs/example.md': '# Topic' });
  symlinkSync(
    join(input.root, 'docs'),
    join(input.root, 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(
    () => findDocuments({ ...input, query: 'topic', path: 'linked' }),
    /Linked source/,
  );
  rmSync(join(input.root, 'linked'), { recursive: true, force: true });
  assert.equal(
    readFileSync(join(input.root, 'docs/example.md'), 'utf8'),
    '# Topic',
  );
  assert.throws(() => findDocuments({ ...input, query: ' ' }), /nonempty/);
  assert.throws(
    () => findDocuments({ ...input, query: 'topic', limit: 0 }),
    /limit/,
  );
  const result = spawnSync(
    process.execPath,
    [resolve('tools/maintenance/find-doc.mjs'), 'topic', '--scope=platform'],
    { cwd: input.root, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option: --scope/);
  assert.equal(result.stdout, '');
});

test('unavailable Git permits only explicit bounded source paths and reports the changed enumeration boundary', (t) => {
  const input = fixture(t, {
    '.gitignore': 'docs/ignored.md\n',
    'docs/plain.md': '# Topic',
    'docs/ignored.md': '# Topic ignored by Git',
    'docs/archive/old.md': '# Topic history',
    'docs/artifacts/generated.md': '# Topic generated',
    'elsewhere/other.md': '# Topic outside the requested source path',
  });
  assert.equal(
    findDocuments({ ...input, query: 'topic', path: 'docs' }).totalMatches,
    1,
  );
  withoutGit(() => {
    const result = findDocuments({ ...input, query: 'topic', path: 'docs' });
    assert.equal(result.enumeration, 'filesystem-path-fallback');
    assert.equal(result.totalMatches, 2);
    assert.ok(result.results.some((item) => item.path === 'docs/ignored.md'));
    assert.match(result.text, /Git ignore rules were not applied/);
    assert.match(result.text, /confined to the explicit source path/);
    const noMatch = findDocuments({
      ...input,
      query: 'missing',
      path: 'docs',
      maxBytes: 512,
    });
    assert.ok(Buffer.byteLength(noMatch.text) <= 512);
    assert.match(noMatch.text, /enumeration=filesystem-path-fallback/);
    assert.match(noMatch.text, /NO MATCH: within the stated source boundary/);
    assert.throws(
      () => findDocuments({ ...input, query: 'topic' }),
      /git.*ENOENT|ENOENT.*git/i,
    );
    assert.throws(
      () => findDocuments({ ...input, query: 'topic', path: '.' }),
      /narrower --path/,
    );
    assert.equal(
      findDocuments({ ...input, query: 'topic', path: 'docs/plain.md' })
        .totalMatches,
      1,
    );
    assert.equal(
      findDocuments({
        ...input,
        query: 'topic',
        path: 'docs/archive',
        history: true,
      }).totalMatches,
      1,
    );
  });
});

test('filesystem fallback rejects encountered nested repositories and links without following them', (t) => {
  const input = fixture(t, {
    'docs/plain.md': '# Topic',
    'docs/nested/.git': 'gitdir: local-marker',
    'docs/nested/inside.md': '# Topic nested',
    'source/target.md': '# Preserved',
  });
  withoutGit(() => {
    assert.throws(
      () => findDocuments({ ...input, query: 'topic', path: 'docs' }),
      /Nested repository/,
    );
  });
  rmSync(join(input.root, 'docs/nested/.git'));
  symlinkSync(
    join(input.root, 'source'),
    join(input.root, 'docs/linked'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  withoutGit(() => {
    assert.throws(
      () => findDocuments({ ...input, query: 'topic', path: 'docs' }),
      /Linked source/,
    );
  });
  rmSync(join(input.root, 'docs/linked'), { recursive: true, force: true });
  assert.equal(
    readFileSync(join(input.root, 'source/target.md'), 'utf8'),
    '# Preserved',
  );
});
