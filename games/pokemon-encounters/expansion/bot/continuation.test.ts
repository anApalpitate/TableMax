import { describe, expect, it } from 'vitest';
import { previewBoard, estimateDraw, choose } from './strategy';
import { scoreBoard } from '../scoring';
import { pokemonExpansion as rules } from '../index';
import { observeMemory } from './memory';
import { RandomSource } from '../../../../packages/platform-core/src/random';

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
const up = [false, false, true, false, true, false, false, false, true];

describe('legal expansion previews', () => {
  it('marks a replacement face up so R24 cannot claim a second original hidden slot', () => {
    const preview = previewBoard(board, up, {
      type: 'replace',
      slot: 1,
      incoming: 'ordinary-piplup#03',
    });
    const stale = scoreBoard(preview.board, ['R24'], up);
    const legal = scoreBoard(preview.board, ['R24'], preview.up);
    expect(stale.total).toBe(15);
    expect(legal.total).toBe(19);
    expect(legal.research[0]!.achieved).toBe(false);
    expect(preview.up[1]).toBe(true);
  });
  it('moves the orientation together with each repositioned identity', () => {
    const preview = previewBoard(board, up, { type: 'reposition', a: 1, b: 2 });
    expect(preview.board[1]).toBe(board[2]);
    expect(preview.up[1]).toBe(up[2]);
    expect(preview.board[2]).toBe(board[1]);
    expect(preview.up[2]).toBe(up[1]);
  });
  it('keeps every subsequent replacement paired with the future orientations', () => {
    const first = previewBoard(board, up, { type: 'reposition', a: 1, b: 2 });
    const second = previewBoard(first.board, first.up, {
      type: 'replace',
      slot: 5,
      incoming: 'ordinary-piplup#03',
    });
    expect(second.up[1]).toBe(true);
    expect(second.up[2]).toBe(false);
    expect(second.up[5]).toBe(true);
    expect(second.board[1]).toBe(board[2]);
  });
  it('keeps original identity/orientation inputs and ordinary scoring unchanged by reveal alone', () => {
    const before = { board: [...board], up: [...up] };
    previewBoard(board, up, {
      type: 'replace',
      slot: 1,
      incoming: 'ordinary-piplup#03',
    });
    previewBoard(board, up, { type: 'reposition', a: 1, b: 2 });
    expect({ board, up }).toEqual(before);
    expect(scoreBoard(board, [], up).total).toBe(
      scoreBoard(board, [], Array(9).fill(true)).total,
    );
  });
  it('allows discard only for deck draws and preserves compulsory use of either public discard', () => {
    expect(estimateDraw('deck', 27.2, 31.2)).toBeCloseTo(27.63);
    expect(estimateDraw('discard', 27.2, 31.2)).toBeCloseTo(31.28);
    expect(estimateDraw('discard', 27.2, 24)).toBeCloseTo(24.08);
  });
  it('does not mutate authorized view, knowledge or legal actions while choosing', () => {
    const context = {
      seats: ['a', 'b', 'c'],
      random: new RandomSource(701006),
    };
    let state = rules.initialize(context);
    for (const seat of context.seats)
      state = rules.apply(
        state,
        { type: 'vote-research', taskId: state.researchCandidates[0]! },
        seat,
        context,
      ).state;
    for (const seat of context.seats)
      state = rules.apply(
        state,
        { type: 'initial-flip', slot: 4 },
        seat,
        context,
      ).state;
    const seat = state.turnSeat,
      view = rules.project(state, { role: 'player', seatId: seat });
    const memory = observeMemory(null, view, seat, 'juewu');
    const actions = rules.legalActions(state, seat);
    const before = structuredClone({ view, memory, actions });
    const action = choose(
      view,
      actions,
      memory,
      'juewu',
      new RandomSource(614099),
      new AbortController().signal,
    );
    expect(actions).toContainEqual(action);
    expect({ view, memory, actions }).toEqual(before);
  });
});
