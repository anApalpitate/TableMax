import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import test from 'node:test';
import {
  auditDocumentLinks,
  auditMigration,
} from './audit-efficiency-docs.mjs';

test('migration audit detects a missing obligation despite formatting changes', (t) => {
  const root = mkdtempSync(resolve('tmp/efficiency-doc-audit-'));
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
  const root = mkdtempSync(resolve('tmp/efficiency-doc-links-'));
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
