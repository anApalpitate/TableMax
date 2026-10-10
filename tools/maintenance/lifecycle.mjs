import { spawn } from 'node:child_process';
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

let scheduled = false;
// Only a final idle coordinator remains alive while its maintenance child runs.
export function scheduleMaintenance() {
  if (
    scheduled ||
    process.platform !== 'win32' ||
    process.env.TABLEMAX_MAINTENANCE_CHILD === '1' ||
    process.env.TABLEMAX_AUTO_MAINTENANCE === '0'
  )
    return;
  scheduled = true;
  const root = resolve('.');
  process.once('beforeExit', () => {
    let log;
    try {
      const { version } = JSON.parse(
        readFileSync(resolve(root, 'package.json'), 'utf8'),
      );
      const output = resolve(
        root,
        `artifacts/maintenance/v${version}/automatic-maintenance`,
        `${Date.now()}-${randomUUID()}`,
      );
      mkdirSync(output, { recursive: true });
      const coordinator = resolve(output, 'coordinator.json');
      writeFileSync(
        coordinator,
        JSON.stringify({
          schemaVersion: 1,
          phase: 'idle',
          pid: process.pid,
          entrypoint: process.argv[1] ? resolve(process.argv[1]) : null,
          startedAtMs: Date.now() - process.uptime() * 1000,
          recordedAtUtc: new Date().toISOString(),
        }),
        { flag: 'wx' },
      );
      log = openSync(resolve(output, 'task.log'), 'wx');
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-NonInteractive',
          '-File',
          resolve(root, 'tools/maintenance/finish-task.ps1'),
          '-CoordinatorPath',
          coordinator,
          '-OutputDirectory',
          output,
        ],
        {
          cwd: root,
          windowsHide: true,
          stdio: ['ignore', log, log],
          env: { ...process.env, TABLEMAX_MAINTENANCE_CHILD: '1' },
        },
      );
      child.on('error', (error) =>
        console.error(
          'Automatic maintenance could not start: ' + error.message,
        ),
      );
      child.on('exit', (code) => {
        if (code)
          console.error(
            'Automatic maintenance reported a failure; see ' + output,
          );
      });
      console.log('Automatic maintenance report: ' + output);
    } catch (error) {
      console.error('Automatic maintenance preserved files: ' + error.message);
    } finally {
      if (log !== undefined) closeSync(log);
    }
  });
}
