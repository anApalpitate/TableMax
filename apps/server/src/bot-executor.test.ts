import { it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkerBotExecutor, type WorkerDiagnostic } from './bot-executor';
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

it('observes lifecycle timings without exposing strategy payload or changing successful results', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tablemax-worker-diagnostic-'));
  const path = join(dir, 'result.cjs');
  writeFileSync(
    path,
    "require('node:worker_threads').parentPort.postMessage({action:'private-action',memory:'private-memory',random:1});",
  );
  const samples: WorkerDiagnostic[] = [];
  let exited!: () => void;
  const exit = new Promise<void>((resolve) => {
    exited = resolve;
  });
  const executor = new WorkerBotExecutor(path, undefined, (sample) => {
    samples.push(sample);
    if (sample.phase === 'exit') exited();
    throw new Error('diagnostic sink failed');
  });
  const result = await executor.execute(
    {} as NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    new AbortController().signal,
  );
  await exit;
  expect(result).toEqual({
    action: 'private-action',
    memory: 'private-memory',
    random: 1,
  });
  expect(samples.map((sample) => sample.phase)).toEqual([
    'startup',
    'onlineToResult',
    'exit',
  ]);
  expect(samples.every((sample) => sample.durationMs >= 0)).toBe(true);
  expect(JSON.stringify(samples)).not.toMatch(/private-action|private-memory/);
  expect(samples.at(-1)?.outcome).toBe('success');
});

it('retains failed-result and cancellation semantics when lifecycle diagnostics are enabled', async () => {
  const dir = mkdtempSync(
    join(tmpdir(), 'tablemax-worker-diagnostic-failure-'),
  );
  const failed = join(dir, 'failed.cjs');
  writeFileSync(
    failed,
    "require('node:worker_threads').parentPort.postMessage({error:'private-worker-error'});",
  );
  const samples: WorkerDiagnostic[] = [];
  let exited!: () => void;
  let exit = new Promise<void>((resolve) => {
    exited = resolve;
  });
  const diagnostic = (sample: WorkerDiagnostic) => {
    samples.push(sample);
    if (sample.phase === 'exit') exited();
  };
  const task = {} as NonNullable<ReturnType<RoomCoordinator['botTask']>>;
  await expect(
    new WorkerBotExecutor(failed, undefined, diagnostic).execute(
      task,
      new AbortController().signal,
    ),
  ).rejects.toThrow('strategy-failed');
  await exit;
  expect(samples.at(-1)?.outcome).toBe('failed');
  const loop = join(dir, 'loop.cjs');
  writeFileSync(loop, 'while (true) {}');
  exit = new Promise<void>((resolve) => {
    exited = resolve;
  });
  const controller = new AbortController();
  const running = new WorkerBotExecutor(loop, undefined, diagnostic).execute(
    task,
    controller.signal,
  );
  controller.abort();
  await expect(running).rejects.toThrow('cancelled');
  await exit;
  expect(samples.at(-1)?.outcome).toBe('cancelled');
  expect(JSON.stringify(samples)).not.toContain('private-worker-error');
  const previous = samples.length;
  await expect(
    new WorkerBotExecutor(loop, undefined, diagnostic).execute(
      task,
      controller.signal,
    ),
  ).rejects.toThrow('cancelled');
  expect(samples).toHaveLength(previous);
});

it('keeps the cancelled outcome when queued Worker messages and errors arrive before exit', async () => {
  const workers: EventEmitter[] = [];
  class QueuedWorker extends EventEmitter {
    constructor() {
      super();
      workers.push(this);
    }
    terminate() {
      return Promise.resolve(1);
    }
  }
  vi.resetModules();
  vi.doMock('node:worker_threads', () => ({ Worker: QueuedWorker }));
  try {
    const { WorkerBotExecutor: QueuedExecutor } =
      await import('./bot-executor');
    const samples: WorkerDiagnostic[] = [];
    const controller = new AbortController();
    const running = new QueuedExecutor('unused', undefined, (sample) =>
      samples.push(sample),
    ).execute(
      {} as NonNullable<ReturnType<RoomCoordinator['botTask']>>,
      controller.signal,
    );
    const cancelled = expect(running).rejects.toThrow('cancelled');
    const worker = workers[0]!;
    worker.emit('online');
    controller.abort();
    worker.emit('message', {
      action: 'late-private-action',
      memory: null,
      random: 1,
    });
    worker.emit('error', new Error('late-private-error'));
    worker.emit('exit', 1);
    await cancelled;
    expect(samples.map((sample) => sample.phase)).toEqual([
      'startup',
      'cancel',
      'exit',
    ]);
    expect(samples.at(-1)?.outcome).toBe('cancelled');
    expect(JSON.stringify(samples)).not.toContain('late-private');
  } finally {
    vi.doUnmock('node:worker_threads');
    vi.resetModules();
  }
});
