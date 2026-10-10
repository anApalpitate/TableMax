import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createReleaseExecutable,
  assertReleaseIdle,
} from './release-executable.mjs';
import { lock } from '../build/module-build.mjs';
import { scheduleMaintenance } from '../maintenance/lifecycle.mjs';
scheduleMaintenance();
await lock('package-release', async () => {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const base = `artifacts/releases/TableMax-${version}-win-x64`;
  await assertReleaseIdle(base + '.exe');
  const manifest = JSON.parse(await readFile(base + '-manifest.json', 'utf8'));
  if (manifest.version !== version)
    throw new Error('Build and verify the current portable ZIP first');
  const result = await createReleaseExecutable({
    archivePath: base + '.zip',
    manifestPath: base + '-manifest.json',
    outputPath: base + '.exe',
  });
  const evidence = resolve(
    'artifacts/maintenance',
    `v${version}`,
    'github-release-20261005',
  );
  await mkdir(evidence, { recursive: true });
  await writeFile(
    resolve(evidence, 'executable-build.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
});
