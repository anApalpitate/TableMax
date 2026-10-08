import { expect, it } from 'vitest';
import {
  recordInteractionDiagnostic,
  readInteractionDiagnostics,
  type InteractionDiagnostic,
} from './diagnostics';

it('stores a bounded immutable whitelist without payloads or credentials', () => {
  for (let index = 0; index < 210; index++) {
    recordInteractionDiagnostic({
      phase: 'receive',
      channel: 'shot',
      eventId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      receivedAt: index,
      durationMs: 0,
      credentials: 'must-not-be-retained',
      point: { x: 0.2, y: 0.4 },
      url: 'private-source',
    } as InteractionDiagnostic);
  }
  const snapshot = readInteractionDiagnostics();
  expect(snapshot).toHaveLength(192);
  expect(snapshot[0]!.receivedAt).toBe(18);
  expect(snapshot.at(-1)?.receivedAt).toBe(209);
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot[0])).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain('must-not-be-retained');
  expect(snapshot[0]).not.toHaveProperty('point');
  expect(snapshot[0]).not.toHaveProperty('url');
});

it('rejects invalid metadata and keeps each read as a stable snapshot', () => {
  recordInteractionDiagnostic({ phase: 'receive', receivedAt: 10 });
  const before = readInteractionDiagnostics();
  recordInteractionDiagnostic({
    phase: 'drop',
    eventId: 'secret',
    channel: 'secret',
    cache: 'secret',
    outcome: 'secret',
    receivedAt: Number.NaN,
    durationMs: Number.POSITIVE_INFINITY,
  } as unknown as InteractionDiagnostic);
  const entry = readInteractionDiagnostics().at(-1)!;
  expect(entry).toMatchObject({
    phase: 'drop',
    eventId: undefined,
    channel: undefined,
    cache: undefined,
    outcome: undefined,
    receivedAt: undefined,
    durationMs: undefined,
  });
  expect(before.at(-1)?.phase).toBe('receive');
  const length = readInteractionDiagnostics().length;
  recordInteractionDiagnostic({
    phase: 'secret',
  } as unknown as InteractionDiagnostic);
  expect(readInteractionDiagnostics()).toHaveLength(length);
});
