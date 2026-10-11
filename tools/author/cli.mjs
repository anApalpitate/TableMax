#!/usr/bin/env node
import { mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { checkAuthorProject } from './contract.mjs';
import { buildAuthorProject } from './build.mjs';
import { verifyAuthorContract } from './harness.mjs';
import { runIsolatedDevelopment } from './isolated-dev.mjs';
import { createBlob } from '../release/game-package-format.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const [command, directory, ...args] = process.argv.slice(2);
if (
  !directory ||
  args.some((arg) => !arg.startsWith('--platform=') && arg !== '--no-browser')
)
  throw new Error(
    'Usage: tablemax-author create|check|build|verify|package|dev <directory> [--platform=<frozen runtime>] [--no-browser]',
  );
if (command === 'create') {
  const target = resolve(directory);
  await mkdir(target, { recursive: false });
  await cp(resolve(here, 'template'), target, { recursive: true });
  await cp(resolve(here, 'public'), resolve(target, 'public'), {
    recursive: true,
  });
  const freeze = JSON.parse(
    await readFile(resolve(here, 'toolkit-manifest.json'), 'utf8'),
  );
  await writeFile(
    resolve(target, 'public-freeze.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        files: freeze.files.filter((file) => file.path.startsWith('public/')),
      },
      null,
      2,
    ),
  );
  const packageJson = {
    name: 'tablemax-author-example',
    version: '1.0.0',
    private: true,
    type: 'module',
    dependencies: {
      '@tablemax/game-sdk': 'file:./public/game-sdk',
      '@tablemax/protocol': 'file:./public/protocol',
      '@tablemax/web-host': 'file:./public/web-host',
      react: '19.3.0',
      'react-dom': '19.3.0',
    },
    devDependencies: {
      '@types/react': '19.3.0',
      '@types/react-dom': '19.3.0',
      typescript: '5.9.3',
    },
    overrides: { csstype: '3.2.3', scheduler: '0.28.0' },
  };
  await writeFile(
    resolve(target, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  );
  await writeFile(
    resolve(target, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['games/**/*.ts', 'games/**/*.tsx'],
      },
      null,
      2,
    ),
  );
  console.log(
    'Created independent author project. Install its pinned dependencies before building.',
  );
} else if (command === 'check') {
  const result = await checkAuthorProject(directory);
  console.log(
    JSON.stringify({
      gameId: result.manifest.id,
      files: result.files.length,
      contract: 7,
    }),
  );
} else if (command === 'build' || command === 'verify') {
  const result = await buildAuthorProject(directory);
  console.log(
    JSON.stringify(
      command === 'verify'
        ? await verifyAuthorContract(result.output)
        : { output: result.output, files: result.files.length },
    ),
  );
} else if (command === 'package') {
  const built = await buildAuthorProject(directory);
  await verifyAuthorContract(built.output);
  const output = resolve(directory, '.tablemax/candidates');
  await mkdir(output, { recursive: true });
  const blobs = [];
  for (const [kind, selected] of [
    ['code', built.files.filter((file) => !file.path.startsWith('resources/'))],
    [
      'resources',
      built.files.filter((file) => file.path.startsWith('resources/')),
    ],
  ]) {
    const records = await Promise.all(
      selected.map(async (file) => ({
        path: kind === 'code' ? file.path : file.path.slice(10),
        data: await readFile(resolve(built.output, file.path)),
      })),
    );
    blobs.push(await createBlob(kind, records, output, 'author-review'));
  }
  await writeFile(
    resolve(output, 'review-candidate.json'),
    JSON.stringify(
      { schemaVersion: 1, trusted: false, module: built.manifest, blobs },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ output, trusted: false, reviewRequired: true }));
} else if (command === 'dev') {
  const platform = args.find((arg) => arg.startsWith('--platform='))?.slice(11);
  if (!platform)
    throw new Error(
      'Isolated development requires an explicit frozen platform directory',
    );
  let browser;
  try {
    await runIsolatedDevelopment(
      directory,
      platform,
      args.includes('--no-browser')
        ? {}
        : {
            onReady: async ({ origin, hostToken, run, stop }) => {
              const { chromium } = await import('playwright');
              browser = await chromium.launchPersistentContext(
                resolve(run, 'browser'),
                {
                  headless: false,
                  args: ['--mute-audio'],
                  ...(existsSync(chromium.executablePath())
                    ? {}
                    : { channel: 'msedge' }),
                },
              );
              await browser.addInitScript(
                (token) => sessionStorage.setItem('tablemax-host', token),
                hostToken,
              );
              const page = browser.pages()[0] ?? (await browser.newPage());
              await page.goto(`${origin}/host`);
              browser.on('close', stop);
            },
          },
    );
  } finally {
    await browser?.close();
  }
} else throw new Error(`Unknown author command: ${command}`);
