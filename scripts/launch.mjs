import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const env = { ...process.env };
const child = spawn(
  resolve('build/desktop/TableMax.exe'),
  [...process.argv.slice(2).filter((argument) => argument !== '--')],
  {
    stdio: 'inherit',
    env: { ...env, TABLEMAX_PACKAGED: '0' },
    windowsHide: true,
  },
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
