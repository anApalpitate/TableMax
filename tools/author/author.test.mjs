import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportAuthorToolkit } from './export-toolkit.mjs';
import { checkAuthorProject } from './contract.mjs';
import { buildAuthorProject } from './build.mjs';
import { verifyAuthorContract } from './harness.mjs';

test('independent author builds and finishes a contract game without private workspace source', async () => {
  const root = await mkdtemp(resolve('tmp/author-contract-'));
  try {
    const toolkit = resolve(root, 'toolkit');
    const exported = await exportAuthorToolkit(toolkit);
    assert.ok(exported.files.length > 10);
    const privateImport = /(?:from|import\s*)\s*['"][^'"]*apps\//;
    for (const file of exported.files.filter((file) =>
      /\.[cm]?[jt]sx?$/.test(file.path),
    ))
      assert.equal(
        privateImport.test(await readFile(resolve(toolkit, file.path), 'utf8')),
        false,
        file.path,
      );
    const project = resolve(root, 'project');
    await cp(resolve(toolkit, 'template'), project, { recursive: true });
    const sourceManifestPath = resolve(project, 'game-module.json');
    const sourceManifest = JSON.parse(
      await readFile(sourceManifestPath, 'utf8'),
    );
    sourceManifest.guidance = true;
    sourceManifest.introduction = {
      tagline: 'Author details',
      lead: 'Only installed',
      steps: [],
      goal: 'Finish',
    };
    await writeFile(sourceManifestPath, JSON.stringify(sourceManifest));
    const independentBuild = await import(
      pathToFileURL(resolve(toolkit, 'build.mjs')).href
    );
    const built = await independentBuild.buildAuthorProject(project);
    assert.equal(built.manifest.compatibility.protocol, 7);
    assert.equal('introduction' in built.manifest, false);
    assert.equal('guidance' in built.manifest, false);
    assert.equal(built.manifest.details, 'web/details.json');
    const details = JSON.parse(
      await readFile(resolve(built.output, 'web/details.json'), 'utf8'),
    );
    assert.equal(details.guidance, true);
    assert.deepEqual(details.introduction, sourceManifest.introduction);
    assert.ok(built.files.some((file) => file.path === 'web/details.json'));
    assert.ok(built.files.some((file) => file.path === 'web/module.json'));
    assert.match(
      await readFile(resolve(built.output, 'web/entry.js'), 'utf8'),
      /\/runtime\/v1\/web-host\.js/,
    );
    assert.equal((await verifyAuthorContract(built.output)).actions, 6);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('author contract rejects private, sibling and computed imports including type-only imports', async () => {
  const root = await mkdtemp(resolve('tmp/author-boundary-'));
  try {
    await cp(resolve('tools/author/template'), root, { recursive: true });
    const entry = resolve(root, 'games/author-example/web.tsx');
    const original = await readFile(entry, 'utf8');
    for (const source of [
      "import type {RoomSession} from '../../../../apps/web/session';",
      "import type {State} from '../other-game/state';",
      "import type {Hidden} from '@tablemax/web-host/platform';",
      "const path='x'; import(path);",
      'window.tablemaxDisplay.read();',
    ]) {
      await writeFile(entry, `${original}\n${source}`);
      await assert.rejects(checkAuthorProject(root), /rejected/i);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('media changes leave author code unchanged and remain separately hashed', async () => {
  const root = await mkdtemp(resolve('tmp/author-media-'));
  try {
    await cp(resolve('tools/author/template'), root, { recursive: true });
    const entry = resolve(root, 'games/author-example/web.tsx');
    await mkdir(resolve(root, 'media'));
    await writeFile(
      resolve(root, 'media/test.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    await writeFile(
      entry,
      `import art from '../../media/test.svg';\n${await readFile(entry, 'utf8')}\nexport const image = art;`,
    );
    const first = await buildAuthorProject(root);
    const before = await readFile(resolve(first.output, 'web/entry.js'));
    const resourceBefore = first.files.find((file) =>
      file.path.endsWith('test.svg'),
    ).sha256;
    await writeFile(
      resolve(root, 'media/test.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="3"/></svg>',
    );
    const second = await buildAuthorProject(root);
    assert.equal(second.codeReused, true);
    assert.deepEqual(
      await readFile(resolve(second.output, 'web/entry.js')),
      before,
    );
    assert.notEqual(
      second.files.find((file) => file.path.endsWith('test.svg')).sha256,
      resourceBefore,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
