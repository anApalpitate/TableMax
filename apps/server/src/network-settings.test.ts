import { afterEach, expect, it } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { NetworkSettings, normalizeUrl } from './network-settings';

const directories: string[] = [];
const fixtureRoot = resolve('tmp/network-settings-verification');
const fixture = () => {
  mkdirSync(fixtureRoot, { recursive: true });
  const directory = mkdtempSync(join(fixtureRoot, 'run-'));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of directories.splice(0)) {
    expect(dirname(directory)).toBe(fixtureRoot);
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  ['frp-off.com:33684', 'http://frp-off.com:33684'],
  ['example.com', 'http://example.com'],
  [' 127.0.0.1:38473/player ', 'http://127.0.0.1:38473'],
  ['[::1]:8080', 'http://[::1]:8080'],
  [' https://EXAMPLE.com/ ', 'https://example.com'],
  ['https://example.com:443/player/', 'https://example.com'],
  ['http://example.com:8080', 'http://example.com:8080'],
  ['http://127.0.0.1:38473/player', 'http://127.0.0.1:38473'],
  ['https://[::1]:443/', 'https://[::1]'],
  ['http://[::1]:8080/player', 'http://[::1]:8080'],
  ['https://桌游.中国', 'https://xn--hyvt5k.xn--fiqs8s'],
])('normalizes supported external entry %s', (input, expected) => {
  expect(normalizeUrl(input)).toBe(expected);
});

it.each([
  '',
  'http:example.com',
  '//example.com',
  'javascript:alert(1)',
  'ftp://example.com',
  'https://user:password@example.com',
  'https://@example.com',
  'https://example.com/player?token=secret',
  'https://example.com/player?',
  'https://example.com/#',
  'https://example.com/tablemax/player',
  'https://example.com/host',
  'https://example.com/prefix/../player',
  'https://example.com/%70layer',
  'https://example.com\\player',
  'https://exa\nmple.com',
  'https://example.com:65536',
  'https://-invalid.example',
  'https://*.example.com',
])('rejects unsupported or ambiguous external entry %s', (input) => {
  expect(() => normalizeUrl(input)).toThrow();
});

it('defaults without creating a file, saves atomically, restores and clears the external entry', () => {
  const directory = fixture();
  const settings = new NetworkSettings(directory);
  expect(settings.read()).toEqual({ externalJoinUrl: null });
  expect(readdirSync(directory)).toEqual([]);
  settings.save('https://example.com:8443/');
  expect(settings.read()).toEqual({
    externalJoinUrl: 'https://example.com:8443',
  });
  expect(new NetworkSettings(directory).read()).toEqual(settings.read());
  expect(readdirSync(directory)).toEqual(['network-settings.json']);
  settings.save(null);
  expect(new NetworkSettings(directory).read()).toEqual({
    externalJoinUrl: null,
  });
});

it('reads an existing /player entry as the root address without rewriting the saved file', () => {
  const directory = fixture();
  const file = join(directory, 'network-settings.json');
  const source = '{"externalJoinUrl":"https://EXAMPLE.com:8443/player/"}\n';
  writeFileSync(file, source);
  const settings = new NetworkSettings(directory);
  expect(settings.read()).toEqual({
    externalJoinUrl: 'https://example.com:8443',
  });
  expect(readFileSync(file, 'utf8')).toBe(source);
  expect(readdirSync(directory)).toEqual(['network-settings.json']);
  settings.save('https://example.com:8443/player');
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
    externalJoinUrl: 'https://example.com:8443',
  });
  expect(new NetworkSettings(directory).read()).toEqual(settings.read());
});

it.each([
  '{broken',
  '{}',
  '{"externalJoinUrl":42}',
  '{"externalJoinUrl":"https://example.com/prefix/player"}',
  '{"externalJoinUrl":null,"unknown":"preserve"}',
])(
  'preserves invalid settings and warns before explicitly repairing %s',
  (source) => {
    const directory = fixture();
    const file = join(directory, 'network-settings.json');
    writeFileSync(file, source);
    const settings = new NetworkSettings(directory);
    expect(settings.read().externalJoinUrl).toBeNull();
    expect(settings.read().networkMessage).toContain('原文件已保留');
    expect(readFileSync(file, 'utf8')).toBe(source);
    settings.save('https://example.com');
    const backup = readdirSync(directory).find((name) =>
      name.startsWith('network-settings.corrupt-'),
    );
    expect(backup).toBeTruthy();
    expect(readFileSync(join(directory, backup!), 'utf8')).toBe(source);
    expect(settings.read()).toEqual({
      externalJoinUrl: 'https://example.com',
    });
  },
);

it('keeps the previous in-memory value and original file on failed replacement', () => {
  const directory = fixture();
  const file = join(directory, 'network-settings.json');
  const settings = new NetworkSettings(directory);
  settings.save('https://old.example');
  const original = readFileSync(file, 'utf8');
  renameSync(file, join(directory, 'original.json'));
  mkdirSync(file);
  expect(() => settings.save('https://new.example')).toThrow();
  expect(settings.read()).toEqual({
    externalJoinUrl: 'https://old.example',
  });
  expect(readFileSync(join(directory, 'original.json'), 'utf8')).toBe(original);
  expect(readdirSync(directory).some((name) => name.endsWith('.tmp'))).toBe(
    false,
  );
});

it('rejects invalid changes before touching a saved entry', () => {
  const directory = fixture();
  const settings = new NetworkSettings(directory);
  settings.save('https://old.example');
  const original = readFileSync(
    join(directory, 'network-settings.json'),
    'utf8',
  );
  expect(() => settings.save('https://other.example/prefix')).toThrow();
  expect(readFileSync(join(directory, 'network-settings.json'), 'utf8')).toBe(
    original,
  );
  expect(settings.read().externalJoinUrl).toBe('https://old.example');
});
