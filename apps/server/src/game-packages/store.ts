import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  lstatSync,
  renameSync,
  rmSync,
  readdirSync,
  statSync,
  openSync,
  closeSync,
  fsyncSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { randomUUID, type KeyLike } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type {
  GameRelease,
  InstallIndex,
  PackageBlob,
  PackageCatalog,
  PackageTask,
  SignedCatalog,
} from './types';
import { releaseKey } from './types';
import {
  canonical,
  readZip,
  safePath,
  sha256,
  verifyCatalog,
  blobIdentity,
  releaseIdentity,
  validateCatalog,
} from './verification';
import type { ModuleManifest } from '../../../../packages/game-sdk/src/module-manifest';

export interface PackageStoreOptions {
  root: string;
  publicKey: KeyLike;
  protectedReleaseIds: () => Iterable<string>;
  assetUrl?: (blob: PackageBlob) => string;
  fetch?: typeof fetch;
  fault?: (phase: 'before-journal' | 'before-index' | 'after-index') => void;
}
const emptyIndex = (): InstallIndex => ({
  schemaVersion: 1,
  releases: {},
  blobs: {},
  selected: {},
});
export class PackageStore {
  private index: InstallIndex = emptyIndex();
  private catalog: PackageCatalog = {
    schemaVersion: 1,
    releases: [],
    blobs: [],
  };
  private tasks = new Map<string, PackageTask>();
  private operations = new Map<string, Promise<void>>();
  private cancelled = new Set<string>();
  private listeners = new Set<() => void>();
  private downloads = new Map<string, Promise<Buffer>>();
  private downloadProgress = new Map<string, number>();
  private activeDownloads = 0;
  private controllers = new Map<string, AbortController>();
  private verifiedDirectories = new Set<string>();
  private activeReleases = new Map<string, GameRelease>();
  private slots: (() => void)[] = [];
  readonly root: string;
  constructor(private readonly options: PackageStoreOptions) {
    this.root = resolve(options.root);
    this.ensureDirectory(this.root);
    for (const dir of ['.staging', '.transactions'])
      this.ensureDirectory(join(this.root, dir));
    if (existsSync(join(this.root, 'index.json')))
      this.index = this.readIndex(join(this.root, 'index.json'));
    this.recover();
    if (existsSync(join(this.root, 'catalog.json')))
      this.catalog = verifyCatalog(
        JSON.parse(this.readSafe(join(this.root, 'catalog.json')).toString()),
        this.options.publicKey,
      );
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(): void {
    for (const listener of this.listeners) listener();
  }
  snapshot(): {
    index: InstallIndex;
    catalog: PackageCatalog;
    tasks: PackageTask[];
    unavailableReleaseIds: string[];
  } {
    return structuredClone({
      index: this.index,
      catalog: this.catalog,
      tasks: [...this.tasks.values()],
      unavailableReleaseIds: Object.keys(this.index.releases).filter(
        (id) => !this.resolveModule(id),
      ),
    });
  }
  setCatalog(envelope: SignedCatalog): void {
    const verified = verifyCatalog(envelope, this.options.publicKey);
    this.atomicJson(join(this.root, 'catalog.json'), envelope);
    this.catalog = verified;
    this.emit();
  }
  selected(gameId: string, variantId?: string): GameRelease | undefined {
    return this.index.releases[
      this.index.selected[
        releaseKey({ gameId, ...(variantId ? { variantId } : {}) })
      ] ?? ''
    ];
  }
  resolveModule(
    releaseId: string,
  ): { release: GameRelease; root: string } | undefined {
    const release = this.index.releases[releaseId];
    if (release) {
      try {
        for (const blobId of [release.code, ...release.resources]) {
          const directory = join(this.root, release.gameId, 'blobs', blobId);
          if (!this.verifiedDirectories.has(directory)) {
            this.verifyInstalled(directory, this.index.blobs[blobId]!);
            this.verifiedDirectories.add(directory);
          }
        }
      } catch {
        return undefined;
      }
      return {
        release: structuredClone(release),
        root: join(this.root, release.gameId, 'blobs', release.code),
      };
    }
    return undefined;
  }
  resolvePublicFile(releaseId: string, path: string): string | undefined {
    if (!safePath(path)) return undefined;
    const release = this.index.releases[releaseId];
    if (!release) return undefined;
    const resource = release.resourceMap[path];
    const blobId = resource?.blobId ?? release.code;
    const relative = resource?.path ?? path;
    if (
      /\.cjs(?:\.br)?$/i.test(relative) ||
      relative === release.module.entries.rules ||
      relative === release.module.entries.bot
    )
      return undefined;
    if (!resource && !relative.startsWith('web/')) return undefined;
    if (!this.index.blobs[blobId]?.files.some((file) => file.path === relative))
      return undefined;
    const target = join(this.root, release.gameId, 'blobs', blobId, relative);
    this.assertSafe(target);
    return target;
  }
  async importOffline(file: string): Promise<string> {
    if (statSync(file).size >= 64_000_000)
      throw new Error('offline-package-size-limit');
    const bytes = readFileSync(file);
    if (bytes.length >= 64_000_000)
      throw new Error('offline-package-size-limit');
    const members = readZip(bytes, 128_000_000);
    const catalogBytes = members.get('catalog.json'),
      releaseBytes = members.get('release.json');
    if (!catalogBytes || !releaseBytes)
      throw new Error('invalid-offline-package');
    const envelope = JSON.parse(catalogBytes.toString()) as SignedCatalog;
    const catalog = verifyCatalog(envelope, this.options.publicKey);
    const { releaseId } = JSON.parse(releaseBytes.toString()) as {
      releaseId: string;
    };
    const release = catalog.releases.find((r) => r.releaseId === releaseId);
    if (!release) throw new Error('missing-offline-release');
    const closure = [...new Set([release.code, ...release.resources])];
    if (
      members.size !== closure.length + 2 ||
      [...members.keys()].some(
        (path) =>
          path !== 'catalog.json' &&
          path !== 'release.json' &&
          !closure.some((id) => path === `blobs/${id}.zip`),
      )
    )
      throw new Error('extra-offline-file');
    if (this.catalog.releases.length === 0) this.setCatalog(envelope);
    await this.run(
      releaseId,
      async (blob) => {
        const archive = members.get(`blobs/${blob.id}.zip`);
        if (!archive) throw new Error('missing-offline-dependency');
        return archive;
      },
      catalog,
    );
    return releaseId;
  }
  /** Local signed full-distribution payload. Never changes an existing selection. */
  async importPreinstalled(
    directory: string,
    progress?: () => void,
  ): Promise<string[]> {
    const source = resolve(directory);
    if (!existsSync(source)) return [];
    const readLocal = (path: string): Buffer => {
      let cursor = resolve(path);
      for (;;) {
        if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink())
          throw new Error('preinstalled-link-rejected');
        const parent = dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }
      if (!lstatSync(path).isFile())
        throw new Error('invalid-preinstalled-file');
      return readFileSync(path);
    };
    if (
      readdirSync(source).sort().join(',') !==
      'blobs,bootstrap.json,catalog.json'
    )
      throw new Error('extra-preinstalled-file');
    const envelope = JSON.parse(
      readLocal(join(source, 'catalog.json')).toString(),
    ) as SignedCatalog;
    const catalog = verifyCatalog(envelope, this.options.publicKey);
    const bootstrap = JSON.parse(
      readLocal(join(source, 'bootstrap.json')).toString(),
    ) as { schemaVersion: number; releaseIds: string[] };
    if (
      Object.keys(bootstrap).sort().join(',') !== 'releaseIds,schemaVersion' ||
      bootstrap.schemaVersion !== 1 ||
      !Array.isArray(bootstrap.releaseIds) ||
      bootstrap.releaseIds.length === 0 ||
      new Set(bootstrap.releaseIds).size !== bootstrap.releaseIds.length ||
      bootstrap.releaseIds.some(
        (id) => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id),
      )
    )
      throw new Error('invalid-preinstalled-bootstrap');
    const releases = bootstrap.releaseIds.map((id) => {
      const release = catalog.releases.find(
        (release) => release.releaseId === id,
      );
      if (!release) throw new Error('unknown-preinstalled-release');
      return release;
    });
    if (new Set(releases.map(releaseKey)).size !== releases.length)
      throw new Error('duplicate-preinstalled-variant');
    const receipt = join(
      this.root,
      '.preinstalled',
      sha256(canonical(bootstrap)) + '.json',
    );
    const completed =
      existsSync(receipt) &&
      this.readSafe(receipt).toString() === canonical(bootstrap);
    const closure = new Set(
      releases.flatMap((release) => [release.code, ...release.resources]),
    );
    const expected = [...closure].map((id) => `${id}.zip`).sort();
    const actual = readdirSync(join(source, 'blobs')).sort();
    if (actual.join(',') !== expected.join(','))
      throw new Error('invalid-preinstalled-closure');
    const archives = new Map<string, Buffer>();
    for (const id of closure) {
      const blob = catalog.blobs.find((blob) => blob.id === id)!;
      const path = join(source, 'blobs', `${id}.zip`);
      if (lstatSync(path).size !== blob.archiveBytes)
        throw new Error('archive-hash-mismatch');
      const bytes = readLocal(path);
      if (sha256(bytes) !== blob.archiveSha256)
        throw new Error('archive-hash-mismatch');
      archives.set(id, bytes);
      progress?.();
    }
    if (this.catalog.releases.length === 0) this.setCatalog(envelope);
    for (const release of releases) {
      if (
        (!completed || this.index.releases[release.releaseId]) &&
        !this.resolveModule(release.releaseId)
      )
        await this.run(
          release.releaseId,
          async (blob) => archives.get(blob.id)!,
          catalog,
          true,
        );
      progress?.();
    }
    this.ensureDirectory(dirname(receipt));
    this.atomicJson(receipt, bootstrap);
    return releases.map((release) => release.releaseId);
  }
  install(releaseId: string): Promise<void> {
    return this.run(releaseId, (blob) => this.download(blob));
  }
  cancel(releaseId: string): void {
    this.cancelled.add(releaseId);
    const task = this.tasks.get(releaseId);
    if (task && task.phase !== 'complete') {
      task.phase = 'cancelled';
      this.emit();
    }
    for (const [blobId, controller] of this.controllers) {
      const needed = [...this.tasks.values()].some((task) => {
        if (task.phase !== 'queued' && task.phase !== 'downloading')
          return false;
        const release =
          this.activeReleases.get(task.releaseId) ??
          this.index.releases[task.releaseId];
        return release && [release.code, ...release.resources].includes(blobId);
      });
      if (!needed) controller.abort();
    }
  }
  rollback(releaseId: string): void {
    const release = this.index.releases[releaseId];
    if (!release) throw new Error('uninstalled-release');
    const next = structuredClone(this.index);
    next.selected[releaseKey(release)] = releaseId;
    this.commitIndex(next);
    this.emit();
  }
  uninstall(releaseId: string): void {
    if (new Set(this.options.protectedReleaseIds()).has(releaseId))
      throw new Error('release-in-use');
    const release = this.index.releases[releaseId];
    if (!release) return;
    const next = structuredClone(this.index);
    delete next.releases[releaseId];
    if (next.selected[releaseKey(release)] === releaseId)
      delete next.selected[releaseKey(release)];
    // Keep immutable bytes for history safety and active HTTP readers; maintenance may collect only after independently checking all references.
    this.commitIndex(next);
    this.emit();
  }
  private run(
    releaseId: string,
    source: (blob: PackageBlob) => Promise<Buffer>,
    catalog = this.catalog,
    preserveSelection = false,
  ): Promise<void> {
    const current = this.operations.get(releaseId);
    if (current) return current;
    const release =
      catalog.releases.find((r) => r.releaseId === releaseId) ??
      this.index.releases[releaseId];
    if (!release) return Promise.reject(new Error('unknown-release'));
    const c = release.module.compatibility;
    if (c.sdk !== 1 || c.protocol !== 7 || c.webHost !== 1)
      return Promise.reject(new Error('incompatible-game-module'));
    const blobs = [...new Set([release.code, ...release.resources])].map(
      (id) => catalog.blobs.find((b) => b.id === id) ?? this.index.blobs[id]!,
    );
    this.activeReleases.set(releaseId, release);
    const missing = blobs.filter((b) => {
      const directory = join(this.root, release.gameId, 'blobs', b.id);
      try {
        if (!this.index.blobs[b.id]) return true;
        this.verifyInstalled(directory, b);
        return false;
      } catch {
        this.verifiedDirectories.delete(directory);
        return true;
      }
    });
    const task: PackageTask = {
      releaseId,
      phase: 'queued',
      transferredBytes: 0,
      totalBytes: missing.reduce((n, b) => n + b.archiveBytes, 0),
    };
    this.cancelled.delete(releaseId);
    this.tasks.set(releaseId, task);
    this.emit();
    const operation = (async () => {
      const txn = randomUUID(),
        stage = join(this.root, '.staging', txn);
      this.ensureDirectory(stage);
      try {
        task.phase = 'downloading';
        this.emit();
        const archives = await Promise.all(
          missing.map(async (blob) => ({ blob, bytes: await source(blob) })),
        );
        this.checkCancelled(releaseId);
        task.transferredBytes = task.totalBytes;
        task.phase = 'verifying';
        this.emit();
        for (const { blob, bytes } of archives) {
          if (
            bytes.length !== blob.archiveBytes ||
            sha256(bytes) !== blob.archiveSha256
          )
            throw new Error('archive-hash-mismatch');
          const members = readZip(bytes);
          if (members.size !== blob.files.length)
            throw new Error('extra-package-file');
          const destination = join(stage, blob.id);
          this.ensureDirectory(destination);
          for (const file of blob.files) {
            const data = members.get(file.path);
            if (
              !data ||
              data.length !== file.size ||
              sha256(data) !== file.sha256
            )
              throw new Error('package-file-hash-mismatch');
            const target = join(destination, file.path);
            this.ensureDirectory(dirname(target));
            writeFileSync(target, data, { flag: 'wx' });
          }
        }
        this.checkCancelled(releaseId);
        task.phase = 'installing';
        this.emit();
        const next = structuredClone(this.index);
        for (const blob of blobs) next.blobs[blob.id] = blob;
        next.releases[releaseId] = release;
        const key = releaseKey(release);
        if (!preserveSelection || !next.selected[key])
          next.selected[key] = releaseId;
        this.options.fault?.('before-journal');
        this.atomicJson(join(this.root, '.transactions', txn + '.json'), {
          gameId: release.gameId,
          stage: txn,
          blobs: missing.map((b) => b.id),
          index: next,
        });
        for (const blob of missing) {
          const target = join(this.root, release.gameId, 'blobs', blob.id);
          this.ensureDirectory(dirname(target));
          this.assertSafe(target);
          if (existsSync(target)) {
            try {
              this.verifyInstalled(target, blob);
            } catch {
              const quarantine = join(
                this.root,
                '.quarantine',
                release.gameId,
                blob.id + '-' + txn,
              );
              this.ensureDirectory(dirname(quarantine));
              await this.renameInstalled(target, quarantine);
              await this.renameInstalled(join(stage, blob.id), target);
            }
          } else await this.renameInstalled(join(stage, blob.id), target);
        }
        this.options.fault?.('before-index');
        this.commitIndex(next);
        this.options.fault?.('after-index');
        rmSync(join(this.root, '.transactions', txn + '.json'));
        task.phase = 'complete';
        this.emit();
      } catch (error) {
        if (task.phase !== 'cancelled') {
          task.phase = 'failed';
          task.error =
            error instanceof Error ? error.message : 'installation-failed';
          this.emit();
        }
        throw error;
      } finally {
        this.assertSafe(stage);
        rmSync(stage, { recursive: true, force: true });
      }
    })();
    this.operations.set(releaseId, operation);
    void operation
      .finally(() => {
        this.operations.delete(releaseId);
        this.activeReleases.delete(releaseId);
      })
      .catch(() => {});
    return operation;
  }
  private checkCancelled(id: string): void {
    if (this.cancelled.has(id)) throw new Error('installation-cancelled');
  }
  private async renameInstalled(source: string, target: string): Promise<void> {
    // Windows scanners may briefly hold newly written files; retain the transaction
    // and retry only the same bounded, checked rename, never download or installation.
    for (let attempt = 0; ; attempt++) {
      this.assertSafe(source);
      this.assertSafe(target);
      try {
        renameSync(source, target);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (
          process.platform !== 'win32' ||
          attempt === 10 ||
          !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')
        )
          throw error;
        await delay(100);
      }
    }
  }
  /** Native upgrade entry only: unsigned legacy bytes must originate in a preserved local runtime. */
  migrateLegacy(snapshotRoot: string): string[] {
    const source = resolve(snapshotRoot);
    if (!source.startsWith(join(this.root, '.legacy') + requireSeparator()))
      throw new Error('invalid-legacy-snapshot');
    this.assertSafe(source);
    const modules = JSON.parse(
      this.readSafe(join(source, 'modules.json')).toString(),
    ) as ModuleManifest[];
    const registered: string[] = [];
    for (const original of modules) {
      if (
        !/^[a-z][a-z0-9-]*$/.test(original.id) ||
        original.compatibility.sdk !== 1 ||
        original.compatibility.protocol !== 7 ||
        original.compatibility.webHost !== 1
      )
        throw new Error('invalid-legacy-module');
      const files: { path: string; data: Buffer }[] = [];
      for (const part of ['rules', 'bot'] as const) {
        const entry = original.entries[part];
        if (
          !safePath(entry) ||
          !entry.startsWith(part === 'rules' ? 'games/' : 'bots/')
        )
          throw new Error('invalid-legacy-entry');
        files.push({ path: entry, data: this.readSafe(join(source, entry)) });
        if (existsSync(join(source, entry + '.br')))
          files.push({
            path: entry + '.br',
            data: this.readSafe(join(source, entry + '.br')),
          });
      }
      const visit = (directory: string, relative: string): void => {
        this.assertSafe(directory);
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          if (entry.isSymbolicLink()) throw new Error('legacy-link-rejected');
          const next = relative + '/' + entry.name;
          if (!safePath(next)) throw new Error('invalid-legacy-path');
          if (entry.isDirectory()) visit(join(directory, entry.name), next);
          else if (entry.isFile())
            files.push({
              path: next,
              data: this.readSafe(join(directory, entry.name)),
            });
          else throw new Error('legacy-special-file');
        }
      };
      visit(join(source, 'web', 'games', original.id), 'web');
      const blob: PackageBlob = {
        id: '',
        kind: 'code',
        files: files.map((f) => ({
          path: f.path,
          size: f.data.length,
          sha256: sha256(f.data),
        })),
        archiveBytes: 1,
        archiveSha256: sha256(
          canonical(
            files.map((f) => ({ path: f.path, sha256: sha256(f.data) })),
          ),
        ),
        installedBytes: files.reduce((n, f) => n + f.data.length, 0),
        assetName: 'legacy.zip',
        releaseTag: 'legacy',
      };
      blob.id = blobIdentity(blob);
      const target = join(this.root, original.id, 'blobs', blob.id);
      if (existsSync(target)) {
        try {
          this.verifyInstalled(target, blob);
        } catch {
          const quarantine = join(
            this.root,
            '.quarantine',
            original.id,
            blob.id + '-' + randomUUID(),
          );
          this.ensureDirectory(dirname(quarantine));
          renameSync(target, quarantine);
          this.verifiedDirectories.delete(target);
        }
      }
      this.ensureDirectory(target);
      for (const file of files) {
        const path = join(target, file.path);
        this.ensureDirectory(dirname(path));
        if (existsSync(path)) {
          if (sha256(this.readSafe(path)) !== sha256(file.data))
            throw new Error('legacy-content-collision');
        } else writeFileSync(path, file.data, { flag: 'wx' });
      }
      const variants = original.variants?.length
        ? original.variants.map((v) => ({
            id: v.id,
            compatibility: v.compatibility,
          }))
        : [
            {
              id: original.defaultVariantId,
              compatibility: original.compatibility,
            },
          ];
      for (const variant of variants) {
        const module = structuredClone(original);
        module.compatibility = variant.compatibility;
        const webEntry = original.entries.web.replace(
          /^\/?(?:web\/)?games\/[^/]+\//,
          '',
        );
        module.entries.web = 'web/' + webEntry;
        module.styles = (original.styles ?? []).map(
          (path) => 'web/' + path.replace(/^\/?(?:web\/)?games\/[^/]+\//, ''),
        );
        const release: GameRelease = {
          releaseId: '',
          legacy: true,
          gameId: original.id,
          ...(variant.id ? { variantId: variant.id } : {}),
          module,
          code: blob.id,
          resources: [],
          resourceMap: {},
          releaseTag: 'legacy',
        };
        release.releaseId = releaseIdentity(release);
        const next = structuredClone(this.index);
        next.blobs[blob.id] = blob;
        next.releases[release.releaseId] = release;
        if (!next.selected[releaseKey(release)])
          next.selected[releaseKey(release)] = release.releaseId;
        this.commitIndex(next);
        registered.push(release.releaseId);
      }
    }
    this.emit();
    return registered;
  }
  findLegacyRelease(
    gameId: string,
    variantId: string | undefined,
    tuple: {
      gameVersion: string;
      rulesVersion: string;
      stateVersion: number;
      strategyVersion?: string;
    },
  ): GameRelease | undefined {
    const matches = Object.values(this.index.releases).filter(
      (r) =>
        r.legacy &&
        r.gameId === gameId &&
        r.variantId === (variantId ?? r.module.defaultVariantId) &&
        Object.entries(tuple).every(
          ([key, value]) =>
            value === undefined ||
            r.module.compatibility[
              key as keyof typeof r.module.compatibility
            ] === value,
        ),
    );
    if (matches.length > 1) throw new Error('ambiguous-legacy-release');
    return matches[0] ? structuredClone(matches[0]) : undefined;
  }
  private async download(blob: PackageBlob): Promise<Buffer> {
    const existing = this.downloads.get(blob.id);
    if (existing) return existing;
    const operation = (async () => {
      if (this.activeDownloads >= 2)
        await new Promise<void>((done) => this.slots.push(done));
      else this.activeDownloads++;
      try {
        const needed = [...this.tasks.values()].some((task) => {
          if (task.phase !== 'queued' && task.phase !== 'downloading')
            return false;
          const release =
            this.activeReleases.get(task.releaseId) ??
            this.index.releases[task.releaseId];
          return (
            release && [release.code, ...release.resources].includes(blob.id)
          );
        });
        if (!needed) throw new Error('installation-cancelled');
        if (!this.options.assetUrl) throw new Error('download-not-configured');
        const controller = new AbortController();
        this.controllers.set(blob.id, controller);
        const response = await (this.options.fetch ?? fetch)(
          this.options.assetUrl(blob),
          { signal: controller.signal },
        );
        if (!response.ok || !response.body) throw new Error('download-failed');
        const reader = response.body.getReader(),
          chunks: Buffer[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > blob.archiveBytes) {
            await reader.cancel();
            throw new Error('download-size-mismatch');
          }
          chunks.push(Buffer.from(value));
          this.downloadProgress.set(blob.id, total);
          for (const task of this.tasks.values()) {
            const release =
              this.activeReleases.get(task.releaseId) ??
              this.index.releases[task.releaseId];
            if (task.phase === 'downloading' && release)
              task.transferredBytes = Math.min(
                task.totalBytes,
                [...new Set([release.code, ...release.resources])].reduce(
                  (n, id) => n + (this.downloadProgress.get(id) ?? 0),
                  0,
                ),
              );
          }
          this.emit();
        }
        return Buffer.concat(chunks);
      } finally {
        this.controllers.delete(blob.id);
        const next = this.slots.shift();
        if (next) next();
        else this.activeDownloads--;
      }
    })();
    this.downloads.set(blob.id, operation);
    void operation
      .finally(() => {
        this.downloads.delete(blob.id);
        this.downloadProgress.delete(blob.id);
      })
      .catch(() => {});
    return operation;
  }
  private recover(): void {
    for (const name of readdirSync(join(this.root, '.transactions'))) {
      if (!/^[a-f0-9-]+\.json$/.test(name))
        throw new Error('invalid-install-journal');
      const path = join(this.root, '.transactions', name);
      const txn = JSON.parse(this.readSafe(path).toString()) as {
        gameId: string;
        stage: string;
        blobs: string[];
        index: InstallIndex;
      };
      if (
        !/^[a-z][a-z0-9-]*$/.test(txn.gameId) ||
        !/^[a-f0-9-]+$/.test(txn.stage) ||
        txn.blobs.some((id) => !/^[a-f0-9]{64}$/.test(id))
      )
        throw new Error('invalid-install-journal');
      // Index commit is the only visibility boundary. Incomplete transactions never replace the old selection.
      for (const id of txn.blobs) {
        const target = join(this.root, txn.gameId, 'blobs', id);
        this.assertSafe(target);
      }
      this.assertSafe(path);
      rmSync(path);
      const stage = join(this.root, '.staging', txn.stage);
      this.assertSafe(stage);
      rmSync(stage, { recursive: true, force: true });
    }
  }
  private verifyInstalled(path: string, blob: PackageBlob): void {
    const actual: string[] = [];
    const visit = (directory: string, prefix: string): void => {
      this.assertSafe(directory);
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('store-link-rejected');
        const relative = prefix ? prefix + '/' + entry.name : entry.name;
        if (entry.isDirectory()) visit(join(directory, entry.name), relative);
        else if (entry.isFile()) actual.push(relative);
        else throw new Error('installed-special-file');
      }
    };
    visit(path, '');
    if (
      actual.length !== blob.files.length ||
      actual.some((relative) => !blob.files.some((f) => f.path === relative))
    )
      throw new Error('extra-installed-file');
    for (const file of blob.files) {
      const bytes = this.readSafe(join(path, file.path));
      if (bytes.length !== file.size || sha256(bytes) !== file.sha256)
        throw new Error('installed-package-corrupt');
    }
  }
  private commitIndex(next: InstallIndex): void {
    this.atomicJson(join(this.root, 'index.json'), next);
    this.index = next;
  }
  private readIndex(path: string): InstallIndex {
    const index = JSON.parse(this.readSafe(path).toString()) as InstallIndex;
    if (
      index.schemaVersion !== 1 ||
      !index.releases ||
      !index.blobs ||
      !index.selected
    )
      throw new Error('invalid-install-index');
    validateCatalog({
      schemaVersion: 1,
      releases: Object.values(index.releases),
      blobs: Object.values(index.blobs),
    });
    for (const [id, release] of Object.entries(index.releases))
      if (id !== release.releaseId) throw new Error('invalid-install-index');
    for (const [id, blob] of Object.entries(index.blobs))
      if (id !== blob.id) throw new Error('invalid-install-index');
    for (const [key, id] of Object.entries(index.selected))
      if (!index.releases[id] || releaseKey(index.releases[id]!) !== key)
        throw new Error('invalid-install-selection');
    return index;
  }
  private atomicJson(path: string, value: unknown): void {
    this.assertSafe(path);
    const temporary = path + '.' + randomUUID() + '.tmp';
    const descriptor = openSync(temporary, 'wx');
    try {
      writeFileSync(descriptor, canonical(value));
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, path);
  }
  private readSafe(path: string): Buffer {
    this.assertSafe(path);
    return readFileSync(path);
  }
  private ensureDirectory(path: string): void {
    this.assertSafe(path);
    mkdirSync(path, { recursive: true });
    this.assertSafe(path);
  }
  private assertSafe(path: string): void {
    const absolute = resolve(path);
    if (
      absolute !== this.root &&
      !absolute.startsWith(this.root + requireSeparator())
    )
      throw new Error('store-path-escape');
    let cursor = absolute;
    for (;;) {
      if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink())
        throw new Error('store-link-rejected');
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
}
function requireSeparator(): string {
  return process.platform === 'win32' ? '\\' : '/';
}
