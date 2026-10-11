import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { windowsExecutableName } from './windows-executable-name.mjs';
import {
  createReleaseExecutable,
  assertReleaseIdle,
} from './release-executable.mjs';
import { lock } from '../build/module-build.mjs';
import { scheduleMaintenance } from '../maintenance/lifecycle.mjs';
scheduleMaintenance();
const args = process.argv.slice(2).filter((arg) => arg !== '--');
assert.ok(
  args.length <= 1 && args.every((arg) => arg.startsWith('--edition=')),
  'Only --edition=full|box|both is supported',
);
await lock('package-release', async () => {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const pointer = JSON.parse(
    await readFile(
      resolve('artifacts/package-payloads', `v${version}`, 'current.json'),
      'utf8',
    ),
  );
  assert.equal(pointer.version, version);
  const edition =
    args.find((arg) => arg.startsWith('--edition='))?.slice(10) ?? 'both';
  assert.ok(['full', 'box', 'both'].includes(edition));
  const selected = pointer.deliveries.filter(
    (item) => edition === 'both' || item.edition === edition,
  );
  assert.equal(
    selected.length,
    edition === 'both' ? 2 : 1,
    'Build both internal edition payloads first',
  );
  for (const item of selected) {
    const base = resolve(
      'artifacts/releases',
      windowsExecutableName(pointer.buildVersion ?? version, item.edition),
    ).replace(/\.exe$/, '');
    await assertReleaseIdle(base + '.exe');
    const manifest = JSON.parse(await readFile(item.manifestPath, 'utf8'));
    assert.equal(manifest.version, version);
    assert.equal(manifest.edition, item.edition);
    const result = await createReleaseExecutable({
      archivePath: item.archivePath,
      manifestPath: item.manifestPath,
      outputPath: base + '.exe',
    });
    await writeFile(
      base + '-manifest.json',
      JSON.stringify(
        {
          ...manifest,
          executable: result,
          internalPayloadPath: item.archivePath,
        },
        null,
        2,
      ) + '\n',
    );
    const evidence = resolve(
      'artifacts/maintenance',
      `v${version}`,
      'windows-editions',
      pointer.snapshot,
    );
    await mkdir(evidence, { recursive: true });
    await writeFile(
      resolve(evidence, `executable-build-${item.edition}.json`),
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log(JSON.stringify(result));
    item.executable = result;
  }
  await writeFile(
    resolve('artifacts/package-payloads', `v${version}`, 'current.json'),
    JSON.stringify(pointer, null, 2) + '\n',
  );
});
