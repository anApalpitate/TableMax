import { expect, it } from 'vitest';
import { AdmissionRecovery } from './admissionRecovery';

it('coalesces wake recovery until the old request finishes and aborts a frozen expired request', () => {
  let now = 0;
  const recovery = new AdmissionRecovery(() => now);
  const first = recovery.begin()!;
  expect(recovery.recover()).toBe(false);
  expect(recovery.begin()).toBeNull();
  now = 9000;
  expect(recovery.recover()).toBe(false);
  expect(first.controller.signal.aborted).toBe(true);
  expect(recovery.finish(first)).toEqual({ current: true, recover: true });
  const retry = recovery.begin()!;
  expect(recovery.isCurrent(retry)).toBe(true);
  expect(recovery.isCurrent(first)).toBe(false);
});

it('cannot let an old join response overwrite a newly transferred device identity', () => {
  const recovery = new AdmissionRecovery();
  const oldJoin = recovery.begin()!;
  recovery.cancel();
  expect(oldJoin.controller.signal.aborted).toBe(true);
  const newJoin = recovery.begin()!;
  expect(recovery.isCurrent(oldJoin)).toBe(false);
  expect(recovery.finish(oldJoin)).toEqual({ current: false, recover: false });
  expect(recovery.isCurrent(newJoin)).toBe(true);
});
