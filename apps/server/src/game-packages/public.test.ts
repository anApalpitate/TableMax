import { afterEach, expect, it } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import type { ModuleManifest } from '@tablemax/game-sdk/module-manifest';
import {
  projectGameDetails,
  projectGameRuntime,
} from '@tablemax/game-sdk/metadata';
import { PackageStore } from './store';
import {
  projectPackageSnapshot,
  projectReleaseSummary,
  publicReleaseClient,
  publicReleaseDetails,
} from './public';
import {
  blobIdentity,
  releaseIdentity,
  sha256,
  validateCatalog,
} from './verification';
import type { GameRelease, InstallIndex, PackageBlob } from './types';
import { PROJECT_GAME_PUBLIC_KEY } from './project-public-key';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const manifest = () =>
  JSON.parse(
    readFileSync('games/uno/game-module.json', 'utf8'),
  ) as ModuleManifest;

it('reports which side has an outdated contract without comparing unrelated release labels', () => {
  const f = fixture();
  expect(projectReleaseSummary(f.release).compatibilityIssue).toBeUndefined();
  for (const key of ['sdk', 'protocol', 'webHost'] as const) {
    const supported = f.module.compatibility[key];
    f.module.compatibility[key] = key === 'protocol' ? 6 : 0;
    expect(projectReleaseSummary(f.release)).toMatchObject({
      compatible: false,
      compatibilityIssue: expect.stringContaining('游戏包版本落后'),
    });
    f.module.compatibility[key] = key === 'protocol' ? 9 : 2;
    expect(projectReleaseSummary(f.release)).toMatchObject({
      compatible: false,
      compatibilityIssue: expect.stringContaining('盒子版本落后'),
    });
    f.module.compatibility[key] = supported;
  }
  f.module.compatibility.protocol = 8;
  f.module.compatibility.requiredCapabilities = ['future-capability'];
  expect(projectReleaseSummary(f.release).compatibilityIssue).toContain(
    'future-capability',
  );
  expect(projectReleaseSummary(f.release).compatibilityIssue).toContain(
    '盒子缺少',
  );
  f.module.compatibility.protocol = 9;
  expect(projectReleaseSummary(f.release).compatibilityIssue).toContain(
    '盒子版本落后',
  );
});

it('explains selected variant incompatibility and malformed declarations', () => {
  const f = fixture();
  f.module.variants = [
    {
      id: 'test',
      name: '测试',
      description: '测试兼容性诊断',
      compatibility: { ...f.module.compatibility, protocol: 6 },
    },
  ];
  f.release.variantId = 'test';
  expect(projectReleaseSummary(f.release).compatibilityIssue).toContain(
    '游戏包版本落后',
  );
  f.module.variants![0]!.compatibility.protocol = Number.NaN;
  expect(projectReleaseSummary(f.release).compatibilityIssue).toContain(
    '声明无效',
  );
  f.release.variantId = 'missing';
  expect(projectReleaseSummary(f.release).compatibilityIssue).toContain(
    '缺少兼容性声明',
  );
});

function fixture(document?: unknown) {
  const taskRoot = resolve('tmp', process.env.TABLEMAX_TASK_ID ?? '');
  if (taskRoot !== resolve('tmp') && !taskRoot.startsWith(resolve('tmp') + sep))
    throw new Error('Public-package fixture must remain under workspace tmp');
  mkdirSync(taskRoot, { recursive: true });
  const root = mkdtempSync(join(taskRoot, 'public-package-'));
  roots.push(root);
  const source = manifest();
  const module =
    document === undefined
      ? source
      : projectGameRuntime(source, { details: 'web/details.json' });
  module.entries = { rules: 'rules.cjs', bot: 'bot.cjs', web: 'web/entry.js' };
  module.styles = [];
  const records = [
    { path: 'rules.cjs', data: Buffer.from('rules') },
    { path: 'bot.cjs', data: Buffer.from('bot') },
    { path: 'web/entry.js', data: Buffer.from('export const client={};') },
    ...(document === undefined
      ? []
      : [
          {
            path: 'web/details.json',
            data: Buffer.from(JSON.stringify(document)),
          },
        ]),
  ];
  const blob: PackageBlob = {
    id: '',
    kind: 'code',
    files: records.map(({ path, data }) => ({
      path,
      size: data.length,
      sha256: sha256(data),
    })),
    archiveBytes: 1,
    archiveSha256: sha256('fixture'),
    installedBytes: records.reduce(
      (sum, record) => sum + record.data.length,
      0,
    ),
    assetName: 'fixture.zip',
    releaseTag: 'v1.0.6',
  };
  blob.id = blobIdentity(blob);
  const release: GameRelease = {
    releaseId: '',
    gameId: 'uno',
    module,
    code: blob.id,
    resources: [],
    resourceMap: {},
    releaseTag: 'v1.0.6',
  };
  release.releaseId = releaseIdentity(release);
  const games = join(root, 'games');
  for (const record of records) {
    const path = join(games, 'uno', 'blobs', blob.id, record.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, record.data);
  }
  const index: InstallIndex = {
    schemaVersion: 1,
    releases: { [release.releaseId]: release },
    blobs: { [blob.id]: blob },
    selected: { 'uno:': release.releaseId },
  };
  writeFileSync(join(games, 'index.json'), JSON.stringify(index));
  const store = new PackageStore({
    root: games,
    publicKey: PROJECT_GAME_PUBLIC_KEY,
    protectedReleaseIds: () => [],
  });
  return { root, games, source, module, blob, release, store };
}

it('projects only installation summaries while retaining full immutable store metadata', () => {
  const f = fixture();
  const internal = f.store.snapshot();
  internal.catalog.releases.push(f.release);
  internal.catalog.blobs.push(f.blob);
  internal.tasks.push({
    releaseId: f.release.releaseId,
    phase: 'downloading',
    transferredBytes: 3,
    totalBytes: 7,
  });
  const before = JSON.stringify(internal);
  const value = projectPackageSnapshot(internal);
  const summary = value.catalog.releases[0]!;
  expect(Object.keys(summary).sort()).toEqual([
    'compatible',
    'gameId',
    'name',
    'releaseId',
    'releaseTag',
  ]);
  expect(summary.compatible).toBe(true);
  expect(summary.name).toBe('UNO');
  expect(value.index.releases[f.release.releaseId]).toEqual(summary);
  expect(JSON.stringify(value)).not.toMatch(
    /introduction|budgets|resourceMap|entries|archiveBytes|blobs|rulesVersion/,
  );
  expect(JSON.stringify(internal)).toBe(before);
  value.index.selected['uno:'] = 'changed';
  value.tasks[0]!.transferredBytes = 999;
  expect(internal.index.selected['uno:']).toBe(f.release.releaseId);
  expect(internal.tasks[0]!.transferredBytes).toBe(3);
});

it('reports compatibility and canonical variant names without exposing module compatibility records', () => {
  const f = fixture();
  const pokemon = JSON.parse(
    readFileSync('games/pokemon-encounters/game-module.json', 'utf8'),
  ) as ModuleManifest;
  const release = {
    ...f.release,
    gameId: pokemon.id,
    variantId: 'expansion',
    module: pokemon,
  };
  const summary = projectReleaseSummary(release);
  expect(summary).toMatchObject({
    variantName: '扩展版',
    defaultVariantId: 'original',
    compatible: true,
  });
  pokemon.variants![1]!.compatibility.webHost = 2;
  expect(projectReleaseSummary(release).compatible).toBe(false);
  expect(
    projectReleaseSummary({ ...release, variantId: 'unknown' }).compatible,
  ).toBe(false);
});

it('keeps the first current gameplay in the public catalog while retaining every installed historical reference', () => {
  const f = fixture();
  const old = structuredClone(f.release);
  old.releaseId = 'b'.repeat(64);
  old.module.catalog.name = 'Historical UNO';
  const variant = {
    ...structuredClone(f.release),
    releaseId: 'c'.repeat(64),
    variantId: 'other',
  };
  const snapshot = f.store.snapshot();
  snapshot.catalog.releases = [f.release, variant, old];
  snapshot.index.releases[old.releaseId] = old;
  const before = JSON.stringify(snapshot);
  const projected = projectPackageSnapshot(snapshot);
  expect(
    projected.catalog.releases.map((release) => release.releaseId),
  ).toEqual([f.release.releaseId, variant.releaseId]);
  expect(projected.catalog.releases[0]!.name).toBe('UNO');
  expect(Object.keys(projected.index.releases)).toContain(old.releaseId);
  expect(JSON.stringify(snapshot)).toBe(before);
});

it('loads new detail documents from installed inventory and falls back to old inline documents', () => {
  const source = manifest();
  const document = projectGameDetails(source);
  const modern = fixture({ ...document, runtimeOnlyExtra: 'excluded' });
  expect(publicReleaseDetails(modern.store, modern.release.releaseId)).toEqual(
    document,
  );
  expect(publicReleaseDetails(modern.store, 'a'.repeat(64))).toBeUndefined();
  expect(publicReleaseClient(modern.store, modern.release.releaseId)).toEqual({
    gameId: 'uno',
    module: {
      id: 'uno',
      compatibility: { webHost: 1 },
      entries: { web: 'web/entry.js' },
      styles: [],
    },
  });
  const legacy = fixture();
  expect(publicReleaseDetails(legacy.store, legacy.release.releaseId)).toEqual(
    document,
  );
  expect(
    legacy.store.snapshot().index.releases[legacy.release.releaseId]!.module
      .introduction,
  ).toEqual(source.introduction);
});

it('rejects detail documents with the wrong schema, game identity or field shape', () => {
  for (const document of [
    { schemaVersion: 2, id: 'uno' },
    { schemaVersion: 1, id: 'avalon' },
    { schemaVersion: 1, id: 'uno', introduction: 'invalid' },
    { schemaVersion: 1, id: 'uno', guidance: 'invalid' },
    {
      schemaVersion: 1,
      id: 'uno',
      variants: [{ id: 'expansion', introduction: {} }],
    },
  ]) {
    const f = fixture(document);
    expect(publicReleaseDetails(f.store, f.release.releaseId)).toBeUndefined();
  }
});

it('rejects escaped, nonpublic, unlisted and resource-aliased detail paths before installation', () => {
  const f = fixture(projectGameDetails(manifest()));
  for (const path of [
    '../details.json',
    'rules.cjs',
    'web/not-listed.json',
    'web/entry.js',
  ]) {
    const release = structuredClone(f.release);
    release.module.details = path;
    release.releaseId = releaseIdentity(release);
    expect(() =>
      validateCatalog({
        schemaVersion: 1,
        releases: [release],
        blobs: [f.blob],
      }),
    ).toThrow('invalid-module-details');
  }
  const aliased = structuredClone(f.release);
  aliased.resourceMap['web/details.json'] = {
    blobId: f.blob.id,
    path: 'web/details.json',
  };
  aliased.releaseId = releaseIdentity(aliased);
  expect(() =>
    validateCatalog({ schemaVersion: 1, releases: [aliased], blobs: [f.blob] }),
  ).toThrow('invalid-module-details');
});

it('retired Avalon variants are hidden in public copies without modifying historical signed records', () => {
  const module = JSON.parse(
    readFileSync('games/avalon/game-module.json', 'utf8'),
  ) as ModuleManifest;
  const releases = ['classic', 'court', 'configured'].map((variantId, i) => ({
    releaseId: String(i).repeat(64),
    gameId: 'avalon',
    variantId,
    module,
    code: 'a'.repeat(64),
    resources: [],
    resourceMap: {},
    releaseTag: 'v1.0.6',
  }));
  const snapshot = {
    catalog: { schemaVersion: 1 as const, releases, blobs: [] },
    index: {
      schemaVersion: 1 as const,
      releases: Object.fromEntries(releases.map((r) => [r.releaseId, r])),
      blobs: {},
      selected: {
        'avalon:court': releases[1]!.releaseId,
        'avalon:configured': releases[2]!.releaseId,
      },
    },
    tasks: [],
    unavailableReleaseIds: [],
  };
  const before = structuredClone(snapshot);
  const projected = projectPackageSnapshot(snapshot);
  expect(projected.catalog.releases.map((r) => r.variantId)).toEqual([
    'configured',
  ]);
  expect(
    Object.values(projected.index.releases).map((r) => r.variantId),
  ).toEqual(['configured']);
  expect(projected.index.selected).toEqual({
    'avalon:configured': releases[2]!.releaseId,
  });
  expect(snapshot).toEqual(before);
});
