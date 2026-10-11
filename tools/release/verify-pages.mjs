import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { preparePages } from './prepare-pages.mjs';
import { sha256 } from './game-package-format.mjs';
import {
  GAME_PAGES_ROOT,
  gameAssetUrl,
} from '../../apps/server/src/game-packages/distribution.ts';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';

assertWorkspaceRoot();
await mkdir('artifacts/pages', { recursive: true });
const evidence = await mkdtemp(resolve('artifacts/pages/verification-'));
const directory = resolve(
  process.argv.find((arg) => arg.startsWith('--packages='))?.slice(11) ??
    'artifacts/game-packages/v1.0.6',
);
const prepared = await preparePages({ directory, out: join(evidence, 'site') });
await assert.rejects(
  preparePages({ directory, out: prepared.directory }),
  /already exists/,
);
for (const value of [
  '../outside',
  '/absolute',
  'v1/escape',
  '..',
  'v1%2fescape',
]) {
  assert.throws(() =>
    gameAssetUrl({ releaseTag: value, assetName: 'safe.zip' }),
  );
  assert.throws(() => gameAssetUrl({ releaseTag: 'v1.0.6', assetName: value }));
}
const original = JSON.parse(
  await readFile(join(directory, 'TableMax-game-catalog-v1.0.6.json'), 'utf8'),
);
const bad = join(evidence, 'tampered');
await mkdir(bad);
original.payload.releases[0].gameId = 'forged';
await writeFile(
  join(bad, 'TableMax-game-catalog-v1.0.6.json'),
  JSON.stringify(original),
);
await assert.rejects(
  preparePages({ directory: bad, out: join(evidence, 'rejected') }),
  /signature/,
);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const record = prepared.files.find(
    (file) => '/TableMax/' + file.path === pathname,
  );
  if (!record) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200);
  response.end(await readFile(join(prepared.directory, record.path)));
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
try {
  const port = server.address().port;
  for (const record of prepared.files) {
    const remote = record.url ?? GAME_PAGES_ROOT + record.path;
    const path = new URL(remote).pathname;
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(response.status, 200, remote);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, record.bytes);
    assert.equal(sha256(bytes), record.sha256);
  }
} finally {
  await new Promise((accept) => server.close(accept));
}
const report = {
  result: 'passed',
  boundary:
    'loopback static directory; no Pages deployment or real CDN verified',
  files: prepared.files.length,
  bytes: prepared.bytes,
  preparation: prepared.manifest,
  negativeChecks: ['path escape', 'tampered signature', 'overwrite old output'],
};
await writeFile(
  join(evidence, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ ...report, evidence }));
