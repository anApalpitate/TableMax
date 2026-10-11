import { spawn } from 'node:child_process';
import {
  openSync,
  closeSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

// Child verifiers only register outputs. The parent owns at most one maintenance attempt.
export async function finishVerificationRound(root, { runId, output }) {
  if (
    process.platform !== 'win32' ||
    process.env.TABLEMAX_AUTO_MAINTENANCE === '0'
  )
    return {
      result: 'not-applicable',
      reason: 'Maintenance disabled for this isolated round',
    };
  const once = resolve(output, 'maintenance-once.json');
  if (existsSync(once))
    return {
      result: 'not-applicable',
      reason: 'This round already attempted maintenance',
    };
  writeFileSync(
    once,
    JSON.stringify({ runId, startedAt: new Date().toISOString() }),
    { flag: 'wx' },
  );
  const coordinator = resolve(output, 'coordinator.json');
  writeFileSync(
    coordinator,
    JSON.stringify({
      schemaVersion: 1,
      phase: 'idle',
      pid: process.pid,
      entrypoint: process.argv[1],
      startedAtMs: Date.now() - process.uptime() * 1000,
      recordedAtUtc: new Date().toISOString(),
    }),
    { flag: 'wx' },
  );
  const log = openSync(resolve(output, 'maintenance.log'), 'wx');
  try {
    const code = await new Promise((done, reject) => {
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
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
          env: {
            ...process.env,
            TABLEMAX_AUTO_MAINTENANCE: '0',
            TABLEMAX_MAINTENANCE_CHILD: '1',
          },
        },
      );
      child.once('error', reject);
      child.once('close', done);
    });
    const maintenance = JSON.parse(
      readFileSync(resolve(output, 'result.json'), 'utf8'),
    );
    return {
      result:
        code === 0 && maintenance.result === 'completed'
          ? 'completed'
          : 'blocked',
      errors: maintenance.errors,
      code,
      report: resolve(output, 'result.json'),
    };
  } finally {
    closeSync(log);
  }
}
