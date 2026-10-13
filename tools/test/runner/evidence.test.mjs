import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import {
  fingerprint,
  EvidenceIndex,
  fileRecord,
  localFile,
  atomicJson,
  createFingerprintStage,
} from './evidence.mjs';

function fixture(t) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/verification-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'check.mjs'), "import './subject.mjs';\n");
  writeFileSync(join(root, 'subject.mjs'), 'export const value = 1;\n');
  writeFileSync(join(root, 'resource.dat'), 'original resource');
  writeFileSync(join(root, 'result.json'), '{"result":"passed"}');
  const item = {
    runtime: 'node',
    script: 'check.mjs',
    args: [],
    inputs: { complete: true, files: ['resource.dat'] },
    combination: {
      game: 'uno',
      kind: 'fast-natural',
      seats: 2,
      seeds: [17, 319],
    },
  };
  return { root, item, index: new EvidenceIndex(root, 'evidence') };
}

test('one phase shares byte reads and environment queries; fresh phases rehash same-length changed inputs', (t) => {
  const { root, item } = fixture(t),
    stage = createFingerprintStage();
  const configured =
    process.platform === 'win32'
      ? { ...item, environmentProviders: ['powershell'] }
      : item;
  const first = fingerprint(root, configured, { stage });
  const second = fingerprint(root, configured, { stage });
  assert.equal(second.key, first.key);
  assert.equal(second.metrics.reads, 0);
  assert.equal(second.metrics.environmentQueries, 0);
  assert.ok(first.metrics.reads > 0);
  if (process.platform === 'win32')
    assert.equal(first.metrics.environmentQueries, 1);
  writeFileSync(join(root, 'subject.mjs'), 'export const value = 2;\n');
  const next = fingerprint(root, configured);
  assert.notEqual(next.key, first.key);
  assert.ok(next.metrics.reads > 0);
});
test('reuse binds transitive source, resources, parameters, combinations, environment and actual runtime bytes', (t) => {
  const { root, item, index } = fixture(t);
  const first = fingerprint(root, item);
  index.save(first, ['result.json']);
  assert.ok(index.find(first).proof);
  for (const changed of [
    { ...item, args: ['--entry-only'] },
    { ...item, combination: { ...item.combination, kind: 'fixed' } },
    { ...item, combination: { ...item.combination, seeds: [17, 320] } },
    { ...item, environment: { webview: 'different' } },
    { ...item, resultFile: 'required.json' },
    { ...item, evidence: ['extra-proof.json'] },
  ])
    assert.equal(index.find(fingerprint(root, changed)).proof, undefined);
  writeFileSync(join(root, 'subject.mjs'), 'export const value = 2;\n');
  assert.equal(index.find(fingerprint(root, item)).proof, undefined);
  writeFileSync(join(root, 'subject.mjs'), 'export const value = 1;\n');
  writeFileSync(join(root, 'resource.dat'), 'changed resource');
  assert.equal(index.find(fingerprint(root, item)).proof, undefined);
  writeFileSync(join(root, 'sealed.exe'), 'first executable');
  const native = { ...item, runtimeFiles: [join(root, 'sealed.exe')] };
  const nativeBinding = fingerprint(root, native);
  index.save(nativeBinding, ['result.json']);
  writeFileSync(join(root, 'sealed.exe'), 'other executable');
  assert.equal(index.find(fingerprint(root, native)).proof, undefined);
});
test('missing, failed, incomplete, corrupt and modified evidence are rejected without fallback scans', (t) => {
  const { root, item, index } = fixture(t),
    binding = fingerprint(root, item);
  assert.equal(index.find(binding).proof, undefined);
  const proof = index.save(binding, ['result.json']);
  const path = join(root, 'evidence', binding.key + '.json');
  for (const changed of [
    { ...proof, status: 'failed' },
    { ...proof, complete: false },
    { ...proof, artifacts: [] },
    { ...proof, binding: {} },
  ]) {
    writeFileSync(path, JSON.stringify(changed));
    assert.equal(index.find(binding).proof, undefined);
  }
  writeFileSync(path, 'broken');
  assert.equal(index.find(binding).proof, undefined);
  index.save(binding, ['result.json']);
  writeFileSync(join(root, 'result.json'), '{"result":"failed"}');
  assert.equal(index.find(binding).proof, undefined);
  rmSync(join(root, 'result.json'));
  assert.equal(index.find(binding).proof, undefined);
  assert.equal(
    index.find(
      fingerprint(root, {
        ...item,
        inputs: { ...item.inputs, complete: false },
      }),
    ).proof,
    undefined,
  );
});
test('legacy audit requires hash-bound original method/environment instead of invented current fields', (t) => {
  const { root, item, index } = fixture(t),
    binding = fingerprint(root, item);
  const audit = {
    format: 1,
    status: 'passed',
    complete: true,
    binding: binding.value,
    original: 'result.json',
    artifacts: [fileRecord(root, 'result.json')],
  };
  atomicJson(root, 'audit.json', audit);
  assert.throws(
    () => index.importAudited(binding, 'audit.json'),
    /Original evidence/,
  );
  atomicJson(root, 'original.json', {
    result: 'passed',
    complete: false,
    binding: binding.value,
  });
  atomicJson(root, 'audit.json', {
    ...audit,
    original: 'original.json',
    artifacts: [fileRecord(root, 'original.json')],
  });
  assert.throws(
    () => index.importAudited(binding, 'audit.json'),
    /Original evidence/,
  );
  atomicJson(root, 'original.json', {
    result: 'passed',
    complete: true,
    binding: binding.value,
  });
  atomicJson(root, 'audit.json', {
    ...audit,
    original: 'original.json',
    artifacts: [fileRecord(root, 'original.json')],
  });
  index.importAudited(binding, 'audit.json');
  assert.ok(index.find(binding).proof);
  writeFileSync(join(root, 'original.json'), 'changed');
  assert.equal(index.find(binding).proof, undefined);
  assert.throws(() => localFile(root, '../outside'), /escapes/);
  assert.throws(() => atomicJson(root, '../outside.json', {}), /escapes/);
  assert.ok(readFileSync(join(root, 'audit.json')).length);
});
