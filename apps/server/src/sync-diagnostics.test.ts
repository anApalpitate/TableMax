import { expect, it } from 'vitest';
import { SyncDiagnostics } from './sync-diagnostics';

it('bounds samples while retaining total counts and returns detached read-only snapshots', () => {
  const diagnostics = new SyncDiagnostics();
  for (let index = 0; index < 300; index++)
    diagnostics.record('projection', index);
  const first = diagnostics.snapshot();
  expect(first.metrics.projection.count).toBe(300);
  expect(first.metrics.projection.samplesMs).toHaveLength(256);
  expect(first.metrics.projection.samplesMs[0]).toBe(44);
  diagnostics.record('projection', 300);
  expect(first.metrics.projection.count).toBe(300);
  expect(first.metrics.projection.samplesMs.at(-1)).toBe(299);
  expect(diagnostics.snapshot().metrics.projection.samplesMs[0]).toBe(45);
  expect(diagnostics.snapshot().metrics.probeUnchanged.count).toBe(0);
});
