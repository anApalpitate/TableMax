import {
  cp,
  mkdir,
  readFile,
  writeFile,
  lstat,
  readdir,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { buildAuthorProject } from './build.mjs';
import {
  projectGameCatalog,
  projectGameWeb,
} from '../../packages/game-sdk/src/metadata.mjs';

export async function runIsolatedDevelopment(
  project,
  platformDirectory,
  options = {},
) {
  const built = await buildAuthorProject(project);
  const base = resolve(platformDirectory);
  const run = resolve(project, '.tablemax', `run-${randomUUID()}`);
  const guardTree = async (path) => {
    const info = await lstat(path);
    if (info.isSymbolicLink())
      throw new Error('Linked platform input rejected');
    if (info.isDirectory())
      for (const item of await readdir(path))
        await guardTree(resolve(path, item));
  };
  for (const name of ['runtime', 'data', 'browser', 'evidence'])
    await mkdir(resolve(run, name), { recursive: true });
  // Freeze only runtime inputs. Never copy live databases, browser profiles or credentials.
  for (const name of [
    'server.cjs',
    'server.cjs.br',
    'bot-worker.cjs',
    'node.exe',
    'package.json',
    'web',
  ]) {
    const source = resolve(base, name);
    await guardTree(source);
    await cp(source, resolve(run, 'runtime', name), {
      recursive: true,
      filter: (path) =>
        name !== 'web' ||
        !/[/\\](games|data|browser|profiles)([/\\]|$)/.test(
          path.slice(source.length),
        ),
    });
  }
  const runtime = resolve(run, 'runtime');
  const manifest = {
    ...built.manifest,
    details: `/games/${built.manifest.id}/web/details.json`,
    entries: {
      rules: `games/${built.manifest.id}.cjs`,
      bot: `bots/${built.manifest.id}.cjs`,
      web: `/games/${built.manifest.id}/web/entry.js`,
    },
    styles: built.manifest.styles.map(
      (item) => `/games/${built.manifest.id}/${item}`,
    ),
  };
  await mkdir(resolve(runtime, 'games'));
  await mkdir(resolve(runtime, 'bots'));
  await cp(
    resolve(built.output, 'rules.cjs'),
    resolve(runtime, manifest.entries.rules),
  );
  await cp(
    resolve(built.output, 'bot.cjs'),
    resolve(runtime, manifest.entries.bot),
  );
  await cp(
    resolve(built.output, 'web'),
    resolve(runtime, 'web/games', manifest.id, 'web'),
    { recursive: true },
  );
  await writeFile(
    resolve(runtime, 'web/games', manifest.id, 'web/module.json'),
    JSON.stringify(projectGameWeb(manifest)),
  );
  if (built.files.some((item) => item.path.startsWith('resources/'))) {
    await cp(
      resolve(built.output, 'resources'),
      resolve(runtime, 'web/assets/games'),
      { recursive: true },
    );
    await cp(
      resolve(built.output, 'resources'),
      resolve(runtime, 'web/games', manifest.id, 'resources'),
      { recursive: true },
    );
  }
  await writeFile(resolve(runtime, 'modules.json'), JSON.stringify([manifest]));
  const catalog = JSON.parse(
    await readFile(resolve(runtime, 'web/catalog.json'), 'utf8'),
  );
  await writeFile(
    resolve(runtime, 'web/catalog.json'),
    JSON.stringify(
      Array.isArray(catalog)
        ? [projectGameCatalog(manifest)]
        : { ...catalog, modules: [projectGameCatalog(manifest)] },
    ),
  );
  const node =
    process.platform === 'win32'
      ? resolve(runtime, 'node.exe')
      : process.execPath;
  const child = spawn(
    node,
    [resolve(runtime, 'server.cjs'), '--desktop-pipe'],
    {
      cwd: runtime,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TABLEMAX_PACKAGED: '1',
        TABLEMAX_AUDIO_ENABLED: '0',
        TABLEMAX_AUTHOR_MODE: '1',
      },
    },
  );
  child.stdin.write(
    `${JSON.stringify({ type: 'start', config: { host: '127.0.0.1', port: 0, dataDir: resolve(run, 'data'), webDir: resolve(runtime, 'web'), playMode: options.playMode ?? 'play' } })}\n`,
  );
  let buffer = '';
  let readyError;
  const timeout = setTimeout(() => {
    readyError = new Error('Isolated service startup timed out');
    child.kill();
  }, 30000);
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        const message = JSON.parse(line);
        if (message.type === 'ready') {
          clearTimeout(timeout);
          // Test automation gets the private pipe result in memory only.
          void Promise.resolve(
            options.onReady?.({
              origin: `http://127.0.0.1:${message.port}`,
              hostToken: message.hostToken,
              run,
              stop,
            }),
          ).catch((error) => {
            readyError = error;
            stop();
          });
          console.log(
            JSON.stringify({
              origin: `http://127.0.0.1:${message.port}`,
              run,
              data: resolve(run, 'data'),
              browser: resolve(run, 'browser'),
              evidence: resolve(run, 'evidence'),
            }),
          );
        } else if (message.type === 'error') console.error(message.message);
      } catch {
        /* Never forward raw transport messages or credentials. */
      }
    }
  });
  child.stderr.on('data', () => {
    /* Service writes its safe log in the isolated data directory. */
  });
  const stop = () => {
    if (child.stdin.writableEnded || child.stdin.destroyed) return;
    child.stdin.end(`${JSON.stringify({ type: 'stop' })}\n`);
  };
  child.stdin.on('error', (error) => {
    if (!child.killed && !child.stdin.writableEnded) {
      readyError = error;
      child.kill();
    }
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await new Promise((fulfill, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (readyError) reject(readyError);
      else if (code) reject(new Error(`Isolated service exited ${code}`));
      else fulfill();
    });
  });
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  return { run };
}
