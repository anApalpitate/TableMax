import { describe, expect, it } from 'vitest';
import { rules } from '../rules';
import { face, project } from '../rules/project';
import type { State } from '../rules/state';
import {
  actionEffects,
  decisionProgress,
  publicZeroColumns,
  soundCues,
} from './presentation-state';
import { savedChanges } from './motion';
import type { PublicAction } from '../../../packages/game-sdk/src';

function view() {
  return project(
    rules.initialize({
      seats: ['S1', 'S2', 'S3'],
      random: { next: () => 0.4 },
    }) as State,
    { role: 'public' },
  );
}
function action(
  verb: PublicAction['verb'],
  ability: string,
  slots = [0],
): PublicAction {
  return {
    actor: 'S1',
    verb,
    ability,
    cardCategory: ability,
    targets: [{ seat: 'S1', slots }],
  };
}

describe('public presentation preserves information boundaries', () => {
  it('marks equal values and -2/+2, but never a hidden card or uncertain Ditto', () => {
    const game = view();
    const board = game.boards.S1!;
    const show = (slot: number, card: string) => {
      board[slot] = { slotId: `S1:${slot}`, faceUp: true, card: face(card) };
    };
    show(0, 'ordinary-4#01');
    show(3, 'ordinary-4#02');
    show(1, 'ordinary--2#01');
    show(4, 'special-mew#01');
    show(2, 'special-ditto#01');
    expect(publicZeroColumns(game, 'S1')).toEqual([0, 1]);
    board[3] = { slotId: 'S1:3', faceUp: false, card: null };
    expect(publicZeroColumns(game, 'S1')).toEqual([1]);
    show(5, 'ordinary--2#02');
    // Edge Ditto can only copy its known -2 neighbor, so this column is public and certain.
    expect(publicZeroColumns(game, 'S1')).toEqual([1, 2]);
    board[1] = { slotId: 'S1:1', faceUp: false, card: null };
    expect(publicZeroColumns(game, 'S1')).toEqual([]);
  });
  it('does not choose among ambiguous Ditto paths, and uses settled authoritative scores', () => {
    const game = view();
    [
      'ordinary-1#01',
      'special-ditto#01',
      'ordinary-4#01',
      'ordinary-3#01',
      'ordinary-1#02',
      'ordinary-5#01',
    ].forEach((card, slot) => {
      game.boards.S1![slot] = {
        slotId: `S1:${slot}`,
        faceUp: true,
        card: face(card),
      };
    });
    expect(publicZeroColumns(game, 'S1')).toEqual([]);
    game.publicColumns = { S1: [4, 0, 9] };
    expect(publicZeroColumns(game, 'S1')).toEqual([1]);
  });
  it('publishes resolved Ditto columns only after all their board inputs are public', () => {
    const state = rules.initialize({
      seats: ['S1', 'S2'],
      random: { next: () => 0.4 },
    }) as State;
    state.boards.S1 = [
      'ordinary-1#01',
      'special-ditto#01',
      'ordinary-4#01',
      'ordinary-3#01',
      'ordinary-1#02',
      'ordinary-5#01',
    ].map((instanceId) => ({ instanceId, faceUp: true }));
    expect(project(state, { role: 'public' }).publicColumns.S1).toEqual([
      4, 0, 9,
    ]);
    state.boards.S1[0]!.faceUp = false;
    expect(project(state, { role: 'public' }).publicColumns.S1).toBeNull();
    expect(
      project(state, { role: 'player', seatId: 'S1' }).publicColumns.S1,
    ).toBeNull();
  });
  it('keeps private peek positions out of public targets and sound input', () => {
    const game = view();
    const peek = action('peek', 'special-charizard', []);
    expect(actionEffects(peek, game).targets).toEqual([]);
    expect(soundCues('replace', peek, game)).toEqual(['charizard']);
    expect(game.peek).toBeNull();
  });
  it('distinguishes returning Rocket art from triggering its rule ability', () => {
    const game = view();
    game.boards.S1![0] = {
      slotId: 'S1:0',
      faceUp: true,
      card: face('special-team-rocket#01'),
    };
    const pass = action('zapdos-pass', 'special-zapdos');
    const prior = structuredClone(game);
    expect(actionEffects(pass, game)).toMatchObject({
      theme: 'zapdos',
      targets: ['S1:0'],
      rocketReturns: ['S1:0'],
      coin: null,
    });
    expect(soundCues('replace', pass, game)).toEqual([
      'zapdos',
      'rocket-return',
    ]);
    expect(game).toEqual(prior);
    expect(
      actionEffects(action('rocket-refill', 'special-team-rocket'), game)
        .rocketReturns,
    ).toEqual(['S1:0']);
  });
});

describe('saved effects follow actions as well as visible changes', () => {
  it('animates swapping two visually identical hidden cards', () => {
    const before = view(),
      after = structuredClone(before);
    after.events.push({
      id: 100,
      kind: 'replace',
      text: 'saved',
      action: action('swap', 'special-snorlax', [0, 1]),
    });
    expect(savedChanges(before, after)).toEqual(
      expect.arrayContaining(['@saved', 'S1:0', 'S1:1']),
    );
  });
  it('presents repeated same-face coin results on each new saved draw, but never sync', () => {
    const before = view();
    before.coin = 'meowth';
    const after = structuredClone(before);
    const draw = action('draw', 'special-team-rocket', []);
    after.events.push({ id: 100, kind: 'draw', text: 'saved', action: draw });
    expect(savedChanges(before, after)).toContain('@coin');
    expect(soundCues('draw', draw, after)).toEqual(['rocket', 'meowth']);
    expect(savedChanges(after, structuredClone(after))).toEqual([]);
  });
  it('keeps a winner cue when the final action itself had a theme', () => {
    const game = view();
    game.matchWinners = ['S1', 'S2'];
    expect(
      soundCues('round-result', action('swap', 'special-snorlax'), game),
    ).toEqual(['snorlax', 'match-result']);
  });
  it('reports parallel initial progress and each independent Zapdos recipient', () => {
    const game = view();
    game.initialDone = ['S3'];
    expect(decisionProgress(game)).toMatchObject({ completed: 1, total: 3 });
    game.phase = 'zapdos-receive';
    game.passProgress = { completed: 1, total: 2 };
    expect(decisionProgress(game)).toMatchObject({ completed: 2, total: 3 });
  });
});
