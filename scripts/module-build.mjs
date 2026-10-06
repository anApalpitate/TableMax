import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';
import react from '@vitejs/plugin-react';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  stat,
  copyFile,
  rename,
  rm,
  open,
  access,
} from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { prepareDesktop, execute, nodeRuntime } from './setup-desktop.mjs';
import { packService } from './service-brotli.mjs';

export const root = resolve('.');
const cache = resolve('.cache/build-modules/v1');
const require = createRequire(import.meta.url);
const { globSync } = createRequire(require.resolve('vite/package.json'))(
  'tinyglobby',
);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const posix = (value) => value.replaceAll('\\', '/');
const external = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  '@tablemax/web-host',
];
const runtimeNames = {
  react: 'react',
  'react/jsx-runtime': 'jsx-runtime',
  'react/jsx-dev-runtime': 'jsx-dev-runtime',
  'react-dom': 'react-dom',
  'react-dom/client': 'react-dom-client',
  '@tablemax/web-host': 'web-host',
};
const runtimePaths = Object.fromEntries(
  external.map((id) => [id, `/runtime/v1/${runtimeNames[id]}.js`]),
);
export async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
export async function inventory(directory) {
  const records = [];
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new Error('Linked output rejected: ' + entry.name);
      const file = join(folder, entry.name);
      if (entry.isDirectory()) await visit(file);
      else
        records.push({
          path: posix(relative(directory, file)),
          bytes: (await stat(file)).size,
          sha256: hash(await readFile(file)),
        });
    }
  }
  await visit(directory);
  return records.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
// Node can reject a Windows cache-directory rename that the native move accepts.
async function renameCache(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (
        process.platform !== 'win32' ||
        !['EPERM', 'EBUSY'].includes(error.code) ||
        attempt >= 5
      ) {
        if (process.platform === 'win32' && error.code === 'EPERM') {
          await execute('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-File',
            resolve('scripts/Move-BuildCache.ps1'),
            '-Source',
            resolve(from),
            '-Destination',
            resolve(to),
          ]);
          return;
        }
        throw error;
      }
      await new Promise((resolveWait) =>
        setTimeout(resolveWait, 100 * 2 ** attempt),
      );
    }
  }
}
export async function discover() {
  const items = [];
  for (const entry of await readdir('games', { withFileTypes: true })) {
    const file = resolve('games', entry.name, 'game-module.json');
    if (!entry.isDirectory()) continue;
    try {
      await access(file);
    } catch {
      continue;
    }
    const item = await json(file);
    if (
      item.schemaVersion !== 1 ||
      item.id !== entry.name ||
      !/^[a-z][a-z0-9-]*$/.test(item.id) ||
      item.catalog.id !== item.id ||
      item.compatibility.sdk !== 1 ||
      item.compatibility.protocol !== 7 ||
      item.compatibility.webHost !== 1
    )
      throw new Error('Invalid or incompatible module ' + entry.name);
    for (const [part, input] of Object.entries(item.entries))
      if (
        !input.startsWith(`games/${item.id}/`) ||
        input.includes('..') ||
        input.includes('\\') ||
        !['rules', 'bot', 'web'].includes(part)
      )
        throw new Error('Invalid source entry ' + input);
    if (
      item.cover &&
      (!item.cover.startsWith(`assets/games/${item.id}/`) ||
        item.cover.includes('..') ||
        item.cover.includes('\\'))
    )
      throw new Error('Invalid catalog cover');
    if (
      !['rules', 'bot', 'web'].every(
        (part) => typeof item.entries[part] === 'string',
      )
    )
      throw new Error('Incomplete game entries');
    if (typeof item.compatibility.strategyVersion !== 'string')
      throw new Error('Missing strategy compatibility');
    for (const key of [
      'payloadBytes',
      'serviceHeapBytes',
      'desktopHeapBytes',
      'phoneHeapBytes',
      'privateIncrementBytes',
      'workerOldGenerationMiB',
    ])
      if (!Number.isSafeInteger(item.budgets?.[key]) || item.budgets[key] <= 0)
        throw new Error('Game budgets must be declared: ' + item.id);
    items.push(item);
  }
  return items.sort((a, b) => a.order - b.order);
}
export async function lock(name, operation) {
  await mkdir(cache, { recursive: true });
  if (name !== 'build-cache-maintenance') {
    try {
      await access(join(cache, hash('build-cache-maintenance') + '.lock'));
      throw new Error('Build cache maintenance busy');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const path = join(cache, hash(name) + '.lock');
  let handle;
  try {
    handle = await open(path, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error('Build unit busy: ' + name, { cause: error });
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, name }));
    return await operation();
  } finally {
    await handle.close();
    await rm(path);
  }
}
// Track source imports, type-only dependencies, CSS and each newly expanded glob.
async function inputsFor(unit) {
  const files = new Set(),
    globs = [];
  const options = {
    ...ts.convertCompilerOptionsFromJson(
      (await json('tsconfig.json')).compilerOptions,
      root,
    ).options,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
  };
  async function visit(file) {
    file = resolve(file);
    if (files.has(file)) return;
    await access(file);
    files.add(file);
    if (!/\.(tsx?|jsx?|mjs|css)$/.test(file)) return;
    let source = await readFile(file, 'utf8');
    if (
      unit.id === 'platform-box' &&
      file.endsWith('game-clients' + require('node:path').sep + 'registry.ts')
    )
      source = source.replace(
        /const development = import\.meta\.glob<ClientExports>\([\s\S]*?\);/,
        '',
      );
    if (
      unit.id === 'platform-box' &&
      file.endsWith('catalog.ts') &&
      file.includes('apps' + require('node:path').sep + 'web')
    )
      return;
    const syntax = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    const typeOnly = new Set(
      syntax.statements
        .filter(
          (node) =>
            ts.isImportDeclaration(node) && node.importClause?.isTypeOnly,
        )
        .map((node) => node.moduleSpecifier.text),
    );
    const requests = ts
      .preProcessFile(source, true, true)
      .importedFiles.map((item) => item.fileName)
      .filter((item) => !typeOnly.has(item));
    for (const match of source.matchAll(
      /(?:@import\s+|url\()\s*['"]?([^'"\s)]+)['"]?/g,
    ))
      if (!match[1].startsWith('data:') && !match[1].startsWith('#'))
        requests.push(match[1]);
    for (const request of requests) {
      if (external.includes(request) && unit.id !== 'platform-runtime')
        continue;
      const resolved = ts.resolveModuleName(request, file, options, ts.sys)
        .resolvedModule?.resolvedFileName;
      if (resolved && !resolved.includes('node_modules')) await visit(resolved);
      // TypeScript can resolve a JS request to an adjacent declaration. Both
      // files affect a reproducible build: the declaration and the runtime JS.
      if (request.startsWith('.')) {
        const candidate = resolve(dirname(file), request.split('?')[0]);
        try {
          if ((await stat(candidate)).isFile()) await visit(candidate);
        } catch {
          /* Non-file CSS tokens. */
        }
      }
    }
    const calls = [];
    const scan = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'glob' &&
        ts.isMetaProperty(node.expression.expression)
      )
        calls.push(node);
      ts.forEachChild(node, scan);
    };
    scan(syntax);
    for (const call of calls) {
      const argument = call.arguments[0];
      const literals =
        argument && ts.isArrayLiteralExpression(argument)
          ? argument.elements
          : [argument];
      if (
        !literals.length ||
        literals.some((item) => !item || !ts.isStringLiteralLike(item))
      )
        throw new Error('Glob must use literal strings: ' + file);
      const patterns = literals.map((item) => {
        const value = item.text,
          negative = value.startsWith('!'),
          pattern = negative ? value.slice(1) : value;
        return (
          (negative ? '!' : '') +
          posix(
            resolve(
              pattern.startsWith('/')
                ? unit.id === 'platform-box'
                  ? resolve('apps/web')
                  : root
                : dirname(file),
              pattern.startsWith('/') ? pattern.slice(1) : pattern,
            ),
          )
        );
      });
      const matches = globSync(patterns, {
        absolute: true,
        onlyFiles: true,
      }).sort();
      globs.push({
        patterns: patterns.map((pattern) =>
          pattern.startsWith('!')
            ? '!' + posix(relative(root, pattern.slice(1)))
            : posix(relative(root, pattern)),
        ),
        matches: matches.map((file) => posix(relative(root, file))),
      });
      for (const matchFile of matches) await visit(matchFile);
    }
  }
  for (const file of unit.inputs) await visit(file);
  for (const file of [
    'pnpm-lock.yaml',
    'package.json',
    'tsconfig.json',
    'global.json',
    'scripts/module-build.mjs',
    'scripts/Move-BuildCache.ps1',
    'packages/game-sdk/src/index.ts',
    'packages/protocol/src/index.ts',
    'packages/web-host/src/types.ts',
  ])
    await visit(file);
  if (unit.id === 'platform-native') {
    for (const file of globSync(
      ['apps/desktop/native/**/*', 'assets/platform/app-icon.ico'],
      { onlyFiles: true, ignore: ['**/bin/**', '**/obj/**'] },
    ))
      await visit(file);
  }
  const entries = [];
  for (const file of [...files].sort())
    entries.push({
      path: posix(relative(root, file)),
      sha256: hash(await readFile(file)),
    });
  return {
    files: entries,
    globs,
    compatibility: unit.module?.compatibility,
    toolchain: {
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      repository: unit.id === 'platform-native' ? root : undefined,
    },
  };
}
export async function validateCached(directory) {
  const manifest = await json(join(directory, 'manifest.json'));
  if (
    manifest.schemaVersion !== 1 ||
    hash(JSON.stringify(manifest.inputs)) !== manifest.fingerprint ||
    !directory.endsWith(manifest.fingerprint)
  )
    throw new Error('Invalid cache manifest: ' + directory);
  if (
    JSON.stringify(await inventory(join(directory, 'files'))) !==
    JSON.stringify(manifest.files)
  )
    throw new Error('Corrupt build cache: ' + directory);
  return manifest;
}
export async function validateInputs(record) {
  for (const file of record.inputs.files)
    if (hash(await readFile(resolve(root, file.path))) !== file.sha256)
      throw new Error('Inputs changed before snapshot: ' + record.id);
  for (const item of record.inputs.globs) {
    const matches = globSync(
      (item.patterns ?? [item.pattern]).map((pattern) =>
        pattern.startsWith('!')
          ? '!' + posix(resolve(root, pattern.slice(1)))
          : posix(resolve(root, pattern)),
      ),
      {
        absolute: true,
        onlyFiles: true,
      },
    )
      .sort()
      .map((file) => posix(relative(root, file)));
    if (JSON.stringify(matches) !== JSON.stringify(item.matches))
      throw new Error('Glob changed before snapshot: ' + record.id);
  }
}
const catalogPlugin = {
  name: 'assembled-catalog',
  enforce: 'pre',
  transform(code, id) {
    if (posix(id).endsWith('/apps/web/src/assets/avatars.ts'))
      return "export {avatarFor,avatarChoices} from '@tablemax/web-host';";
    const sharedComponents = {
      ScreenLink: 'ScreenLink',
      OverlayPanel: 'OverlayPanel',
      FullscreenControl: 'FullscreenControl',
      DisplaySettings: 'DisplaySettings',
      PlayModeBadge: 'PlayModeBadge',
      DecisionCountdown: 'DecisionCountdown',
      RulesGuide: 'RulesGuide',
      useDecisionClock: 'useDecisionClock',
      BeginnerGuidanceSetting: 'BeginnerGuidanceSetting',
      RoomManagement: 'PlatformRoomManagement',
      SessionFeedback: 'PlatformSessionFeedback',
      PlayModeControl: 'PlatformPlayModeControl',
      CountdownSettings: 'PlatformCountdownSettings',
    };
    for (const [name, exported] of Object.entries(sharedComponents))
      if (
        posix(id).endsWith(
          `/apps/web/src/components/${name}.${name === 'useDecisionClock' ? 'ts' : 'tsx'}`,
        )
      )
        return `export {${exported} as ${name}} from '@tablemax/web-host';`;
    if (posix(id).endsWith('/apps/web/src/catalog.ts'))
      return `const response=await fetch('/catalog.json');if(!response.ok)throw new Error('Game catalog unavailable');export const moduleCatalog=await response.json();export const moduleFor=id=>moduleCatalog.find(item=>item.id===id);`;
    if (posix(id).endsWith('/apps/web/src/game-clients/registry.ts')) {
      const first = code.indexOf('const development');
      const end = code.indexOf('const loaded');
      return code.slice(0, first) + 'const development={};\n' + code.slice(end);
    }
  },
};
async function webBuild(unit, out) {
  const webRequire = createRequire(resolve('apps/web/package.json'));
  const aliases =
    unit.id === 'platform-runtime'
      ? external
          .filter((id) => id !== '@tablemax/web-host')
          .map((id) => ({
            find: new RegExp('^' + id.replaceAll('/', '\\/') + '$'),
            replacement: webRequire.resolve(id),
          }))
      : [];
  const shared = {
    configFile: false,
    plugins: [react(), ...(unit.id === 'platform-box' ? [catalogPlugin] : [])],
    resolve: { alias: aliases },
    logLevel: 'warn',
    base: './',
    build: {
      outDir: out,
      emptyOutDir: true,
      target: ['chrome110', 'safari16'],
      assetsInlineLimit: 0,
      manifest: true,
      cssCodeSplit: true,
      rolldownOptions: {
        external: unit.id === 'platform-runtime' ? [] : external,
        preserveEntrySignatures: 'strict',
        output: { paths: runtimePaths },
      },
    },
  };
  if (unit.id === 'platform-box')
    return vite({ ...shared, base: '/', root: resolve('apps/web') });
  const entry =
    unit.id === 'platform-runtime'
      ? Object.fromEntries(
          Object.entries(runtimeNames).map(([id, name]) => [
            name,
            id === '@tablemax/web-host'
              ? resolve('packages/web-host/src/index.tsx')
              : join(unit.temp, 'entries', name + '.ts'),
          ]),
        )
      : unit.entry;
  if (unit.id === 'platform-runtime') {
    await mkdir(join(unit.temp, 'entries'), { recursive: true });
    for (const [id, name] of Object.entries(runtimeNames))
      if (id !== '@tablemax/web-host') {
        const names = Object.keys(webRequire(id)).filter(
          (key) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) && key !== 'default',
        );
        await writeFile(
          join(unit.temp, 'entries', name + '.ts'),
          `import runtime from '${id}';export const {${names.join(',')}}=runtime;${id === 'react' ? 'export default runtime;' : ''}`,
        );
      }
  }
  shared.build.rolldownOptions.input = entry;
  shared.build.rolldownOptions.output.entryFileNames =
    unit.id === 'platform-runtime' ? '[name].js' : 'entry.js';
  return vite({ ...shared, root });
}
async function compile(unit, out) {
  if (unit.kind === 'web') return webBuild(unit, out);
  if (unit.kind === 'node') {
    const result = await esbuild({
      entryPoints: [unit.entry],
      outfile: join(out, unit.output),
      bundle: true,
      minify: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      metafile: true,
      logLevel: 'warning',
    });
    if (unit.id === 'platform-server')
      await packService(join(out, unit.output));
    return result;
  }
  if (unit.kind === 'metadata') {
    const item = unit.module;
    if (
      JSON.stringify(
        await json(resolve('games', item.id, 'game-module.json')),
      ) !== JSON.stringify(item)
    )
      throw new Error('Module descriptor changed during build: ' + item.id);
    await writeFile(
      join(out, 'module.json'),
      JSON.stringify(item, null, 2) + '\n',
    );
    if (item.cover)
      await copyFile(resolve(item.cover), join(out, 'cover.webp'));
    return;
  }
  if (unit.kind === 'runtime') {
    await lock('desktop-tools', prepareDesktop);
    for (const file of ['node.exe', 'LICENSE'])
      await copyFile(
        join(nodeRuntime, file),
        join(out, file === 'LICENSE' ? 'Node-LICENSE.txt' : file),
      );
    return;
  }
  if (unit.kind === 'native') {
    await lock('desktop-tools', async () => {
      await prepareDesktop();
      const intermediate = join(unit.temp, 'obj') + '/';
      await execute(
        'dotnet',
        [
          'build',
          resolve('apps/desktop/native/TableMax.csproj'),
          '--configuration',
          'Release',
          '--source',
          resolve('.cache/nuget-downloads'),
          '-p:RestoreLockedMode=true',
          '-p:IncludeSourceRevisionInInformationalVersion=false',
          `-p:OutputPath=${out}/`,
          `-p:BaseIntermediateOutputPath=${intermediate}`,
        ],
        {
          env: {
            ...process.env,
            DOTNET_CLI_HOME: resolve('.cache/dotnet-home'),
            DOTNET_NOLOGO: '1',
            DOTNET_CLI_TELEMETRY_OPTOUT: '1',
          },
        },
      );
      for (const file of ['LICENSE.txt', 'NOTICE.txt'])
        await copyFile(
          resolve('.cache/nuget/microsoft.web.webview2/1.0.4258.31', file),
          join(out, 'WebView2-' + file),
        );
      const loader = join(out, 'runtimes/win-x64/native/WebView2Loader.dll');
      await copyFile(loader, join(out, 'WebView2Loader.dll'));
      const keep = new Set([
        'TableMax.exe',
        'TableMax.exe.config',
        'Microsoft.Web.WebView2.Core.dll',
        'Microsoft.Web.WebView2.WinForms.dll',
        'WebView2Loader.dll',
        'WebView2-LICENSE.txt',
        'WebView2-NOTICE.txt',
      ]);
      for (const item of await readdir(out))
        if (!keep.has(item))
          await rm(join(out, item), { recursive: true, force: true });
    });
  }
}
export async function buildUnit(unit, full = false) {
  if (!/^[a-z][a-z0-9-]*$/.test(unit.id))
    throw new Error('Invalid build unit id');
  const inputs = await inputsFor(unit),
    fingerprint = hash(JSON.stringify(inputs)),
    directory = join(cache, unit.id, fingerprint);
  return lock(unit.id, async () => {
    if (!full)
      try {
        const manifest = await validateCached(directory);
        return { ...manifest, directory, cached: true };
      } catch {
        /* Continue independently. */
      }
    const temp = join(
      cache,
      'work',
      unit.id + '-' + process.pid + '-' + Date.now(),
    );
    if (!resolve(temp).startsWith(cache + require('node:path').sep))
      throw new Error('Temporary output outside build cache');
    await mkdir(join(temp, 'files'), { recursive: true });
    unit.temp = temp;
    const started = performance.now();
    try {
      await compile(unit, join(temp, 'files'));
      await rm(join(temp, 'files', '.vite'), { recursive: true, force: true });
      if (hash(JSON.stringify(await inputsFor(unit))) !== fingerprint)
        throw new Error('Inputs changed during build: ' + unit.id);
      const manifest = {
        schemaVersion: 1,
        id: unit.id,
        compatibility: unit.module?.compatibility,
        fingerprint,
        inputs,
        files: await inventory(join(temp, 'files')),
        durationMs: Math.round(performance.now() - started),
      };
      await writeFile(
        join(temp, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
      );
      await mkdir(dirname(directory), { recursive: true });
      // A successful forced rebuild replaces the same key only after validation.
      const previous = directory + '.previous-' + process.pid;
      try {
        await renameCache(directory, previous);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      try {
        await renameCache(temp, directory);
      } catch (error) {
        try {
          await renameCache(previous, directory);
        } catch {
          /* No previous cache. */
        }
        throw error;
      }
      await rm(previous, { recursive: true, force: true });
      return { ...manifest, directory, cached: false };
    } catch (error) {
      await rm(temp, { recursive: true, force: true });
      throw error;
    }
  });
}
export async function unitsFor(modules) {
  const units = [
    {
      id: 'platform-runtime',
      kind: 'web',
      inputs: ['packages/web-host/src/index.tsx'],
    },
    {
      id: 'platform-box',
      kind: 'web',
      inputs: [
        'apps/web/src/main.tsx',
        'apps/web/index.html',
        'apps/web/vite.config.ts',
      ],
    },
    {
      id: 'platform-server',
      kind: 'node',
      entry: 'apps/server/src/entry.ts',
      output: 'server.cjs',
      inputs: ['apps/server/src/entry.ts'],
    },
    {
      id: 'platform-worker',
      kind: 'node',
      entry: 'apps/server/src/bot-worker.ts',
      output: 'bot-worker.cjs',
      inputs: ['apps/server/src/bot-worker.ts'],
    },
    {
      id: 'platform-node',
      kind: 'runtime',
      inputs: ['scripts/setup-desktop.mjs'],
    },
    {
      id: 'platform-native',
      kind: 'native',
      inputs: ['apps/desktop/native/TableMax.csproj'],
    },
  ];
  for (const item of modules) {
    for (const part of ['rules', 'bot', 'web'])
      units.push({
        id: `game-${item.id}-${part}`,
        kind: part === 'web' ? 'web' : 'node',
        entry: item.entries[part],
        output: `${item.id}.cjs`,
        module: item,
        inputs: [item.entries[part], `games/${item.id}/package.json`],
      });
    units.push({
      id: `game-${item.id}-metadata`,
      kind: 'metadata',
      module: item,
      inputs: [
        `games/${item.id}/game-module.json`,
        ...(item.cover ? [item.cover] : []),
      ],
    });
  }
  return units;
}
