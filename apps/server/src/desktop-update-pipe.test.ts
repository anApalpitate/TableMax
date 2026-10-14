import { expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { DesktopPipe, type DesktopMessage } from './desktop-pipe';

it('accepts only bounded correlated update inspection and preparation messages', () => {
  const input = new PassThrough();
  const messages: DesktopMessage[] = [];
  const failures: unknown[] = [];
  new DesktopPipe(
    input,
    new PassThrough(),
    (message) => messages.push(message),
    () => {},
    (cause) => failures.push(cause),
  );
  input.write('{"type":"inspect","id":1}\n{"type":"prepare-update","id":2}\n');
  expect(messages).toEqual([
    { type: 'inspect', id: 1 },
    { type: 'prepare-update', id: 2 },
  ]);
  expect(failures).toEqual([]);
});

it.each([
  { type: 'inspect', id: 0 },
  { type: 'inspect', id: -1 },
  { type: 'inspect', id: 1.5 },
  { type: 'inspect', id: Number.MAX_SAFE_INTEGER + 1 },
  { type: 'inspect', id: 1, url: 'https://example.com' },
  { type: 'prepare-update' },
])('rejects malformed or extensible update requests %j', (message) => {
  const input = new PassThrough();
  const received: DesktopMessage[] = [];
  const failures: unknown[] = [];
  new DesktopPipe(
    input,
    new PassThrough(),
    (value) => received.push(value),
    () => {},
    (cause) => failures.push(cause),
  );
  input.write(JSON.stringify(message) + '\n');
  expect(received).toEqual([]);
  expect(failures).toHaveLength(1);
});
