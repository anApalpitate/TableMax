import { describe, expect, it } from 'vitest';
import type { LatestAction } from '../types';
import {
  unoCuePresentation,
  unoCueSymbol,
  unoSavedCue,
} from './saved-feedback';

const latest = (fields: Partial<LatestAction> = {}): LatestAction => ({
  serial: 1,
  actor: 'a',
  verb: 'play',
  text: '公开保存结果',
  card: null,
  color: 'red',
  targets: [],
  drawCount: 0,
  ...fields,
});

describe('UNO public saved feedback', () => {
  it.each([
    ['skip', 'skip'],
    ['reverse', 'reverse'],
    ['draw-two', 'draw-two'],
    ['wild', 'wild'],
    ['wild-draw-four', 'draw-four'],
    ['number', 'place'],
  ] as const)('gives %s its independent cue', (kind, cue) => {
    expect(
      unoSavedCue(
        latest({ card: { id: 'card', color: null, kind, value: null } }),
        'playing',
      ),
    ).toBe(cue);
  });

  it('distinguishes public challenge verdicts when the actual draw is depleted', () => {
    const record = latest({ verb: 'challenge-draw-four', drawCount: 0 });
    expect(unoSavedCue({ ...record, targets: ['b'] }, 'playing')).toBe(
      'challenge-success',
    );
    expect(unoSavedCue({ ...record, targets: ['a'] }, 'playing')).toBe(
      'challenge-failure',
    );
    expect(unoSavedCue(record, 'playing')).toBe('challenge');
  });

  it('does not parse a private verdict or an ambiguous public text', () => {
    expect(
      unoSavedCue(
        latest({
          verb: 'challenge-draw-four',
          text: '质疑失败',
          targets: ['b'],
        }),
        'playing',
      ),
    ).toBe('challenge-success');
    expect(
      unoSavedCue(
        latest({ verb: 'challenge-draw-four', actor: null, targets: ['b'] }),
        'playing',
      ),
    ).toBe('challenge');
  });

  it.each([
    ['declare-uno', 'uno'],
    ['catch-uno', 'catch-uno'],
    ['accept-draw-four', 'accept-four'],
    ['choose-color', 'wild'],
    ['draw', 'draw'],
    ['accept-draw-penalty', 'draw'],
    ['pass', null],
  ] as const)('separates %s from unrelated calls', (verb, cue) => {
    expect(unoSavedCue(latest({ verb, text: 'UNO' }), 'playing')).toBe(cue);
  });

  it('preserves declaration and victory priority without replacing the saved record', () => {
    const record = latest({
      text: '打出 +4，喊 UNO。',
      card: { id: 'w4', color: null, kind: 'wild-draw-four', value: null },
    });
    expect(unoSavedCue(record, 'playing')).toBe('uno');
    expect(unoSavedCue(record, 'round-result')).toBe('win');
    expect(record.card?.kind).toBe('wild-draw-four');
    expect(unoSavedCue(null, 'ended')).toBeNull();
  });

  it('uses the actual public draw for cumulative or depleted +4 responses', () => {
    expect(unoCueSymbol('challenge-failure', latest({ drawCount: 12 }))).toBe(
      '+12',
    );
    expect(unoCueSymbol('accept-four', latest({ drawCount: 2 }))).toBe('+2');
    expect(unoCueSymbol('challenge-failure', latest({ drawCount: 0 }))).toBe(
      '×',
    );
  });

  it('gives successful and failed challenges separate public visuals', () => {
    expect(unoCuePresentation['challenge-success'].symbol).not.toBe(
      unoCuePresentation['challenge-failure'].symbol,
    );
    expect(unoCuePresentation['catch-uno'].caption).not.toBe(
      unoCuePresentation.uno.caption,
    );
  });
});
