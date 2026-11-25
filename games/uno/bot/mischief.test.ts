import { expect, it } from 'vitest';
import { chooseAction, type Memory } from './index';
import { leadingRival } from './mischief';
import { legalActions, project } from '../rules';
import { fixture } from '../rules/test-fixtures';

const state = fixture({
  a: [
    'red-skip-a',
    'red-9-a',
    'blue-5-a',
    'blue-1-a',
    'blue-2-a',
    'blue-3-a',
    'blue-4-a',
  ],
  b: ['yellow-1-a', 'yellow-2-a', 'yellow-3-a'],
  c: ['green-1-a', 'green-2-a', 'green-3-a'],
  d: ['red-1-a', 'red-2-a', 'red-3-a'],
});
const neutral = project(state, { role: 'player', seatId: 'a' });
const actions = legalActions(state, 'a');
const memory: Memory = {
  version: 1,
  roundNumber: 1,
  serial: 0,
  knownCards: {},
  colorHints: {},
};

it('uses the official lead to prefer disruption over its own follow-up color', () => {
  const lead = structuredClone(neutral);
  lead.players.b!.score = 460;
  expect(leadingRival(lead)).toBe('b');
  expect(chooseAction(lead, actions, memory, 'juewu')).toMatchObject({
    cardId: 'blue-5-a',
  });
  expect(chooseAction(lead, actions, memory, 'mischief')).toEqual({
    type: 'play',
    cardId: 'red-skip-a',
  });
  expect(actions).toContainEqual(
    chooseAction(lead, actions, memory, 'mischief'),
  );
});

it('does not target a seat by identity and recalculates after the lead changes', () => {
  expect(leadingRival(neutral)).toBeUndefined();
  expect(chooseAction(neutral, actions, memory, 'mischief')).toEqual(
    chooseAction(neutral, actions, memory, 'juewu'),
  );
  const changed = structuredClone(neutral);
  changed.players.c!.score = 480;
  changed.players.b!.score = 100;
  changed.players.b!.handCount = 1;
  expect(leadingRival(changed)).toBe('c');
  expect(chooseAction(changed, actions, memory, 'mischief')).not.toMatchObject({
    cardId: 'red-skip-a',
  });
});
