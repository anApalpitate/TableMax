import { describe, expect, it } from 'vitest';
import { rules } from './index';
import { project } from './project';
import type { State } from './state';
import type { Action } from './view';
import { presentationChanges } from '../shared/presentation';
import { cueFor, SavedFeedback, type Feedback } from '../ui/presentation';
import { evaluateDefault } from '../bot/default';

const seats = ['A', 'B', 'C'];
const context = { seats, random: { next: () => 0.7 } };
const fresh = () => rules.initialize(context) as State;
const publicView = (state: State) => project(state, { role: 'public' });
function feedback(revision: number, branch = 0): Feedback {
  return {
    instanceId: 'test-instance',
    branch,
    revision,
    events: [{ kind: 'manila-action', text: '已保存' }],
  };
}
describe('Manila saved presentation boundaries', () => {
  it('classifies compound final outcomes without reading a localized message', () => {
    const before = publicView(fresh());
    before.phase = 'place';
    before.boats = [
      {
        cargo: 'silk',
        position: 12,
        destination: 'sea',
        destinationIndex: null,
        crew: ['A'],
        plundered: false,
      },
    ];
    const after = structuredClone(before);
    after.latest = '任意改写不影响事件';
    after.phase = 'ended';
    after.spaces[0]!.occupant = 'A';
    after.boats[0]!.destination = 'port';
    after.boats[0]!.position = 16;
    after.dice.push({ movement: 3, values: { silk: 4 } });
    after.result = {
      voyage: 1,
      income: { A: 30 },
      port: ['silk'],
      shipyard: [],
      plundered: [],
      dice: after.dice,
    };
    after.market.silk = 30;
    const changes = presentationChanges(before, after);
    expect(changes).toContain(`manila:place:${after.spaces[0]!.id}`);
    expect(changes).toEqual(
      expect.arrayContaining([
        'manila:sail',
        'manila:arrive:silk',
        'manila:result',
        'manila:ended',
        'manila:market:silk',
      ]),
    );
    expect(cueFor(changes)).toBe('celebration');
  });
  it('does not disclose the identity of a mortgaged private share', () => {
    const state = fresh(),
      share = state.players.A!.shares[0]!;
    const result = rules.apply(
      state,
      { type: 'mortgage', shareId: share.id },
      'A',
      context,
    );
    expect(result.events).toEqual([
      { kind: 'manila-trade', text: '股份交易已保存' },
    ]);
    expect(JSON.stringify(result.events)).not.toContain(share.id);
    expect(JSON.stringify(result.events)).not.toContain(share.cargo);
    const projection = publicView(result.state as State);
    expect(projection.players.A!.revealedShares).toHaveLength(0);
  });
  it('consumes initial, muted and repeated feedback without replaying it', () => {
    const seen = new SavedFeedback(feedback(1));
    expect(seen.accept(feedback(1))).toBe(false);
    expect(seen.accept(feedback(2))).toBe(true);
    expect(seen.accept(feedback(2))).toBe(false);
    expect(seen.accept(null)).toBe(false);
    expect(seen.accept(feedback(3, 1))).toBe(true);
  });
  it.each([3, 4, 5])(
    'keeps compound feedback wire-safe during a natural %s-seat game',
    (count) => {
      const ids = Array.from({ length: count }, (_, index) => `P${index}`);
      let seed = count * 971;
      const random = {
        next() {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          return (seed >>> 0) / 0x100000000;
        },
      };
      const ctx = { seats: ids, random };
      let state = rules.initialize(ctx) as State;
      let sawCompound = false;
      for (let step = 0; state.phase !== 'ended' && step < 2000; step++) {
        const decision = rules.decisions(state)[0]!;
        const view = project(state, {
          role: 'player',
          seatId: decision.seatId,
        });
        const actions = rules.legalActions(state, decision.seatId) as Action[];
        const ranked = actions
          .map((action) => ({ action, score: evaluateDefault(view, action) }))
          .sort((a, b) => b.score - a.score);
        const result = rules.apply(
          state,
          ranked[0]!.action,
          decision.seatId,
          ctx,
        );
        expect(result.events?.length ?? 0).toBeLessThanOrEqual(8);
        for (const event of result.events ?? []) {
          expect(event.kind.length).toBeLessThanOrEqual(64);
          expect(event.text.length).toBeLessThanOrEqual(100);
        }
        if ((result.events?.length ?? 0) > 1) sawCompound = true;
        state = rules.validateState(result.state, ids) as State;
      }
      expect(state.phase).toBe('ended');
      expect(sawCompound).toBe(true);
    },
  );
});
