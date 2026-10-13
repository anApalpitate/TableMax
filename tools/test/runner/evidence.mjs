import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
} from 'node:fs';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
export const keyOf = (value) => digest(JSON.stringify(canonical(value)));
export function createFingerprintStage() {
  return {
    cache: new Map(),
    environmentCache: new Map(),
    metrics: {
      reads: 0,
      bytesRead: 0,
      environmentQueries: 0,
      environmentMs: 0,
    },
  };
}
function environmentFacts(providers, stage) {
  const facts = {};
  for (const provider of providers ?? []) {
    if (!['webview2', 'powershell'].includes(provider))
      throw new Error('Unknown environment provider');
    if (process.platform !== 'win32')
      throw new Error('Windows environment required');
    if (stage.environmentCache.has(provider)) {
      facts[provider] = stage.environmentCache.get(provider);
      continue;
    }
    const command =
      provider === 'powershell'
        ? '$PSVersionTable.PSVersion.ToString()'
        : "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\EdgeUpdate\\Clients\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\*','HKLM:\\Software\\Microsoft\\EdgeUpdate\\Clients\\*' -ErrorAction SilentlyContinue | Where-Object { $_.name -match 'WebView2' } | Select-Object -ExpandProperty pv -Unique; exit 0";
    const started = performance.now();
    const value = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { encoding: 'utf8', windowsHide: true, timeout: 15000 },
    ).trim();
    stage.metrics.environmentQueries++;
    stage.metrics.environmentMs += performance.now() - started;
    if (!value)
      throw new Error(
        'Necessary environment condition unavailable: ' + provider,
      );
    facts[provider] = value.split(/\r?\n/).sort();
    stage.environmentCache.set(provider, facts[provider]);
  }
  return facts;
}
export function localFile(root, path) {
  root = realpathSync(root);
  const absolute = resolve(root, path),
    name = relative(root, absolute);
  if (!name || name === '..' || name.startsWith('..' + sep) || isAbsolute(name))
    throw new Error('Input or evidence escapes workspace: ' + path);
  for (let cursor = absolute; cursor !== root; cursor = dirname(cursor)) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink())
      throw new Error('Linked input or evidence rejected: ' + path);
  }
  return absolute;
}
export function atomicJson(root, path, value) {
  const target = localFile(root, path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + '.' + randomUUID() + '.tmp';
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
  });
  renameSync(temporary, target);
}
export function fileRecord(root, path) {
  const absolute = localFile(root, path);
  if (!lstatSync(absolute).isFile())
    throw new Error('Expected regular file: ' + path);
  const bytes = readFileSync(absolute);
  return {
    path: relative(root, absolute).replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: digest(bytes),
  };
}

// One inventory per planning pass; imports are expanded, runtime-loaded data is declared explicitly.
export function fingerprint(root, item, options = {}) {
  const stage = options.stage ?? createFingerprintStage();
  if (options.cache) stage.cache = options.cache;
  const { cache } = stage;
  const started = performance.now(),
    files = new Map(),
    gaps = [];
  const metricsBefore = { ...stage.metrics };
  function read(path) {
    const absolute = localFile(root, path);
    if (!cache.has(absolute)) {
      if (!lstatSync(absolute).isFile())
        throw new Error('Expected regular file: ' + path);
      const bytes = readFileSync(absolute);
      stage.metrics.reads++;
      stage.metrics.bytesRead += bytes.length;
      cache.set(absolute, {
        record: {
          path: relative(root, absolute).replaceAll('\\', '/'),
          bytes: bytes.length,
          sha256: digest(bytes),
        },
        source: /\.(?:[cm]?js|tsx?|json)$/.test(absolute)
          ? bytes.toString('utf8')
          : undefined,
      });
    }
    return cache.get(absolute);
  }
  const compilerOptions = existsSync(resolve(root, 'tsconfig.json'))
    ? ts.convertCompilerOptionsFromJson(
        JSON.parse(read('tsconfig.json').source).compilerOptions,
        root,
      ).options
    : {};
  compilerOptions.moduleResolution = ts.ModuleResolutionKind.Bundler;
  function visit(path) {
    const absolute = localFile(root, path);
    if (files.has(absolute)) return;
    const { record, source } = read(absolute);
    files.set(absolute, record);
    if (!/\.(?:[cm]?js|tsx?)$/.test(absolute)) return;
    const requests = new Set(
      ts
        .preProcessFile(source, true, true)
        .importedFiles.map((entry) => entry.fileName),
    );
    for (const match of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g))
      requests.add(match[1]);
    for (const request of requests) {
      if (request.startsWith('node:')) continue;
      const found = ts.resolveModuleName(
        request,
        absolute,
        compilerOptions,
        ts.sys,
      ).resolvedModule?.resolvedFileName;
      if (found && !found.includes('node_modules')) visit(found);
      if (request.startsWith('.')) {
        const literal = resolve(dirname(absolute), request.split('?')[0]);
        if (existsSync(literal) && lstatSync(literal).isFile()) visit(literal);
        else if (!found)
          gaps.push('Unresolved import: ' + record.path + ' -> ' + request);
      } else if (!found && request.startsWith('@tablemax/'))
        gaps.push('Unresolved workspace dependency: ' + request);
    }
  }
  function tree(path) {
    const directory = localFile(root, path);
    if (!lstatSync(directory).isDirectory())
      throw new Error('Expected input directory: ' + path);
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (entry.name === '.git' || entry.name === 'node_modules')
        throw new Error(
          'Nested repository or dependencies in declared input tree',
        );
      const child = resolve(directory, entry.name);
      if (entry.isDirectory()) tree(child);
      else visit(child);
    }
  }
  visit(item.script);
  if (item.delivery) {
    if (!['full', 'box'].includes(item.delivery.edition))
      throw new Error('Invalid delivery edition');
    const pointer =
      item.delivery.pointer ??
      'artifacts/package-payloads/v' +
        JSON.parse(read('package.json').source).version +
        '/current.json';
    visit(pointer);
    const index = JSON.parse(read(pointer).source);
    const delivery = index.deliveries.find(
      (value) => value.edition === item.delivery.edition,
    );
    if (!delivery) throw new Error('Delivery edition not present');
    for (const path of [
      delivery.executable.path,
      delivery.archivePath,
      delivery.manifestPath,
    ])
      visit(path);
    if (
      read(delivery.executable.path).record.sha256 !==
        delivery.executable.sha256 ||
      read(delivery.archivePath).record.sha256 !==
        delivery.executable.payloadSha256
    )
      throw new Error('Current delivery bytes do not match pointer');
  }
  for (const path of item.inputs?.files ?? []) visit(path);
  for (const path of item.inputs?.directories ?? []) tree(path);
  for (const path of [
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.json',
    '.node-version',
    'global.json',
  ])
    if (existsSync(resolve(root, path))) visit(path);
  if (item.inputs?.complete !== true)
    gaps.push('Runtime data/resource dependency declaration is incomplete');
  if (item.delivery && !(item.environmentProviders ?? []).includes('webview2'))
    gaps.push(
      'Actual EXE evidence requires current WebView2 environment binding',
    );
  if (
    item.runtime === 'powershell' &&
    !(item.environmentProviders ?? []).includes('powershell')
  )
    gaps.push('PowerShell version binding is missing');
  const value = {
    format: 1,
    method: ['evidence.mjs', 'plan.mjs', 'run-plan.mjs'].map((name) => {
      const path = fileURLToPath(new URL(name, import.meta.url));
      const within = relative(root, path);
      if (!within.startsWith('..' + sep) && !isAbsolute(within))
        return { name, sha256: read(path).record.sha256 };
      const methodKey = 'method:' + path;
      if (!cache.has(path) && !cache.has(methodKey)) {
        const bytes = readFileSync(path);
        stage.metrics.reads++;
        stage.metrics.bytesRead += bytes.length;
        cache.set(methodKey, { record: { sha256: digest(bytes) } });
      }
      return {
        name,
        sha256: (cache.get(path) ?? cache.get(methodKey)).record.sha256,
      };
    }),
    command: {
      runtime: item.runtime,
      script: item.script.replaceAll('\\', '/'),
      args: item.args,
      nodeArgs: item.nodeArgs ?? [],
    },
    combination: item.combination ?? {},
    evidenceRequirements: {
      resultFile: item.resultFile ?? null,
      files: item.evidence ?? [],
    },
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)),
    environment: {
      declared: item.environment ?? {},
      providers: environmentFacts(item.environmentProviders, stage),
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      osRelease: release(),
      sound: 'off',
      runtimeFiles: (item.runtimeFiles ?? []).map((path) => ({
        path,
        sha256: digest(readFileSync(path)),
      })),
      variables: Object.fromEntries(
        (item.envKeys ?? []).map((key) => [key, process.env[key] ?? null]),
      ),
    },
    gaps,
  };
  return {
    key: keyOf(value),
    value,
    durationMs: performance.now() - started,
    metrics: Object.fromEntries(
      Object.keys(stage.metrics).map((key) => [
        key,
        stage.metrics[key] - metricsBefore[key],
      ]),
    ),
    reusable: gaps.length === 0,
  };
}

export class EvidenceIndex {
  constructor(root, directory = 'artifacts/maintenance/test-history/evidence') {
    this.root = root;
    this.directory = directory;
  }
  find(binding) {
    if (!binding.reusable) return { reason: binding.value.gaps.join('; ') };
    const path = `${this.directory}/${binding.key}.json`;
    try {
      const proof = JSON.parse(
        readFileSync(localFile(this.root, path), 'utf8'),
      );
      if (
        proof.format !== 1 ||
        proof.status !== 'passed' ||
        proof.complete !== true ||
        proof.key !== binding.key ||
        keyOf(proof.binding) !== binding.key
      )
        throw new Error('Incomplete or mismatched proof');
      if (!proof.artifacts?.length)
        throw new Error('Missing evidence artifacts');
      for (const artifact of proof.artifacts)
        if (
          JSON.stringify(fileRecord(this.root, artifact.path)) !==
          JSON.stringify(artifact)
        )
          throw new Error('Evidence content changed');
      return {
        proof,
        path,
        reason:
          'Relevant content, method, parameters, environment and evidence hashes match',
      };
    } catch (error) {
      return {
        reason:
          error.code === 'ENOENT'
            ? 'No complete hash-bound proof'
            : 'Rejected evidence: ' + error.message,
      };
    }
  }
  save(binding, artifacts, details = {}) {
    if (!binding.reusable) return;
    const proof = {
      format: 1,
      key: binding.key,
      binding: binding.value,
      status: 'passed',
      complete: true,
      finishedAt: new Date().toISOString(),
      artifacts: artifacts.map((path) => fileRecord(this.root, path)),
      details,
    };
    atomicJson(this.root, `${this.directory}/${binding.key}.json`, proof);
    return proof;
  }
  importAudited(binding, path) {
    // A legacy summary or caller-supplied current fingerprint is not an audit.
    const audit = JSON.parse(readFileSync(localFile(this.root, path), 'utf8'));
    if (
      audit.format !== 1 ||
      audit.status !== 'passed' ||
      audit.complete !== true ||
      keyOf(audit.binding) !== binding.key ||
      !audit.artifacts?.length ||
      !audit.original
    )
      throw new Error(
        'Legacy audit cannot establish original inputs, method and environment',
      );
    const original = JSON.parse(
      readFileSync(localFile(this.root, audit.original), 'utf8'),
    );
    if (
      !['passed'].includes(original.status ?? original.result) ||
      original.complete !== true ||
      original.failures ||
      !original.binding ||
      keyOf(original.binding) !== binding.key ||
      !audit.artifacts.some((artifact) => artifact.path === audit.original)
    )
      throw new Error(
        'Original evidence does not establish the audited binding',
      );
    for (const artifact of audit.artifacts)
      if (
        JSON.stringify(fileRecord(this.root, artifact.path)) !==
        JSON.stringify(artifact)
      )
        throw new Error('Audited evidence hash mismatch');
    return this.save(
      binding,
      [path, ...audit.artifacts.map((file) => file.path)],
      { importedAudit: path },
    );
  }
}
