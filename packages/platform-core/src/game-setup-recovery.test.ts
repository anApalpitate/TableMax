import { afterEach, expect, it, vi } from 'vitest';
import type { GameRules } from '@tablemax/game-sdk';
import type { Command } from '@tablemax/protocol';
import { rules as unoRules } from '../../../games/uno/rules';
import { bot as unoBot } from '../../../games/uno/bot';
import { fixture as unoFixture } from '../../../games/uno/rules/test-fixtures';
import { unoSetupDefaults, validateUnoSetup } from '../../../games/uno/config';
import type { State as UnoState } from '../../../games/uno/rules/state';
import { GameRegistry, type GameRegistration } from './game-registry';
import { RoomCoordinator } from './room';
import type { Save, SaveRepository } from './model';

const oldRef = 'a'.repeat(64),
  currentRef = 'b'.repeat(64);
const rules: GameRules = {
  ...unoRules,
  // Only fix the legal initial deal. All saved actions, projections, setup and clocks are production UNO.
  initialize(context) {
    const state = unoFixture({
      [context.seats[0]!]: ['red-8-a', 'green-2-a'],
      [context.seats[1]!]: ['blue-1-a', 'yellow-2-a'],
    });
    state.setup = validateUnoSetup(context.setup ?? unoSetupDefaults);
    if (state.setup.drawPenaltyStacking) state.drawPenalty = null;
    return state;
  },
};
function registration(current: string, missing = false): GameRegistration {
  return {
    catalog: {
      id: rules.manifest.id,
      name: rules.manifest.name,
      ...rules.manifest.players,
    },
    async load(_variant, ref) {
      if (missing) throw new Error('missing-game-release');
      return { rules, bot: unoBot, releaseRef: ref ?? current };
    },
    async loadSaved(save) {
      if (missing) throw new Error('missing-game-release');
      return {
        rules,
        bot: unoBot,
        releaseRef: save.releaseRef!,
        restoreOnly: save.releaseRef !== current,
      };
    },
  };
}
class Repository implements SaveRepository {
  value: Save | null = null;
  writes = 0;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    this.value = structuredClone(value);
    this.writes++;
  }
}
afterEach(() => vi.restoreAllMocks());
async function send(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) {
  const view = room.view(credential);
  return room.command(credential, {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  });
}
async function prepare(setup: {
  drawPenaltyStacking: boolean;
  catchUnoDelayMs: number;
}) {
  const repository = new Repository();
  const registry = new GameRegistry([registration(oldRef)]);
  const room = await RoomCoordinator.open(
    registry,
    repository,
    undefined,
    'test',
    'uno',
  );
  const a = (await room.join('甲')).token,
    b = (await room.join('乙')).token;
  expect((await send(room, { type: 'set-game-setup', setup })).ok).toBe(true);
  for (const player of [a, b])
    expect((await send(room, { type: 'ready', ready: true }, player)).ok).toBe(
      true,
    );
  return { repository, registry, room, a, b };
}

it('resets historical custom UNO setup to current defaults on both direct start and replay migration', async () => {
  for (const path of ['start', 'replay'] as const) {
    const fixture = await prepare({
      drawPenaltyStacking: true,
      catchUnoDelayMs: 2000,
    });
    let room = fixture.room;
    if (path === 'replay')
      expect((await send(room, { type: 'start' })).ok).toBe(true);
    fixture.registry.refresh([registration(currentRef)]);
    room = await RoomCoordinator.open(fixture.registry, fixture.repository);
    expect(room.view().game?.restoreOnly).toBe(true);
    expect(room.view().game?.setup).toEqual({
      drawPenaltyStacking: true,
      catchUnoDelayMs: 2000,
    });
    if (path === 'replay') {
      expect((await send(room, { type: 'end' })).ok).toBe(true);
      expect((await send(room, { type: 'replay' })).ok).toBe(true);
      expect(room.view().game?.setup).toEqual(unoSetupDefaults);
      for (const player of [fixture.a, fixture.b])
        expect(
          (await send(room, { type: 'ready', ready: true }, player)).ok,
        ).toBe(true);
    }
    expect((await send(room, { type: 'start' })).ok).toBe(true);
    expect(room.view().game?.releaseRef).toBe(currentRef);
    expect(room.view().game?.restoreOnly).toBeUndefined();
    expect(room.view().game?.setup).toEqual(unoSetupDefaults);
    expect(fixture.repository.value!.gameSetup).toEqual(unoSetupDefaults);
    expect(
      (fixture.repository.value!.snapshot!.state as UnoState).setup,
    ).toEqual(unoSetupDefaults);
  }
});

it('repairs an exact missing UNO release with pending grace, persists paused clocks and restarts before resuming the remainder', async () => {
  let now = 1_900_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const fixture = await prepare({
    drawPenaltyStacking: false,
    catchUnoDelayMs: 1000,
  });
  let room = fixture.room;
  expect((await send(room, { type: 'start' })).ok).toBe(true);
  expect(
    (
      await send(
        room,
        {
          type: 'game',
          decisionId: room.view(fixture.a).decisionId!,
          action: { type: 'play', cardId: 'red-8-a' },
        },
        fixture.a,
      )
    ).ok,
  ).toBe(true);
  now += 100;
  expect((await send(room, { type: 'set-countdown', seconds: 40 })).ok).toBe(
    true,
  );
  expect(room.view(fixture.b).actionTiming?.[0]?.remainingMs).toBe(900);
  const original = structuredClone(fixture.repository.value!);
  const writes = fixture.repository.writes;
  fixture.registry.refresh([registration(currentRef, true)]);
  room = await RoomCoordinator.open(fixture.registry, fixture.repository);
  expect(room.missingRelease).toBe(oldRef);
  expect(fixture.repository.value).toEqual(original);
  expect(fixture.repository.writes).toBe(writes);
  now += 5000;
  fixture.registry.refresh([registration(currentRef)]);
  expect(await room.restoreMissingRelease()).toBe(true);
  expect(fixture.repository.value!.paused).toBe(true);
  expect(fixture.repository.value!.actionClocks).toHaveLength(1);
  expect(fixture.repository.value!.actionClocks![0]).toMatchObject({
    remainingMs: 900,
    startedAt: null,
  });
  expect(fixture.repository.value!.snapshot!.state).toEqual(
    original.snapshot!.state,
  );
  room = await RoomCoordinator.open(fixture.registry, fixture.repository);
  expect(room.view().game?.releaseRef).toBe(oldRef);
  expect(room.view(fixture.b).actionTiming?.[0]).toMatchObject({
    actionType: 'catch-uno',
    remainingMs: 900,
    running: false,
  });
  now += 5000;
  expect((await send(room, { type: 'resume' })).ok).toBe(true);
  now += 899;
  const catchAction = () =>
    send(
      room,
      {
        type: 'game',
        decisionId: room.view(fixture.b).decisionId!,
        action: {
          type: 'catch-uno',
          target: room.view(fixture.a).self.seatId!,
        },
      },
      fixture.b,
    );
  expect(await catchAction()).toMatchObject({
    ok: false,
    reason: 'action-not-ready',
  });
  now++;
  expect((await catchAction()).ok).toBe(true);
  const state = fixture.repository.value!.snapshot!.state as UnoState;
  expect(state.unoWindow).toBeNull();
  expect(state.hands[state.seats[0]!]!).toHaveLength(3);
  expect(room.view(fixture.b).actionTiming).toEqual([]);
});
