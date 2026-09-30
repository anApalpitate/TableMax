import './build.mjs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const vite = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    '--config',
    resolve('apps/web/vite.config.ts'),
  ],
  { stdio: 'inherit' },
);
let viteExit;
vite.on('exit', (code) => {
  viteExit = code ?? 1;
});
let ready = false;
try {
  for (let attempt = 0; attempt < 100 && !ready; attempt++) {
    if (viteExit !== undefined) throw new Error(`Vite exited: ${viteExit}`);
    try {
      ready = (
        await fetch('http://127.0.0.1:5173/', {
          signal: AbortSignal.timeout(500),
        })
      ).ok;
    } catch {
      /* Wait until the development server is listening. */
    }
    if (!ready) await new Promise((fulfill) => setTimeout(fulfill, 100));
  }
  if (!ready) throw new Error('Vite startup timed out');
} catch (error) {
  vite.kill();
  throw error;
}
const env = { ...process.env, TABLEMAX_WEB_DEV_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = spawn(
  require('electron'),
  [
    resolve('build/desktop'),
    ...process.argv.slice(2).filter((argument) => argument !== '--'),
  ],
  {
    stdio: 'inherit',
    env,
  },
);
desktop.on('exit', (code) => {
  vite.kill();
  process.exitCode = code ?? 1;
});
vite.on('exit', (code) => {
  if (code && !desktop.killed) desktop.kill();
});
process.on('SIGINT', () => {
  desktop.kill();
  vite.kill();
});
