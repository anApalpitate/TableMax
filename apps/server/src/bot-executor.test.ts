import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkerBotExecutor } from './bot-executor';
import type { RoomCoordinator } from '@tablemax/platform-core';

it('terminates a synchronous infinite strategy loop without blocking the service thread', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tablemax-worker-'));
  const path = join(dir, 'loop.cjs');
  writeFileSync(path, 'while (true) {}');
  const executor = new WorkerBotExecutor(path);
  const controller = new AbortController();
  const promise = executor.execute(
    {} as NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    controller.signal,
  );
  setTimeout(() => controller.abort(), 100);
  await expect(promise).rejects.toThrow('cancelled');
});

it('applies the 32MiB limit in a real Worker isolate', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tablemax-worker-limit-'));
  const path = join(dir, 'limits.cjs');
  writeFileSync(
    path,
    "const {parentPort,resourceLimits}=require('node:worker_threads');parentPort.postMessage({action:{heapMiB:resourceLimits.maxOldGenerationSizeMb},memory:null,random:1});",
  );
  const executor = new WorkerBotExecutor(path);
  const result = await executor.execute(
    {} as NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    new AbortController().signal,
  );
  expect(result.action).toEqual({ heapMiB: 32 });
});

it('honors the two-second hard cancellation while the Worker runs a synchronous loop', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tablemax-worker-deadline-'));
  const path = join(dir, 'deadline.cjs');
  writeFileSync(path, 'while (true) {}');
  const executor = new WorkerBotExecutor(path);
  const controller = new AbortController();
  const start = performance.now();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    await expect(
      executor.execute(
        {} as NonNullable<ReturnType<RoomCoordinator['botTask']>>,
        controller.signal,
      ),
    ).rejects.toThrow('cancelled');
    expect(performance.now() - start).toBeGreaterThanOrEqual(1900);
    expect(performance.now() - start).toBeLessThan(2700);
  } finally {
    clearTimeout(timer);
  }
});
