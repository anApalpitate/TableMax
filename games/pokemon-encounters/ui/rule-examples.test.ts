import { expect, it } from 'vitest';
import { scoreBoard } from '../rules/scoring';
import { scoringExample } from './rule-examples';

it('the rulebook Ditto example uses the full-board optimum rather than the smallest neighbour', () => {
  const score = scoreBoard(scoringExample.instances);
  expect(score.values).toEqual(scoringExample.values);
  expect(score.columns).toEqual(scoringExample.columns);
  expect(score.total).toBe(scoringExample.total);
  expect(score.copies[0]).toMatchObject({
    slot: 4,
    direction: 'right',
    value: 9,
  });
});
