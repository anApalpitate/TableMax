import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { resolve, join, dirname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  auditDocumentLinks,
  auditMigration,
  auditEfficiencyDocs,
} from './audit-efficiency-docs.mjs';
import { sourceSha256 } from './markdown-source.mjs';
import { auditTaskDelivery } from './task-delivery.mjs';

const taskTemporary = resolve(
  process.env.TABLEMAX_TASK_TMP ?? `tmp/documentation-audit-${process.pid}`,
);
assert.ok(taskTemporary.startsWith(resolve('tmp') + sep));
mkdirSync(taskTemporary, { recursive: true });

function deliveryFixture() {
  const root = mkdtempSync(join(taskTemporary, 'delivery-'));
  const id = 'review-example';
  const base = 'tmp/' + id;
  const control = 'artifacts/maintenance/' + id;
  const write = (path, source) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };
  const files = {
    [base + '/index.html']:
      '<link href="style.css" rel="stylesheet"><img src="after.png">',
    [base + '/style.css']: 'body { background: url(texture.png) }',
    [base + '/after.png']: 'fixture image, not real rendering evidence',
    [base + '/texture.png']: 'fixture texture',
  };
  for (const [path, source] of Object.entries(files)) write(path, source);
  write(control + '/cleanup.cmd', 'powershell -File cleanup.ps1');
  write(
    control + '/cleanup.ps1',
    '& scripts/Clean-Intermediates.ps1 -TemporaryManifest manifest.json',
  );
  const plan = {
    version: 1,
    id,
    authorization: 'retire-reviewed-tmp-once',
    taskRoot: base,
    controlFiles: ['cleanup.cmd', 'cleanup.ps1'].map((name) => ({
      name,
      sha256: sourceSha256(readFileSync(join(root, control, name))),
    })),
    entries: [
      {
        name: id,
        reason: 'Unit test fixture only',
        files: Object.entries(files).map(([path, source]) => ({
          path,
          bytes: Buffer.byteLength(source),
          sha256: sourceSha256(source),
        })),
      },
    ],
  };
  const manifest = control + '/cleanup-manifest.json';
  write(manifest, JSON.stringify(plan));
  const delivery = {
    version: 1,
    taskId: id,
    type: 'visual-change',
    temporary: {
      root: base,
      cleanup: {
        launcher: control + '/cleanup.cmd',
        script: control + '/cleanup.ps1',
        manifest,
        manifestSha256: sourceSha256(readFileSync(join(root, manifest))),
      },
    },
    preview: {
      html: base + '/index.html',
      before: 'Unavailable: fixture has no before image',
      limitations:
        'Synthetic unit test; does not prove image content or provenance',
      renderings: [
        {
          path: base + '/after.png',
          kind: 'design-illustration',
          role: 'player',
          viewport: '390x844',
        },
      ],
    },
  };
  return { root, base, control, delivery, write };
}

function fixture(t, files = {}) {
  const root = mkdtempSync(join(taskTemporary, 'incremental-'));
  assert.ok(root.startsWith(resolve('tmp') + sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  for (const [file, source] of Object.entries({
    'AGENTS.md': '# Entry',
    ...files,
  })) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), source);
  }
  return { root };
}

function manifest(root, files) {
  const changes = {
    version: 1,
    files: files.map((path) => ({
      path,
      sha256: existsSync(join(root, path))
        ? sourceSha256(readFileSync(join(root, path)))
        : null,
    })),
  };
  writeFileSync(join(root, 'owned.json'), JSON.stringify(changes));
  return changes;
}

function audit(root, args = []) {
  let stdout = '',
    stderr = '';
  const report = auditEfficiencyDocs(args, {
    root,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { report, stdout, stderr };
}

test('migration audit detects a missing obligation despite formatting changes', (t) => {
  const root = mkdtempSync(join(taskTemporary, 'migration-'));
  assert.ok(root.startsWith(resolve('tmp') + sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, 'target.md'),
    '# Target\n\n- Must preserve\n  identity.\n',
  );
  const migration = {
    rules: [{ destination: 'target.md', expected: 'Mustpreserveidentity.' }],
    sections: [],
  };
  assert.equal(auditMigration(root, migration).failures.length, 0);
  migration.rules.push({
    destination: 'target.md',
    expected: 'Mustpreservesecrets.',
  });
  assert.equal(auditMigration(root, migration).failures.length, 1);
});

test('real heading slugs, duplicate suffixes and incoming broken anchors are audited', (t) => {
  const root = mkdtempSync(join(taskTemporary, 'links-'));
  assert.ok(root.startsWith(resolve('tmp') + sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, 'target.md'),
    '# Root\n## 同标题\n## 同标题\n```md\n## Fake\n```\n',
  );
  writeFileSync(
    join(root, 'source.md'),
    '[valid](target.md#同标题-1)\n[bad](target.md#fake)\n[missing](none.md)',
  );
  const result = auditDocumentLinks(root, ['source.md']);
  assert.equal(result.checked, 3);
  assert.deepEqual(
    result.failures.map((item) => item.reason),
    ['missing heading', 'missing target'],
  );
});

test('migration ignores only table separator widths while preserving cells, exceptions and alignment', (t) => {
  const input = fixture(t);
  const original =
    '# Contract\n| Name | Limit |\n| :--- | ---: |\n| Token | Keep exception |\n';
  const expected = original.replace(/\s+/g, '');
  const migration = {
    rules: [{ destination: 'target.md', expected }],
    sections: [],
  };
  const formatted = original
    .replace(':---', ':----------------')
    .replace('---:', '--------------------------------:');
  writeFileSync(join(input.root, 'target.md'), formatted);
  assert.equal(auditMigration(input.root, migration).failures.length, 0);
  for (const changed of [
    formatted.replace('Token', ''),
    formatted.replace('Keep exception', 'Keep'),
    formatted.replace(':----------------', '----------------'),
    formatted.replace(
      '| :---------------- | --------------------------------: |',
      '| :---------------- |',
    ),
  ]) {
    writeFileSync(join(input.root, 'target.md'), changed);
    assert.equal(auditMigration(input.root, migration).failures.length, 1);
  }
});

test('migration table normalization preserves literal hyphens inside inline and fenced code', (t) => {
  const input = fixture(t);
  for (const delimiters of [
    ['`', '`'],
    ['```text\n', '\n```'],
    ['~~~~text\n', '\n~~~~'],
  ]) {
    const original =
      '# Contract\n' + delimiters[0] + '||------|------||' + delimiters[1];
    const migration = {
      rules: [
        { destination: 'target.md', expected: original.replace(/\s+/g, '') },
      ],
      sections: [],
    };
    writeFileSync(
      join(input.root, 'target.md'),
      original.replace('------', '---'),
    );
    assert.equal(auditMigration(input.root, migration).failures.length, 1);
  }
});

test('static a id/name anchors work while fenced, commented and data attributes do not', (t) => {
  const input = fixture(t, {
    'target.md':
      '# Target\n<a id="旧锚点"></a>\n<A class="legacy" NAME=old-name></A>\n<a data-id="not-an-id"></a>\n<!-- <a id="commented"></a> -->\n`<a id="inline-code"></a>`\n~~~~html\n<a id="fenced"></a>\n```\n~~~~',
    'source.md':
      '[id](target.md#%E6%97%A7%E9%94%9A%E7%82%B9)\n[name](target.md#old-name)\n[data](target.md#not-an-id)\n[comment](target.md#commented)\n[inline](target.md#inline-code)\n[code](target.md#fenced)',
  });
  const result = auditDocumentLinks(input.root, ['source.md']);
  assert.equal(result.checked, 6);
  assert.deepEqual(
    result.failures.map((item) => item.href),
    [
      'target.md#not-an-id',
      'target.md#commented',
      'target.md#inline-code',
      'target.md#fenced',
    ],
  );
});

test('link parsing preserves source conventions and detects malformed anchor encodings', (t) => {
  const input = fixture(t, {
    '目录/space 名.md': '# 标题',
    'source.md':
      '[space](<目录/space 名.md#标题>)\n[reference][ok]\n[ok]: %E7%9B%AE%E5%BD%95/space%20%E5%90%8D.md#%E6%A0%87%E9%A2%98\n[bad](目录/space%20名.md#%zz)\n`[fake](none.md)`\n````md\n[also fake](none.md)\n```\n````',
  });
  const result = auditDocumentLinks(input.root, ['source.md']);
  assert.equal(result.checked, 2);
  assert.deepEqual(result.failures, [
    {
      file: 'source.md',
      href: '目录/space%20名.md#%zz',
      reason: 'invalid URL encoding',
    },
  ]);
});

test('explicit relative links outside the repository still verify actual Markdown anchors', (t) => {
  const input = fixture(t, {
    'source.md': '[valid](../outside.md#真实)\n[bad](../outside.md#缺失)',
  });
  const outside = join(input.root, 'outside-project');
  mkdirSync(outside);
  writeFileSync(join(input.root, 'outside.md'), '# 真实');
  writeFileSync(
    join(outside, 'source.md'),
    '[valid](../outside.md#真实)\n[bad](../outside.md#缺失)',
  );
  const result = auditDocumentLinks(outside, ['source.md']);
  assert.equal(result.checked, 2);
  assert.deepEqual(result.failures, [
    {
      file: 'source.md',
      href: '../outside.md#缺失',
      reason: 'missing heading',
    },
  ]);
});

test('incremental audit covers changed outlinks and all relevant incoming links only', (t) => {
  const input = fixture(t, {
    'docs/target.md': '# New heading\n[missing](own-missing.md)',
    'docs/incoming.md':
      '[stale](target.md#old-heading)\n[old unrelated](elsewhere-missing.md)',
    'docs/unrelated.md': '[existing](unrelated-missing.md)',
  });
  manifest(input.root, ['docs/target.md']);
  const result = audit(input.root, ['--changes=owned.json']);
  assert.equal(result.report.mode, 'changes-and-incoming');
  assert.equal(result.report.scannedDocuments, 4);
  assert.deepEqual(result.report.selectedDocuments, [
    'docs/incoming.md',
    'docs/target.md',
  ]);
  assert.equal(result.report.checked, 2);
  assert.equal(result.report.newFailures.length, 2);
  assert.deepEqual(
    result.report.newFailures.map((item) => item.href),
    ['target.md#old-heading', 'own-missing.md'],
  );
  assert.equal(result.report.failed, true);
  assert.equal(existsSync(join(input.root, 'report.json')), false);
});

test('deleted targets and changed non-Markdown targets retain incoming coverage', (t) => {
  const input = fixture(t, {
    'docs/deleted.md': '# Old',
    'docs/source.md': '[old](deleted.md#old)\n[tool](../tool.mjs)',
    'tool.mjs': 'export const value = 1;',
  });
  execFileSync('git', ['add', '--', 'docs/deleted.md'], { cwd: input.root });
  rmSync(join(input.root, 'docs/deleted.md'));
  manifest(input.root, ['docs/deleted.md', 'tool.mjs']);
  const result = audit(input.root, ['--changes=owned.json']);
  assert.equal(result.report.checked, 2);
  assert.deepEqual(result.report.newFailures, [
    {
      file: 'docs/source.md',
      href: 'deleted.md#old',
      reason: 'missing target',
    },
  ]);
});

test('stale manifests and escaped report/migration paths are rejected before writing', (t) => {
  const input = fixture(t, { 'docs/source.md': '# Old' });
  manifest(input.root, ['docs/source.md']);
  writeFileSync(join(input.root, 'docs/source.md'), '# Changed');
  assert.throws(
    () => audit(input.root, ['--changes=owned.json']),
    /manifest is stale/,
  );
  assert.throws(
    () => audit(input.root, ['--report=../outside.json']),
    /escapes workspace/,
  );
  assert.throws(
    () =>
      auditMigration(input.root, {
        rules: [{ destination: '../outside.md', expected: 'x' }],
        sections: [],
      }),
    /escapes workspace/,
  );
});

test('baseline identities stay compatible and warnings never replace new failures', (t) => {
  const input = fixture(t, {
    'docs/README.md':
      '# Entry\n[history](archive/old.md)\n[known](none.md)\n## Same\na\n## Same\nb',
    'docs/archive/old.md': '# Old',
  });
  writeFileSync(
    join(input.root, 'baseline.json'),
    JSON.stringify({
      failures: [
        {
          file: 'docs/README.md',
          href: 'none.md',
          reason: 'missing target',
          previousLocation: 3,
        },
      ],
    }),
  );
  manifest(input.root, ['docs/README.md']);
  const result = audit(input.root, [
    '--changes=owned.json',
    '--baseline=baseline.json',
    '--report=report.json',
  ]);
  assert.equal(result.report.newFailures.length, 0);
  assert.equal(result.report.failures.length, 1);
  assert.equal(result.report.failed, false);
  assert.deepEqual(
    result.report.warnings.map((item) => item.reason),
    ['history-entry-review', 'duplicate-heading'],
  );
  assert.equal(
    JSON.parse(readFileSync(join(input.root, 'report.json'), 'utf8')).warnings
      .length,
    2,
  );
  assert.equal(
    JSON.parse(readFileSync(join(input.root, 'baseline.json'), 'utf8'))
      .failures[0].previousLocation,
    3,
  );
});

test('full and baseline-only remain available, and AGENTS cap still gates audits', (t) => {
  const input = fixture(t, { 'docs/source.md': '[missing](none.md)' });
  const full = audit(input.root);
  assert.equal(full.report.mode, 'full');
  assert.equal(full.report.newFailures.length, 1);
  assert.equal(full.report.failed, true);
  const baselineOnly = audit(input.root, ['--baseline-only']);
  assert.equal(baselineOnly.report.newFailures.length, 1);
  assert.equal(baselineOnly.report.failed, false);
  assert.equal(baselineOnly.stderr, '');
  writeFileSync(join(input.root, 'AGENTS.md'), '中'.repeat(3000));
  assert.equal(audit(input.root).report.failed, true);
  assert.match(audit(input.root).stderr, /AGENTS.md exceeds/);
});

test('long sections are review warnings and terminal details preserve strict byte caps', (t) => {
  const missing = Array.from(
    { length: 40 },
    (_, i) => `[bad${i}](${'长'.repeat(150)}-${i}.md)`,
  ).join('\n');
  const input = fixture(t, {
    'docs/source.md': '# Huge\n' + missing + '\n' + '文'.repeat(6000),
  });
  const result = audit(input.root, ['--report=report.json']);
  assert.equal(result.report.newFailures.length, 40);
  assert.ok(
    result.report.warnings.some((item) => item.reason === 'long-section'),
  );
  assert.ok(Buffer.byteLength(result.stdout) <= 2048);
  assert.ok(Buffer.byteLength(result.stderr) <= 8192);
  assert.match(result.stderr, /TRUNCATED/);
  assert.equal(
    JSON.parse(readFileSync(join(input.root, 'report.json'), 'utf8')).failures
      .length,
    40,
  );
});

test('task delivery: static offline HTML, CSS dependencies and frozen inventory pass', () => {
  const input = deliveryFixture();
  const result = auditTaskDelivery(input.root, input.delivery);
  assert.equal(result.failed, false, JSON.stringify(result));
  assert.ok(result.checkedFiles >= 7);
  assert.match(result.limits, /no rendering/);
});

test('task delivery: nonvisual work has an explicit no-temporary-files reason', () => {
  const root = mkdtempSync(join(taskTemporary, 'no-files-'));
  const delivery = {
    version: 1,
    taskId: 'plain-docs',
    type: 'change',
    temporary: { none: 'No temporary outputs' },
  };
  assert.equal(auditTaskDelivery(root, delivery).failed, false);
  mkdirSync(join(root, 'tmp/plain-docs'), { recursive: true });
  assert.equal(auditTaskDelivery(root, delivery).failed, true);
});

test('task delivery: missing preview and unlabelled renderings fail', () => {
  const input = deliveryFixture();
  const missing = structuredClone(input.delivery);
  delete missing.preview;
  assert.equal(auditTaskDelivery(input.root, missing).failed, true);
  input.delivery.preview.renderings[0].kind = 'unknown';
  assert.equal(auditTaskDelivery(input.root, input.delivery).failed, true);
});

test('task delivery: remote CSS and missing dependencies fail', () => {
  const input = deliveryFixture();
  input.write(
    input.base + '/style.css',
    '@import "https://example.com/remote.css";',
  );
  let result = auditTaskDelivery(input.root, input.delivery);
  assert.ok(
    result.failures.some((item) =>
      item.reason.includes('Remote preview dependency'),
    ),
  );
  input.write(input.base + '/style.css', 'body {background:url(missing.png)}');
  result = auditTaskDelivery(input.root, input.delivery);
  assert.equal(result.failed, true);
});

test('task delivery: remote media and path escapes fail', () => {
  for (const value of [
    'https://example.com/a.png',
    '//example.com/a.png',
    '../../../escape.png',
  ]) {
    const input = deliveryFixture();
    input.write(input.base + '/index.html', '<img src="' + value + '">');
    assert.equal(auditTaskDelivery(input.root, input.delivery).failed, true);
  }
});

test('task delivery: new members and changed controls invalidate cleanup', () => {
  const input = deliveryFixture();
  input.write(input.base + '/unlisted.txt', 'unlisted');
  assert.ok(
    auditTaskDelivery(input.root, input.delivery).failures.some(
      (item) => item.reason === 'Unlisted temporary member',
    ),
  );
  const second = deliveryFixture();
  second.write(second.control + '/cleanup.ps1', 'changed');
  assert.ok(
    auditTaskDelivery(second.root, second.delivery).failures.some((item) =>
      item.reason.includes('Cleanup control hash changed'),
    ),
  );
});

test('task delivery: foreign task controls and stale manifest hash fail', () => {
  const input = deliveryFixture();
  input.delivery.temporary.cleanup.launcher =
    'artifacts/maintenance/other/cleanup.cmd';
  assert.equal(auditTaskDelivery(input.root, input.delivery).failed, true);
  const second = deliveryFixture();
  second.delivery.temporary.cleanup.manifestSha256 = '0'.repeat(64);
  assert.equal(auditTaskDelivery(second.root, second.delivery).failed, true);
});

test('task delivery: CLI is read-only unless a report is explicitly requested', () => {
  const input = deliveryFixture();
  input.write('delivery.json', JSON.stringify(input.delivery));
  let output = '';
  const report = auditEfficiencyDocs(['--delivery=delivery.json'], {
    root: input.root,
    stdout: (text) => {
      output += text;
    },
  });
  assert.equal(report.failed, false);
  assert.equal(JSON.parse(output).failed, false);
  assert.equal(existsSync(join(input.root, 'report.json')), false);
  assert.throws(
    () =>
      auditEfficiencyDocs(['--delivery=delivery.json', '--baseline-only'], {
        root: input.root,
      }),
    /independently/,
  );
});
