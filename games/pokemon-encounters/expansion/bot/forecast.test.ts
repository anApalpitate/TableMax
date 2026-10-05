import { describe, expect, it } from 'vitest';
import { refineForecast } from './strategy';
import type { Action } from '../state';

const board = [
  'ordinary-piplup#01',
  'ordinary-7#01',
  'ordinary-piplup#02',
  'ordinary-0#01',
  'ordinary-1#01',
  'ordinary-3#01',
  'ordinary-4#01',
  'ordinary-5#01',
  'ordinary-6#01',
];
const up = Array<boolean>(9).fill(true);
const action: Action = { type: 'reposition', a: 0, b: 3 };
const hypothesis = (incoming: string) => ({
  board: [...board],
  up: [...up],
  pool: [incoming],
  discards: [],
});

describe('forecast expectation over authorized hypotheses', () => {
  it('uses both possible next draws: after the swap, 2 replaces 7 for -5 and 0 replaces 7 for -7', () => {
    const hypotheses = [
      hypothesis('ordinary-piplup#03'),
      hypothesis('ordinary-0#02'),
    ];
    const result = refineForecast(
      [{ action, value: 30 }],
      hypotheses,
      [],
      1,
      () => true,
    );
    expect(result[0]!.value).toBeCloseTo(30 - 0.12 * 6);
    const reversed = refineForecast(
      [{ action, value: 30 }],
      [...hypotheses].reverse(),
      [],
      1,
      () => true,
    );
    expect(reversed[0]!.value).toBeCloseTo(result[0]!.value, 10);
  });
  it('does not reuse the drawn deck card as an imaginary second draw', () => {
    const result = refineForecast(
      [{ action: { type: 'draw', source: 'deck' }, value: 19 }],
      [hypothesis('ordinary-piplup#03')],
      [],
      2,
      () => true,
    );
    // The third 2 forms the top zero line immediately; no further card remains.
    expect(result[0]!.value).toBe(19);
  });
  it('finishes a whole candidate batch before a soft deadline stops further hypotheses', () => {
    let calls = 0;
    const result = refineForecast(
      [
        { action, value: 30 },
        { action: { type: 'draw', source: 'deck' }, value: 30 },
      ],
      [hypothesis('ordinary-piplup#03'), hypothesis('ordinary-0#02')],
      [],
      1,
      () => calls++ === 0,
    );
    expect(
      result.find((candidate) => candidate.action.type === 'reposition')!.value,
    ).toBeCloseTo(29.4);
    expect(
      result.find((candidate) => candidate.action.type === 'draw')!.value,
    ).toBe(30);
  });
  it('leaves input boards, orientations, pools and candidate estimates intact; no forecast after cancellation', () => {
    const candidates = [{ action, value: 30 }];
    const hypotheses = [hypothesis('ordinary-piplup#03')];
    const before = structuredClone({ candidates, hypotheses });
    refineForecast(candidates, hypotheses, ['R24'], 2, () => true);
    expect({ candidates, hypotheses }).toEqual(before);
    expect(refineForecast(candidates, hypotheses, [], 2, () => false)).toEqual(
      candidates,
    );
  });
});
