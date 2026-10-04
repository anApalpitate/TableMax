import { build } from 'esbuild';
import { build as buildWeb } from 'vite';
import { mkdir, writeFile, readFile, copyFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { prepareDesktop, nodeRuntime, execute } from './setup-desktop.mjs';

const output = resolve('build/desktop');
const project = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir(output, { recursive: true });
await buildWeb({ configFile: resolve('apps/web/vite.config.ts') });
const gameModules = {
  '../../../games/power-grid': './games/power-grid.cjs',
  '../../../games/power-grid/bot': './bots/power-grid.cjs',
  '../../../games/modern-art': './games/modern-art.cjs',
  '../../../games/modern-art/bot': './bots/modern-art.cjs',
  '../../../games/pokemon-encounters': './games/pokemon-encounters.cjs',
  '../../../games/template': './games/template.cjs',
  '../../../games/pokemon-encounters/bot': './bots/pokemon-encounters.cjs',
  '../../../games/template/bot': './bots/template.cjs',
};
const lazyGames = {
  name: 'local-game-modules',
  setup(builder) {
    builder.onResolve(
      {
        filter:
          /games\/(pokemon-encounters|modern-art|power-grid|template)(\/bot)?$/,
      },
      (args) =>
        gameModules[args.path]
          ? { path: gameModules[args.path], external: true }
          : null,
    );
  },
};
await build({
  entryPoints: {
    'games/power-grid': 'games/power-grid/index.ts',
    'bots/power-grid': 'games/power-grid/bot/index.ts',
    'games/modern-art': 'games/modern-art/index.ts',
    'bots/modern-art': 'games/modern-art/bot/index.ts',
    'games/pokemon-encounters': 'games/pokemon-encounters/index.ts',
    'games/template': 'games/template/index.ts',
    'bots/pokemon-encounters': 'games/pokemon-encounters/bot/index.ts',
    'bots/template': 'games/template/bot/index.ts',
  },
  outdir: output,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
});
await build({
  entryPoints: ['apps/server/src/entry.ts'],
  outfile: `${output}/server.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
  plugins: [lazyGames],
});
await build({
  entryPoints: ['apps/server/src/bot-worker.ts'],
  outfile: `${output}/bot-worker.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
  plugins: [lazyGames],
});
await prepareDesktop();
await execute(
  'dotnet',
  [
    'build',
    resolve('apps/desktop/native/TableMax.csproj'),
    '--configuration',
    'Release',
    '--no-restore',
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
for (const file of [
  'TableMax.exe',
  'TableMax.exe.config',
  'Microsoft.Web.WebView2.Core.dll',
  'Microsoft.Web.WebView2.WinForms.dll',
])
  await copyFile(join('build/native', file), join(output, file));
let loader;
for (const candidate of [
  resolve('build/native/runtimes/win-x64/native/WebView2Loader.dll'),
  resolve('build/native/WebView2Loader.dll'),
]) {
  try {
    await access(candidate);
    loader = candidate;
    break;
  } catch {
    /* Inspect the next SDK output location. */
  }
}
if (!loader) throw new Error('Native x64 WebView2Loader.dll is missing');
await copyFile(loader, join(output, 'WebView2Loader.dll'));
await copyFile(join(nodeRuntime, 'node.exe'), join(output, 'node.exe'));
await copyFile(join(nodeRuntime, 'LICENSE'), join(output, 'Node-LICENSE.txt'));
for (const file of ['LICENSE.txt', 'NOTICE.txt'])
  await copyFile(
    resolve('.cache/nuget/microsoft.web.webview2/1.0.4258.31', file),
    join(output, 'WebView2-' + file),
  );
await writeFile(
  `${output}/package.json`,
  JSON.stringify(
    {
      name: 'tablemax-desktop',
      version: project.version,
      private: true,
      description: 'TableMax local board-game platform',
      author: 'TableMax',
      license: 'UNLICENSED',
      desktopRuntime: 'net48-webview2',
      nodeVersion: '22.14.0',
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  join(output, '.tablemax-development.json'),
  JSON.stringify(
    { version: 1, repositoryRoot: resolve('.'), outputDirectory: output },
    null,
    2,
  ) + '\n',
);
console.log(
  'Built native WebView2 shell, official Node service, and local web assets.',
);
