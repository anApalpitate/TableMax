import { expect, it } from 'vitest';
import {
  composeExternalEntry,
  cycleExternalEntry,
  splitExternalEntry,
} from './external-entry';

it('cycles through the empty prefix and both protocols without duplicating pasted protocols', () => {
  let state = {
    prefix: '' as const,
    value: 'https://example.com:12345',
  } as ReturnType<typeof cycleExternalEntry>;
  state = cycleExternalEntry(state.prefix, state.value);
  expect(state).toEqual({ prefix: 'http://', value: 'example.com:12345' });
  expect(composeExternalEntry(state.prefix, state.value)).toBe(
    'http://example.com:12345',
  );
  state = cycleExternalEntry(state.prefix, state.value);
  expect(composeExternalEntry(state.prefix, state.value)).toBe(
    'https://example.com:12345',
  );
  state = cycleExternalEntry(state.prefix, state.value);
  expect(state).toEqual({ prefix: '', value: 'example.com:12345' });
  expect(composeExternalEntry(state.prefix, state.value)).toBe(
    'example.com:12345',
  );
});

it.each([
  ['http://example.com', 'http://', 'example.com'],
  [
    ' HTTPS://example.com:12345/player/ ',
    'https://',
    'example.com:12345/player/',
  ],
  ['https://[::1]:12345', 'https://', '[::1]:12345'],
  ['', '', ''],
  ['example.com:12345', '', 'example.com:12345'],
  ['ftp://example.com', '', 'ftp://example.com'],
])(
  'splits %s for editing without guessing a protocol',
  (input, prefix, value) => {
    expect(splitExternalEntry(input)).toEqual({ prefix, value });
  },
);

it('does not duplicate complete input or turn an empty field into a protocol-only address', () => {
  expect(composeExternalEntry('http://', 'https://example.com')).toBe(
    'https://example.com',
  );
  expect(composeExternalEntry('https://', '')).toBe('');
  expect(composeExternalEntry('', '  http://example.com:12345 ')).toBe(
    'http://example.com:12345',
  );
});
