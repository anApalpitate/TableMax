import { expect, it } from 'vitest';
import { rules, type Action } from '../rules';
import { project, face } from '../rules/project';
import type { State } from '../rules/state';
import { decisionGuidance } from './decision-guidance';

const view = () =>
  project(
    rules.initialize({
      seats: ['S1', 'S2'],
      random: { next: () => 0.4 },
    }) as State,
    { role: 'player', seatId: 'S1' },
  );
it('distinguishes optional, required and automatic effects from movement', () => {
  for (const [phase, category, trigger] of [
    ['mew-other', 'special-mew', '必须执行'],
    ['zapdos-receive', 'special-zapdos', '必须执行'],
    ['snorlax-choice', 'special-snorlax', '可不发动'],
    ['place', 'special-charizard', '换入后可选'],
    ['place', 'special-ditto', '结算自动'],
  ] as const) {
    const game = view();
    game.phase = phase;
    game.held = face(`${category}#01`);
    expect(decisionGuidance(game, [], null).ability?.trigger).toBe(trigger);
  }
  const game = view();
  game.phase = 'mew-self';
  game.held = face('special-charizard#01');
  const hint = decisionGuidance(game, [], null);
  expect(hint.ability?.name).toBe('梦幻');
  expect(hint.target?.trigger).toBe('此次不触发');
});
it('uses authorized targets only and never privately resolves a hidden card', () => {
  const game = view();
  game.phase = 'place';
  game.actorSeat = 'S1';
  game.held = face('ordinary-3#01');
  const action: Action = { type: 'replace', slot: 0 };
  expect(decisionGuidance(game, [action], action).target).toBeNull();
  game.boards.S1![0] = {
    slotId: 'S1:0',
    faceUp: true,
    card: face('special-team-rocket#01'),
  };
  expect(decisionGuidance(game, [action], action).target?.trigger).toBe(
    '此次不触发',
  );
  game.boards.S1![0] = { slotId: 'S1:0', faceUp: false, card: null };
  expect(decisionGuidance(game, [action], action).target).toBeNull();
});
it('explains source constraints and final reveal without changing the projection', () => {
  const game = view();
  game.phase = 'place';
  game.actorSeat = 'S1';
  game.boards.S1!.forEach((slot, index) => {
    if (index) {
      slot.faceUp = true;
      slot.card = face('ordinary-4#01');
    }
  });
  const before = structuredClone(game);
  const action: Action = { type: 'replace', slot: 0 };
  expect(decisionGuidance(game, [action], action).instruction).toContain(
    '必须换入',
  );
  expect(decisionGuidance(game, [action], action).notice).toContain('立即结算');
  expect(
    decisionGuidance(game, [action, { type: 'discard-held' }], action)
      .instruction,
  ).toContain('或弃掉');
  expect(game).toEqual(before);
});
