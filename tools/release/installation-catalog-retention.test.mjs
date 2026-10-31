import assert from 'node:assert/strict';
import test from 'node:test';
import { hash } from './installation-toolchain.mjs';
import { verifyRestoredGameInventory } from './installation-verifier.mjs';
const catalogBytes = Buffer.from('{"signed":"exact installed catalog"}\n');
const catalog = {
  path: `.resource-archives/catalogs/${hash(catalogBytes)}.json`,
  bytes: catalogBytes.length,
  sha256: hash(catalogBytes),
};
const before = [
  { path: 'uno/blobs/code/web/index.js', bytes: 4, sha256: 'a'.repeat(64) },
];
const receipt = {
  preservedArchives: [
    { ...catalog, path: 'games/' + catalog.path, reason: '原始签名目录' },
  ],
};
const sorted = (files) =>
  files.toSorted((a, b) => a.path.localeCompare(b.path));
test('restored inventory accepts exactly the bound installed catalog retained by uninstall', () => {
  verifyRestoredGameInventory({
    before,
    after: sorted([...before, catalog]),
    catalog: catalog,
    receipt,
  });
  verifyRestoredGameInventory({
    before: sorted([...before, catalog]),
    after: sorted([...before, catalog]),
    catalog: catalog,
    receipt,
  });
  verifyRestoredGameInventory({
    before,
    after: before,
    catalog: catalog,
    receipt: {},
  });
});
test('restored inventory rejects unbound or duplicate retained catalog receipt', () => {
  for (const bad of [
    {},
    {
      preservedArchives: [
        { ...receipt.preservedArchives[0], bytes: catalog.bytes + 1 },
      ],
    },
    {
      preservedArchives: [
        { ...receipt.preservedArchives[0], sha256: 'b'.repeat(64) },
      ],
    },
    {
      preservedArchives: [
        ...receipt.preservedArchives,
        ...receipt.preservedArchives,
      ],
    },
  ])
    assert.throws(() =>
      verifyRestoredGameInventory({
        before,
        after: sorted([...before, catalog]),
        catalog: catalog,
        receipt: bad,
      }),
    );
});
test('restored inventory rejects any unrelated addition, mutation or omission', () => {
  for (const after of [
    sorted([
      ...before,
      catalog,
      {
        path: '.resource-archives/blobs/unknown.zip',
        bytes: 1,
        sha256: 'c'.repeat(64),
      },
    ]),
    sorted([{ ...before[0], sha256: 'b'.repeat(64) }, catalog]),
    [catalog],
    sorted([...before, { ...catalog, bytes: catalog.bytes + 1 }]),
  ])
    assert.throws(() =>
      verifyRestoredGameInventory({ before, after, catalog: catalog, receipt }),
    );
});
