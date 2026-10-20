import { describe, expect, it } from 'vitest';
import {
  CommandSchema,
  JoinSchema,
  playerNameError,
  playerNameLength,
} from './index';

describe('player nickname length', () => {
  it.each([
    ['中文名字一共八字', 16, true],
    ['中文名字一共九个字', 18, false],
    ['abcdefghijklmnop', 16, true],
    ['abcdefghijklmnopq', 17, false],
    ['阿明abcdefghijkl', 16, true],
    ['阿明abcdefghijklm', 17, false],
    ['ＡＢＣＤＥＦＧＨ', 16, true],
    ['😀'.repeat(8), 16, true],
    ['😀'.repeat(9), 18, false],
    ['👨‍👩‍👧‍👦'.repeat(8), 16, true],
    ['e\u0301'.repeat(8), 16, true],
    ['  阿明  ', 4, true],
    ['', 0, false],
  ])('counts %s as %i units', (name, units, valid) => {
    expect(playerNameLength(name)).toBe(units);
    expect(playerNameError(name) === null).toBe(valid);
    expect(JoinSchema.safeParse({ name }).success).toBe(valid);
    for (const type of ['add-bot', 'set-bot-name', 'set-seat-name']) {
      expect(
        CommandSchema.safeParse({
          actionId: 'test-name-limit',
          instanceId: '11111111-1111-4111-8111-111111111111',
          revision: 0,
          branch: 0,
          command: {
            type,
            name,
            ...(type === 'add-bot' ? {} : { seatId: 'seat' }),
          },
        }).success,
      ).toBe(valid);
    }
  });
  it('also checks expansion caused by generation reversal', () => {
    expect(playerNameLength('dad dad dad dad')).toBe(15);
    expect(playerNameError('dad dad dad dad')).toContain('转换后');
    expect(JoinSchema.safeParse({ name: 'dad dad dad dad' }).success).toBe(
      false,
    );
  });
  it('bounds raw combining text even when it paints as a short name', () => {
    expect(playerNameError('a' + '\u0301'.repeat(128))).not.toBeNull();
  });
});
