import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const run = async (command, args) =>
  (
    await promisify(execFile)(command, args, {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
  ).stdout.trim();
const hash = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const repo = 'anApalpitate/TableMax';
const tag = `v${version}`;
const evidence = resolve(
  'artifacts/maintenance',
  tag,
  'github-release-20261005',
);
const notes = process.argv.find((arg) => arg.startsWith('--notes='))?.slice(8);
assert.ok(notes, 'Provide reviewed release notes with --notes=<file>');
await stat(notes);
const exe = resolve(`artifacts/releases/TableMax-${version}-win-x64.exe`);
const source = resolve(`artifacts/releases/TableMax-${version}-source.zip`);
assert.ok(exe.endsWith('.exe') && source.endsWith('-source.zip'));
const proof = JSON.parse(
  await readFile(resolve(evidence, 'shipping-executable-checks.json'), 'utf8'),
);
assert.equal(proof.result, 'passed');
assert.equal(
  await hash(exe),
  proof.executableSha256,
  'Shipping EXE changed after validation',
);
const commit = await run('git', ['rev-parse', 'HEAD']);
assert.equal(
  await run('git', ['rev-parse', `${tag}^{commit}`]),
  commit,
  'Release tag must point to current source commit',
);
const tagObject = await run('git', ['rev-parse', tag]);
assert.ok(
  (await run('git', ['ls-remote', 'origin', `refs/tags/${tag}`])).startsWith(
    tagObject + '\t',
  ),
  'Push verified release tag first',
);
const manifest = JSON.parse(
  await readFile(
    resolve(`artifacts/releases/TableMax-${version}-win-x64-manifest.json`),
    'utf8',
  ),
);
const inputs = new Set(['apps/desktop/release/Launcher.cs']);
for (const unit of manifest.units) {
  const record = JSON.parse(
    await readFile(
      resolve(
        '.cache/build-modules/v1',
        unit.id,
        unit.fingerprint,
        'manifest.json',
      ),
      'utf8',
    ),
  );
  for (const file of record.inputs.files) inputs.add(file.path);
}
assert.equal(
  await run('git', ['diff', '--name-only', 'HEAD', '--', ...inputs]),
  '',
  'Commit all frozen runtime source inputs before publishing',
);
await run('git', [
  'archive',
  '--format=zip',
  `--prefix=TableMax-${version}/`,
  `--output=${source}`,
  commit,
]);
const assets = [exe, source];
const record = {
  version,
  commit,
  tag,
  repo,
  assets: await Promise.all(
    assets.map(async (path) => ({
      path,
      bytes: (await stat(path)).size,
      sha256: await hash(path),
    })),
  ),
};
const url = await run('gh', [
  'release',
  'create',
  tag,
  ...assets,
  '--repo',
  repo,
  '--verify-tag',
  '--latest',
  '--title',
  `TableMax ${tag}`,
  '--notes-file',
  resolve(notes),
]);
const online = JSON.parse(
  await run('gh', [
    'release',
    'view',
    tag,
    '--repo',
    repo,
    '--json',
    'url,assets,tagName,name,body,isDraft,isPrerelease',
  ]),
);
assert.equal(online.isDraft, false);
assert.equal(online.isPrerelease, false);
assert.equal(online.tagName, tag);
assert.equal(online.name, `TableMax ${tag}`);
assert.equal(
  online.body.trim(),
  (await readFile(resolve(notes), 'utf8')).trim(),
  'Published notes must match reviewed notes',
);
assert.equal(
  online.assets.length,
  2,
  'Public release must contain only EXE and source ZIP',
);
for (const file of record.assets) {
  const name = file.path.split(/[\\/]/).at(-1);
  const asset = online.assets.find((item) => item.name === name);
  assert.ok(
    asset &&
      asset.size === file.bytes &&
      asset.digest === `sha256:${file.sha256}`,
    'Remote uploaded attachment mismatch: ' + name,
  );
}
await writeFile(
  resolve(evidence, 'github-publication.json'),
  JSON.stringify({ ...record, result: 'passed', url, online }, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    result: 'passed',
    url,
    commit,
    assets: online.assets.map((item) => item.name),
  }),
);
