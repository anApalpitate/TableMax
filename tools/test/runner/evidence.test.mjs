import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute, sep } from 'node:path';
import {
  fingerprint,
  EvidenceIndex,
  fileRecord,
  localFile,
  atomicJson,
  createFingerprintStage,
} from './evidence.mjs';
import {
  resolveMsEdgeExecutable,
  readMsEdgeRuntime,
  readControlledCanvasFonts,
  controlledCanvasFontFaces,
} from '../support/msedge-runtime.mjs';
import {
  fixedCanvasCases,
  selectFixedCanvasCases,
} from '../platform/fixed-canvas-contract.mjs';

function fixture(t) {
  const taskTmp = resolve(
    process.env.TABLEMAX_TASK_TMP ?? 'tmp/verification-evidence-tests',
  );
  const withinTmp = relative(resolve('tmp'), taskTmp);
  assert(
    withinTmp && !withinTmp.startsWith('..') && !isAbsolute(withinTmp),
    'Evidence fixture root must be inside workspace tmp',
  );
  mkdirSync(taskTmp, { recursive: true });
  assert(
    realpathSync(taskTmp).startsWith(realpathSync(resolve('tmp')) + sep),
    'Resolved evidence root must stay in workspace tmp',
  );
  const root = mkdtempSync(join(taskTmp, 'verification-evidence-'));
  const canonicalRoot = realpathSync(root);
  t.after(() => {
    assert.equal(
      realpathSync(root),
      canonicalRoot,
      'Fixture identity changed before cleanup',
    );
    assert(canonicalRoot.startsWith(realpathSync(taskTmp) + sep));
    rmSync(root, { recursive: true, force: true });
  });
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

function fakeEdge(t) {
  const value = fixture(t);
  const environment = {
    LOCALAPPDATA: join(value.root, 'local'),
    PROGRAMFILES: join(value.root, 'program'),
    'PROGRAMFILES(X86)': join(value.root, 'program-x86'),
  };
  const version = '156.0.4314.42';
  const executables = Object.values(environment).map((prefix, index) => {
    const executable = join(
      prefix,
      'Microsoft',
      'Edge',
      'Application',
      'msedge.exe',
    );
    const engine = join(dirname(executable), version, 'msedge.dll');
    mkdirSync(dirname(engine), { recursive: true });
    writeFileSync(executable, 'fake edge launcher ' + index);
    writeFileSync(engine, 'fake edge engine ' + index);
    return { executable, engine };
  });
  const readVersion = () => ({ fileVersion: version, productVersion: version });
  return { ...value, environment, executables, version, readVersion };
}

test('msedge lookup follows the locked channel priority and binds its same-version engine bytes', (t) => {
  const { environment, executables, version, readVersion } = fakeEdge(t);
  assert.equal(resolveMsEdgeExecutable(environment), executables[0].executable);
  const first = readMsEdgeRuntime({ environment, readVersion });
  assert.equal(first.version, version);
  assert.equal(first.engine.path, executables[0].engine);
  writeFileSync(
    executables[0].engine,
    'changed engine without changing its reported version',
  );
  assert.notEqual(
    readMsEdgeRuntime({ environment, readVersion }).engine.sha256,
    first.engine.sha256,
  );
  rmSync(executables[0].executable);
  assert.equal(resolveMsEdgeExecutable(environment), executables[1].executable);
  rmSync(executables[1].executable);
  assert.equal(resolveMsEdgeExecutable(environment), executables[2].executable);
  rmSync(executables[2].executable);
  assert.throws(() => resolveMsEdgeExecutable(environment), /unavailable/);
});

test('msedge refuses missing versions, mismatched engines and absent engines', (t) => {
  const { environment, executables, version, readVersion } = fakeEdge(t);
  assert.throws(
    () => readMsEdgeRuntime({ environment, readVersion: () => ({}) }),
    /version/,
  );
  assert.throws(
    () =>
      readMsEdgeRuntime({
        environment,
        readVersion: (path) => ({
          fileVersion: path.endsWith('.dll') ? '156.0.4314.43' : version,
          productVersion: version,
        }),
      }),
    /differs/,
  );
  rmSync(executables[0].engine);
  assert.throws(
    () => readMsEdgeRuntime({ environment, readVersion }),
    /ENOENT/,
  );
});

test('controlled adapter fonts bind all four exact regular and bold files and refuse a missing face', (t) => {
  const { root } = fixture(t);
  const environment = { WINDIR: join(root, 'windows') };
  mkdirSync(join(environment.WINDIR, 'Fonts'), { recursive: true });
  for (const face of controlledCanvasFontFaces)
    writeFileSync(
      join(environment.WINDIR, 'Fonts', face.file),
      'fake font ' + face.id,
    );
  const first = readControlledCanvasFonts(environment);
  assert.equal(first.faces.length, 4);
  assert.deepEqual(
    first.faces.map((face) => face.weight),
    [400, 700, 400, 700],
  );
  const changedPath = join(
    environment.WINDIR,
    'Fonts',
    controlledCanvasFontFaces[3].file,
  );
  writeFileSync(changedPath, 'changed fake font');
  assert.notEqual(
    readControlledCanvasFonts(environment).faces[3].sha256,
    first.faces[3].sha256,
  );
  rmSync(changedPath);
  assert.throws(() => readControlledCanvasFonts(environment), /ENOENT/);
});

test(
  'browser provider identity changes invalidate cache even when the browser version string is unchanged',
  { skip: process.platform !== 'win32' },
  (t) => {
    const { root, item, index, environment, executables, readVersion } =
      fakeEdge(t);
    const bindingFor = () => {
      const stage = createFingerprintStage();
      stage.environmentCache.set(
        'msedge',
        readMsEdgeRuntime({ environment, readVersion }),
      );
      return fingerprint(
        root,
        { ...item, environmentProviders: ['msedge'] },
        { stage },
      );
    };
    const first = bindingFor();
    index.save(first, ['result.json']);
    assert.ok(index.find(first).proof);
    writeFileSync(executables[0].engine, 'changed engine bytes');
    assert.equal(index.find(bindingFor()).proof, undefined);
    writeFileSync(executables[0].engine, 'fake edge engine 0');
    rmSync(executables[0].executable);
    assert.equal(index.find(bindingFor()).proof, undefined);
  },
);

test('fixed adapter declarations close the generated entry imports and production overlay styles', () => {
  const ids = fixedCanvasCases
    .filter((item) => item.layer === 'adapter' && item.inputsClosed !== false)
    .map((item) => item.id);
  assert.equal(
    ids.length,
    36,
    'This regression explicitly covers the closed 36 source adapter cases',
  );
  const args = [
    '--layout-contract=fixed-v1',
    '--layer=adapter',
    '--only=' + ids.join(','),
  ];
  const binding = fingerprint(process.cwd(), {
    runtime: 'node',
    script: 'tools/test/platform/verify-public-screen-retirement-ui.mjs',
    args,
    inputs: selectFixedCanvasCases(args).inputs,
    combination: { kind: 'source-ui', layer: 'adapter', contract: 'fixed-v1' },
  });
  const paths = new Set(binding.value.files.map((file) => file.path));
  for (const path of [
    'packages/web-host/src/index.tsx',
    'packages/web-host/src/components/OverlayPanel.tsx',
    'packages/web-host/src/components/overlay-panel.css',
    'packages/web-host/src/components/SettingHelp.tsx',
    'packages/web-host/src/components/setting-help.css',
    'apps/web/src/styles.css',
    'apps/web/src/scrollbars.css',
    'tools/test/support/msedge-runtime.mjs',
    'apps/web/src/components/BoxOverlayPanel.tsx',
    'apps/web/src/components/ConfirmationDialog.tsx',
    'apps/web/src/components/RulesGuide.tsx',
    'apps/web/src/components/DisplaySettings.tsx',
    'apps/web/src/components/box-overlay-panel.css',
    'apps/web/src/components/overlay-panel.css',
    'apps/web/src/components/rules-guide.css',
    'apps/web/src/components/display-settings.css',
    'apps/web/src/components/settings-panel.css',
  ])
    assert(
      paths.has(path),
      'Missing actual generated-entry dependency: ' + path,
    );
  assert.equal(binding.reusable, true, binding.value.gaps.join('; '));
});

test('real browser zoom stays uncached until its changing display environment has a complete binding', () => {
  const selected = selectFixedCanvasCases([
    '--layout-contract=fixed-v1',
    '--layer=adapter',
    '--only=adapter-player-portrait-browser-zoom',
  ]);
  assert.deepEqual(selected.scopes, ['shared']);
  assert.equal(selected.inputs.complete, false);
  assert(
    selected.inputs.files.includes(
      'tools/test/platform/fixed-canvas-browser-zoom.mjs',
    ),
  );
});

test('an exact shared adapter selection keeps platform runtime entries out of its input closure', () => {
  const args = [
    '--layout-contract=fixed-v1',
    '--layer=adapter',
    '--only=adapter-host-wide-gutter',
  ];
  const selected = selectFixedCanvasCases(args);
  assert.deepEqual(selected.scopes, ['shared']);
  const binding = fingerprint(process.cwd(), {
    runtime: 'node',
    script: 'tools/test/platform/verify-public-screen-retirement-ui.mjs',
    args,
    inputs: selected.inputs,
    combination: { kind: 'source-ui', layer: 'adapter', contract: 'fixed-v1' },
  });
  const paths = new Set(binding.value.files.map((file) => file.path));
  for (const path of [
    'apps/web/src/components/BoxOverlayPanel.tsx',
    'apps/web/src/components/ConfirmationDialog.tsx',
    'apps/web/src/components/RulesGuide.tsx',
    'apps/web/src/components/DisplaySettings.tsx',
    'apps/web/src/components/box-overlay-panel.css',
  ])
    assert(
      !paths.has(path),
      'An unselected platform entry expanded the shared adapter closure: ' +
        path,
    );
  assert.equal(binding.reusable, true, binding.value.gaps.join('; '));
});

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
