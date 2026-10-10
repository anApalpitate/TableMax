import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RoomCoordinator } from '../../../packages/platform-core/src/room';
import { SqliteSaveRepository } from '../../../apps/server/src/save-repository';
import { rules, bot } from '../../../games/uno';
import { CARD_IDS } from '../../../games/uno/data/catalog';
import type { State } from '../../../games/uno/rules/state';
import type { Command } from '../../../packages/protocol/src';

export const scenarios = [
  'opening',
  'dense',
  'reverse',
  'skip',
  'draw-two',
  'wild',
  'draw-four',
  'uno',
  'challenge',
  'round-finish',
  'match-finish',
] as const;

/** Complete 108-card fixtures are test input only, never a product endpoint. */
export async function prepare(
  scenario: string,
  dataDir: string,
  count: number,
) {
  assert.ok(scenarios.includes(scenario as (typeof scenarios)[number]));
  assert.ok([2, 3, 4, 6].includes(count));
  const custom: typeof rules = {
    ...rules,
    initialize(context) {
      const base = rules.initialize(context) as State;
      const seats = [...context.seats];
      const top = 'red-5-a';
      const firstCard =
        (
          {
            reverse: 'red-reverse-a',
            skip: 'red-skip-a',
            'draw-two': 'red-draw-two-a',
            wild: 'wild-1',
            'draw-four': 'wild-draw-four-1',
            challenge: 'wild-draw-four-1',
          } as Record<string, string>
        )[scenario] ?? 'red-1-a';
      const wanted = scenario.endsWith('finish')
        ? [firstCard]
        : ['uno', 'challenge'].includes(scenario)
          ? [firstCard, 'red-2-a']
          : [
              firstCard,
              'red-2-a',
              'red-reverse-b',
              'red-skip-b',
              'red-draw-two-b',
              'wild-2',
              'blue-9-b',
            ];
      const available = CARD_IDS.filter(
        (id) => id !== top && !wanted.includes(id),
      );
      const own = [...wanted];
      if (scenario === 'dense')
        own.push(...available.splice(0, 30 - own.length));
      const hands = Object.fromEntries(
        seats.map((seat, index) => [
          seat,
          index === 0 ? own : available.splice(0, 7),
        ]),
      );
      // A legal extreme last hand ensures a first-round 500-point match finish.
      // The natural runtime verifier independently completes a random full match.
      if (scenario === 'match-finish')
        hands[seats.at(-1)!]!.push(...available.splice(0));
      Object.assign(base, {
        phase: 'playing',
        stage: 'turn',
        dealer: seats.at(-1),
        turnSeat: seats[0],
        direction: 1,
        activeColor: 'red',
        turnNumber: 4,
        actionSerial: 4,
        hands,
        deck: available,
        discard: [top],
        drawnCardId: null,
        drawFour: null,
        unoWindow: null,
        evidence: null,
        unoDeclared: Object.fromEntries(seats.map((seat) => [seat, false])),
        latest: {
          serial: 4,
          actor: seats.at(-1),
          verb: 'play',
          text: `座位 ${seats.length} 打出红 5。`,
          card: { id: top, color: 'red', kind: 'number', value: 5 },
          color: 'red',
          targets: [],
          drawCount: 0,
        },
      });
      return rules.validateState(base, seats);
    },
  };
  const repo = new SqliteSaveRepository(dataDir);
  const room = new RoomCoordinator(custom, bot, repo);
  const command = async (token: string, value: Command['command']) => {
    const v = room.view(token);
    const reply = await room.command(token, {
      actionId: randomUUID(),
      instanceId: v.instanceId,
      revision: v.revision,
      branch: v.branch,
      command: value,
    });
    assert.equal(reply.ok, true, JSON.stringify(reply));
  };
  try {
    const players = [];
    for (let index = 0; index < count; index++) {
      const player = await room.join(
        index === 0 ? 'UNO验收abcdefghijklmnop' : `朋友 ${index + 1}`,
        undefined,
        `avatar-${20 + index}`,
      );
      const seatId = room.view(player.token).self.seatId;
      players.push({ token: player.token, seatId });
      await command(player.token, { type: 'ready', ready: true });
    }
    await command(room.hostToken, {
      type: 'set-owner',
      seatId: players[0]!.seatId,
    });
    await command(room.hostToken, { type: 'set-play-mode', mode: 'play' });
    await command(room.hostToken, { type: 'start' });
    const save = repo.load() as {
      snapshot: { state: unknown };
      seats: { id: string }[];
    };
    const state = rules.validateState(
      save.snapshot.state,
      save.seats.map((seat) => seat.id),
    ) as State;
    assert.equal(
      new Set([
        ...state.deck,
        ...state.discard,
        ...Object.values(state.hands).flat(),
      ]).size,
      108,
    );
    return {
      players,
      firstCard: state.hands[players[0]!.seatId!]?.[0],
      handCount: state.hands[players[0]!.seatId!]?.length,
    };
  } finally {
    repo.close();
  }
}
