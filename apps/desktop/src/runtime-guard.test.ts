import { it, expect } from 'vitest';
import { RuntimeGuard } from './runtime-guard';
import { startupError } from './startup-error';
it('keeps the service awake, releases screen protection independently and cleans all blockers on exit', () => {
  const blockers = new Map<number, string>();
  let next = 0;
  const guard = new RuntimeGuard({
    start(type) {
      blockers.set(++next, type);
      return next;
    },
    stop(id) {
      return blockers.delete(id);
    },
  });
  guard.start();
  guard.start();
  expect([...blockers.values()]).toEqual(['prevent-app-suspension']);
  guard.publicScreenVisible(true);
  guard.publicScreenVisible(true);
  expect([...blockers.values()]).toEqual([
    'prevent-app-suspension',
    'prevent-display-sleep',
  ]);
  guard.publicScreenVisible(false);
  expect([...blockers.values()]).toEqual(['prevent-app-suspension']);
  guard.publicScreenVisible(true);
  guard.stop();
  guard.stop();
  expect(blockers.size).toBe(0);
});
it('explains actionable startup failures while preserving the concrete cause and save path', () => {
  for (const [message, code, expected] of [
    ['listen EADDRINUSE', 'EADDRINUSE', '端口 38473'],
    ['damaged-save-json', '', '存档损坏'],
    ['incompatible-strategy', '', '不兼容'],
    ['disk is full', 'ENOSPC', '磁盘空间'],
    ['Local service startup timed out', '', '20 秒'],
  ]) {
    const detail = startupError(
      Object.assign(new Error(message), { code }),
      38473,
      'C:\\Data\\TableMax',
    );
    expect(detail).toContain(expected);
    expect(detail).toContain(message);
    expect(detail).toContain('C:\\Data\\TableMax');
  }
});
