import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { embeddedUninstallHelperInclude } from './installation-package.mjs';
import { hash } from './installation-toolchain.mjs';

test('embedded helper round trips every byte and padding boundary as ASCII', () => {
  for (const bytes of [1, 2, 3, 256, 257, 258, 164864]) {
    const helper = Buffer.from(
      Array.from({ length: bytes }, (_, i) => i % 256),
    );
    const before = Buffer.from(helper);
    const { source, record } = embeddedUninstallHelperInclude(helper);
    const chunks = [...source.matchAll(/Result := Result \+ '([^']+)';/g)].map(
      (match) => match[1],
    );
    assert.ok(chunks.length > 0);
    for (const chunk of chunks) {
      assert.match(chunk, /^[A-Za-z0-9+/]+={0,2}$/);
      assert.ok(chunk.length <= 120 && chunk.length % 4 === 0);
    }
    const encoded = chunks.join('');
    assert.equal(encoded, helper.toString('base64'));
    assert.deepEqual(Buffer.from(encoded, 'base64'), helper);
    assert.deepEqual(helper, before);
    assert.equal(record.bytes, helper.length);
    assert.equal(record.sha256, hash(helper));
    assert.equal(record.encodedBytes, encoded.length);
    assert.equal(record.includeBytes, Buffer.byteLength(source));
    assert.equal(record.includeSha256, hash(Buffer.from(source)));
    assert.ok([...source].every((character) => character.charCodeAt(0) < 128));
    assert.ok(
      source.includes("EmbeddedUninstallHelperSHA256 = '" + hash(helper)),
    );
    assert.ok(source.includes('EmbeddedUninstallHelperBytes = ' + bytes + ';'));
    assert.deepEqual(embeddedUninstallHelperInclude(helper), {
      source,
      record,
    });
  }
});

test('embedded helper rejects missing bytes and changes its frozen identity with input', () => {
  assert.throws(() => embeddedUninstallHelperInclude('not binary'));
  assert.throws(() => embeddedUninstallHelperInclude(Buffer.alloc(0)));
  const original = embeddedUninstallHelperInclude(Buffer.from([0, 128, 255]));
  const changed = embeddedUninstallHelperInclude(Buffer.from([0, 129, 255]));
  assert.notEqual(original.record.sha256, changed.record.sha256);
  assert.notEqual(original.record.includeSha256, changed.record.includeSha256);
});

test('uninstall bootstrap validates its own binary before execution and only removes owned paths', async () => {
  const source = await readFile(
    'apps/desktop/installation/TableMax.iss',
    'utf8',
  );
  const uninstall = source.slice(
    source.indexOf('procedure CurUninstallStepChanged'),
  );
  assert.ok(source.includes('#include "uninstall-helper.iss"'));
  assert.doesNotMatch(uninstall, /\{app\}\\UpdateHelper\.exe|FileCopy|DelTree/);
  const memoryHash = uninstall.indexOf('GetSHA256OfString(Data)');
  const fileHash = uninstall.indexOf('GetSHA256OfFile(Temporary)');
  const execute = uninstall.indexOf('Exec(Temporary,');
  assert.ok(memoryHash >= 0 && fileHash > memoryHash && execute > fileHash);
  assert.ok(uninstall.includes('if OwnFile then if not DeleteFile(Temporary)'));
  assert.ok(
    uninstall.includes('if OwnDirectory then if not RemoveDir(Directory)'),
  );
});
