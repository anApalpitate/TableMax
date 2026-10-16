import { describe, expect, it } from 'vitest';
import {
  eventLabels,
  scoreEffectText,
  roleEffectText,
} from './event-presentation';

describe('authorized weather value labels', () => {
  it('distinguishes physical print from a transformed authorized role and leaves legacy faces alone', () => {
    expect(
      roleEffectText({
        originalCategoryId: 'pikachu',
        categoryId: 'garchomp',
        printedValue: -2,
        effectiveValue: 11,
      }),
    ).toBe('戏法空间，原值-2→11');
    expect(
      roleEffectText({
        originalCategoryId: 'pikachu',
        categoryId: 'pikachu',
        printedValue: -2,
        effectiveValue: -2,
      }),
    ).toBeNull();
    expect(roleEffectText({ categoryId: 'pikachu' })).toBeNull();
  });
  it('distinguishes rain changes, increases, and copied sources without guessing a face', () => {
    expect(scoreEffectText({ scoreEffect: { kind: 'rain', delta: -2 } })).toBe(
      '雨天 −2',
    );
    expect(scoreEffectText({ scoreEffect: { kind: 'snow', delta: 1 } })).toBe(
      '雪天 ＋1',
    );
    expect(
      scoreEffectText({
        scoreEffect: { kind: 'rain', delta: -2, inherited: true },
      }),
    ).toBe('复制继承，雨天 −2');
    expect(scoreEffectText({ scoreEffect: null })).toBeNull();
  });
  it('labels all six announced event categories including the Mega placeholder', () => {
    expect(Object.keys(eventLabels).sort()).toEqual([
      'mega',
      'rain',
      'sandstorm',
      'snow',
      'sun',
      'trick-room',
    ]);
  });
});
