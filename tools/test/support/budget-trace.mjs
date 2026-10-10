import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
/** Verification-only sampler. It is never bundled into the desktop or service. */
export function traceBudgets({ pages, runtime, directory, gameId }) {
  const samples = [],
    errors = [],
    sessions = new WeakMap();
  let pending = Promise.resolve(),
    stopped = false;
  const sample = async () => {
    if (stopped) return;
    try {
      const state = await runtime(),
        renderers = [];
      for (const page of pages()) {
        try {
          const role = new URL(page.url()).pathname.split('/')[1];
          if (!['host', 'public', 'player'].includes(role)) continue;
          let cdp = sessions.get(page);
          if (!cdp) {
            cdp = await page.context().newCDPSession(page);
            sessions.set(page, cdp);
          }
          const heap = await cdp.send('Runtime.getHeapUsage');
          renderers.push({
            role,
            heapBytes: heap.usedSize,
            path: new URL(page.url()).pathname,
          });
        } catch {
          /* Navigating or closed renderer: next sample will retry. */
        }
      }
      const { stdout } = await run(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          '$taskIds = [Collections.Generic.HashSet[int]]::new(); [void]$taskIds.Add([int]$env:TABLEMAX_BUDGET_PID); $taskProcesses = @(Get-CimInstance Win32_Process); do { $taskChanged = $false; foreach ($taskProcess in $taskProcesses) { if ($taskIds.Contains([int]$taskProcess.ParentProcessId) -and $taskIds.Add([int]$taskProcess.ProcessId)) { $taskChanged = $true } } } while ($taskChanged); $taskBytes = 0L; foreach ($taskId in $taskIds) { try { $taskBytes += (Get-Process -Id $taskId -ErrorAction Stop).PrivateMemorySize64 } catch {} }; Write-Output $taskBytes',
        ],
        {
          windowsHide: true,
          env: {
            ...process.env,
            TABLEMAX_BUDGET_PID: String(state.desktopPid),
          },
        },
      );
      samples.push({
        at: Date.now(),
        renderers,
        privateBytes: Number(stdout.trim()),
        servicePrivateBytes:
          (state.metrics?.find((item) => item.type === 'Utility')?.memory
            ?.privateBytes ?? 0) * 1024,
      });
    } catch (error) {
      errors.push(String(error.message));
    }
  };
  let sampling = true;
  const timer = setInterval(() => {
    if (sampling) return;
    sampling = true;
    pending = sample().finally(() => {
      sampling = false;
    });
  }, 2000);
  pending = sample().finally(() => {
    sampling = false;
  });
  return async () => {
    clearInterval(timer);
    await pending;
    await sample();
    stopped = true;
    await mkdir(directory, { recursive: true });
    const report = {
      gameId,
      scenario: process.argv
        .slice(1)
        .filter(
          (value) => value.endsWith('.mjs') || value.startsWith('--evidence='),
        ),
      intervalMs: 2000,
      scope:
        'Actual hidden WebView2 renderer JS heaps and owned Windows process-tree private bytes; sampled peaks, not allocation-profiler maxima. Service heap is measured separately.',
      samples,
      errors,
    };
    await writeFile(
      join(directory, `${gameId}-${process.pid}-${Date.now()}.json`),
      JSON.stringify(report, null, 2) + '\n',
    );
  };
}
