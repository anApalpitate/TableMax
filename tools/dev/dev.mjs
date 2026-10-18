import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();
import { buildProject } from '../build/build.mjs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

await buildProject();
// Use the same assembled browser runtime and game release as the service.
// A separate Vite origin cannot serve immutable game resources or share React.
const desktop = spawn(
  resolve('build/desktop/TableMax.exe'),
  process.argv.slice(2).filter((argument) => argument !== '--'),
  {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_BOX_DIRECTORY:
        process.env.TABLEMAX_BOX_DIRECTORY ?? resolve('.cache/development'),
      TABLEMAX_WEB_DEV_URL: undefined,
      TABLEMAX_PACKAGED: '0',
    },
  },
);
desktop.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
desktop.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.on('SIGINT', () => {
  desktop.stdin?.end();
  desktop.kill();
});
