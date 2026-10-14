import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installationUpdateDescription } from './installation-publication.mjs';
import { hash } from './installation-toolchain.mjs';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';

assertWorkspaceRoot();
const args = process.argv.slice(2),
  value = (name) =>
    args
      .find((arg) => arg.startsWith('--' + name + '='))
      ?.slice(name.length + 3);
assert.ok(value('out'), 'Provide a new output description file');
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const pointer = JSON.parse(
  await readFile(
    value('delivery') ??
      resolve('artifacts/package-payloads', 'v' + version, 'current.json'),
    'utf8',
  ),
);
const delivery = pointer.deliveries
  ? {
      ...pointer.deliveries.find((item) => item.edition === 'full'),
      buildVersion: pointer.buildVersion,
    }
  : pointer;
assert.equal(
  hash(await readFile(delivery.executable.path)),
  delivery.executable.sha256,
  'Installer changed after sealing',
);
assert.equal(
  hash(await readFile(delivery.executable.installation.manifestPath)),
  delivery.executable.installation.manifestSha256,
  'Installation manifest changed after freezing',
);
const description = installationUpdateDescription(delivery, version);
await writeFile(value('out'), JSON.stringify(description, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    path: resolve(value('out')),
    buildVersion: description.buildVersion,
    installerSha256: description.sha256,
  }),
);
