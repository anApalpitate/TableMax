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
