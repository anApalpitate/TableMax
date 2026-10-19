import { afterEach, expect, it, vi } from 'vitest';
import type { BotStrategy, GameRules, JsonValue } from '@tablemax/game-sdk';
import {
  CommandSchema,
  RoomViewSchema,
  type Command,
} from '@tablemax/protocol';
import {
  rules as templateRules,
  bot as templateBot,
} from '../../../games/template';
import { RoomCoordinator, token } from './room';
import { BotScheduler } from './bot-scheduler';
import type { Save, SaveRepository } from './model';

type State = {
  seats: string[];
  setup: { delayMs: number };
  serial: number;
  open: boolean;
  last: string;
};
const defaults = { delayMs: 500 };
const setup = {
  defaults,
  validate(value: unknown) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).join(',') !== 'delayMs' ||
      !Number.isSafeInteger((value as typeof defaults).delayMs) ||
      (value as typeof defaults).delayMs < 0 ||
      (value as typeof defaults).delayMs > 5000
    )
      throw new Error('invalid setup');
    return { delayMs: (value as typeof defaults).delayMs };
  },
  fromState: (value: JsonValue) => ({ ...(value as State).setup }),
};
const fixtureRules: GameRules = {
  manifest: { ...templateRules.manifest, id: 'reaction-fixture' },
  setup,
  initialize: (context) => ({
    seats: [...context.seats],
    setup: setup.validate(context.setup ?? defaults),
    serial: 0,
    open: false,
    last: '',
  }),
  validateState: (input) => structuredClone(input as JsonValue),
  validateAction: (input) => {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      !['open', 'declare', 'catch'].includes(
        String((input as { type: string }).type),
      )
    )
      throw new Error('invalid action');
    return input as JsonValue;
  },
  decisions: (input) => {
    const s = input as State;
    return (s.open ? s.seats : [s.seats[0]!]).map((seatId) => ({
      seatId,
      id: `${s.serial}:${seatId}`,
    }));
  },
  legalActions: (input, seat) => {
    const s = input as State;
    return s.open
      ? [{ type: seat === s.seats[0] ? 'declare' : 'catch' }]
      : seat === s.seats[0]
        ? [{ type: 'open' }]
        : [];
  },
  actionTiming: (input, action) => {
    const s = input as State;
    return (action as { type: string }).type === 'catch'
      ? { key: `window:${s.serial}`, delayMs: s.setup.delayMs }
      : null;
  },
  ended: () => false,
  botTiming: (input) =>
    (input as State).open
      ? { key: `reaction:${(input as State).serial}`, minMs: 0, maxMs: 0 }
      : null,
  lifecycleActions: () => [],
  applyLifecycle: () => {
    throw new Error('unavailable');
  },
  apply: (input, action) => {
    const s = input as State;
    const type = (action as { type: string }).type;
    return {
      state: { ...s, serial: s.serial + 1, open: type === 'open', last: type },
      decision: { label: type, revealedInformation: false },
    };
  },
  project: (input) => structuredClone(input),
};
const bot: BotStrategy = {
  ...templateBot,
  gameId: fixtureRules.manifest.id,
  decide: async (input) => ({ action: input.actions[0]!, memory: null }),
};
class Repository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    if (this.fail) throw new Error('disk full');
    this.value = structuredClone(value);
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function envelope(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
): Command {
  const v = room.view(credential);
  return {
    actionId: token(),
    instanceId: v.instanceId,
    revision: v.revision,
    branch: v.branch,
    command,
  };
}
const send = (
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) => room.command(credential, envelope(room, command, credential));
async function fixture(start = true) {
  const repository = new Repository();
  const room = new RoomCoordinator(fixtureRules, bot, repository);
  const a = (await room.join('甲')).token;
  const b = (await room.join('乙')).token;
  if (start) {
    for (const credential of [a, b])
      await send(room, { type: 'ready', ready: true }, credential);
    expect((await send(room, { type: 'start' })).ok).toBe(true);
  }
  return { room, repository, a, b };
}
async function act(room: RoomCoordinator, credential: string, type: string) {
  return send(
    room,
    {
      type: 'game',
      decisionId: room.view(credential).decisionId!,
      action: { type },
    },
    credential,
  );
}

it('validates, authorizes and atomically saves pregame options while clearing readiness', async () => {
  const { room, repository, a, b } = await fixture(false);
  expect(
    CommandSchema.safeParse(
      envelope(room, { type: 'set-game-setup', setup: { delayMs: 1000 } }),
    ).success,
  ).toBe(true);
  expect(RoomViewSchema.safeParse(room.view()).success).toBe(true);
  expect(
    await send(room, { type: 'set-game-setup', setup: { delayMs: 1000 } }, b),
  ).toMatchObject({ ok: false, reason: 'unauthorized' });
  for (const value of [
    { delayMs: -1 },
    { delayMs: 5001 },
    { delayMs: 1.2 },
    { delayMs: 500, hidden: true },
  ])
    expect(
      await send(room, { type: 'set-game-setup', setup: value }),
    ).toMatchObject({ ok: false, reason: 'invalid-game-setup' });
  for (const credential of [a, b])
    await send(room, { type: 'ready', ready: true }, credential);
  repository.fail = true;
  expect(
    (await send(room, { type: 'set-game-setup', setup: { delayMs: 1000 } })).ok,
  ).toBe(false);
  expect(room.view().seats.every((s) => s.ready)).toBe(true);
  expect(room.view().game?.setup).toEqual(defaults);
  repository.fail = false;
  expect(
    (await send(room, { type: 'set-game-setup', setup: { delayMs: 1000 } })).ok,
  ).toBe(true);
  expect(room.view().seats.every((s) => !s.ready)).toBe(true);
  for (const credential of [a, b])
    await send(room, { type: 'ready', ready: true }, credential);
  await send(room, { type: 'start' });
  expect((room.view().gameView as State).setup.delayMs).toBe(1000);
  expect(
    await send(room, { type: 'set-game-setup', setup: defaults }),
  ).toMatchObject({ ok: false, reason: 'not-in-lobby' });
  const restored = new RoomCoordinator(fixtureRules, bot, repository);
  expect(restored.view().game?.setup).toEqual({ delayMs: 1000 });
});

it('enforces the exact server grace boundary while leaving the owner declaration immediate', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_900_000_000_000);
  const { room, repository, a, b } = await fixture();
  await act(room, a, 'open');
  expect(room.view(b).actionTiming?.[0]?.remainingMs).toBe(500);
  expect(room.view(a).actionTiming).toEqual([]);
  const early = envelope(
    room,
    {
      type: 'game',
      decisionId: room.view(b).decisionId!,
      action: { type: 'catch' },
    },
    b,
  );
  const before = structuredClone(repository.value);
  vi.advanceTimersByTime(499);
  expect(await room.command(b, early)).toMatchObject({
    ok: false,
    reason: 'action-not-ready',
  });
  expect(repository.value).toEqual(before);
  vi.advanceTimersByTime(1);
  const accepted = envelope(room, early.command, b);
  expect((await room.command(b, accepted)).ok).toBe(true);
  const revision = room.view().revision;
  expect((await room.command(b, accepted)).ok).toBe(true);
  expect(room.view().revision).toBe(revision);
  await act(room, a, 'open');
  expect((await act(room, a, 'declare')).ok).toBe(true);
});

it('freezes grace on pause/restart, resists reminder resets and resets a rollback branch', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_900_000_000_000);
  const { room, repository, a, b } = await fixture();
  await act(room, a, 'open');
  vi.advanceTimersByTime(100);
  await send(room, { type: 'set-countdown', seconds: 40 });
  expect(room.view(b).actionTiming?.[0]?.remainingMs).toBe(400);
  await send(room, { type: 'pause' });
  vi.advanceTimersByTime(5000);
  expect(room.view(b).actionTiming?.[0]).toMatchObject({
    remainingMs: 400,
    running: false,
  });
  const restored = new RoomCoordinator(
    fixtureRules,
    bot,
    repository,
    room.hostToken,
  );
  expect(restored.view(b).actionTiming?.[0]?.remainingMs).toBe(400);
  await send(restored, { type: 'resume' });
  vi.advanceTimersByTime(400);
  expect((await act(restored, b, 'catch')).ok).toBe(true);
  const checkpointId = restored.view(restored.hostToken).history.at(-1)!.id;
  await send(restored, { type: 'pause' });
  expect((await send(restored, { type: 'rollback', checkpointId })).ok).toBe(
    true,
  );
  expect(restored.view(b).actionTiming?.[0]?.remainingMs).toBe(500);
});

it('rejects damaged timer/config metadata and leaves modules without either extension unchanged', async () => {
  const { room, repository, a } = await fixture();
  await act(room, a, 'open');
  const good = structuredClone(repository.value!);
  for (const change of [
    (s: Save) => {
      delete s.actionClocks;
    },
    (s: Save) => {
      s.actionClocks![0]!.remainingMs = 5001;
    },
    (s: Save) => {
      s.actionClocks![0]!.key = '0'.repeat(64);
    },
    (s: Save) => {
      s.gameSetup = { delayMs: 200 };
    },
  ]) {
    repository.value = structuredClone(good);
    change(repository.value);
    expect(() => new RoomCoordinator(fixtureRules, bot, repository)).toThrow(
      'damaged-save',
    );
  }
  const plain = new RoomCoordinator(
    templateRules,
    templateBot,
    new Repository(),
  );
  expect(plain.view().game).not.toHaveProperty('setup');
  expect(plain.view()).not.toHaveProperty('actionTiming');
  expect(
    await send(plain, { type: 'set-game-setup', setup: defaults }),
  ).toMatchObject({ ok: false, reason: 'game-setup-unavailable' });
});

it('waits a selected bot action through its grace without treating it as an execution timeout', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_900_000_000_000);
  const repository = new Repository();
  const room = new RoomCoordinator(fixtureRules, bot, repository);
  const a = (await room.join('甲')).token;
  await send(room, { type: 'add-bot', name: '乙' });
  await send(room, { type: 'set-game-setup', setup: { delayMs: 5000 } });
  await send(room, { type: 'ready', ready: true }, a);
  await send(room, { type: 'start' });
  await act(room, a, 'open');
  const scheduler = new BotScheduler(room, 0, 100);
  try {
    await vi.advanceTimersByTimeAsync(4999);
    expect((room.view().gameView as State).open).toBe(true);
    expect(room.view().botError).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect((room.view().gameView as State).last).toBe('catch');
    expect(room.view().botError).toBeNull();
  } finally {
    scheduler.stop();
  }
});

it('recalculates a fresh bot decision after a metadata revision interrupts the grace wait', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_900_000_000_000);
  const room = new RoomCoordinator(fixtureRules, bot, new Repository());
  const a = (await room.join('甲')).token;
  await send(room, { type: 'add-bot', name: '乙' });
  await send(room, { type: 'set-game-setup', setup: { delayMs: 5000 } });
  await send(room, { type: 'ready', ready: true }, a);
  await send(room, { type: 'start' });
  await act(room, a, 'open');
  const scheduler = new BotScheduler(room, 0, 100);
  try {
    await vi.advanceTimersByTimeAsync(100);
    await send(room, { type: 'set-countdown', seconds: 40 });
    await vi.advanceTimersByTimeAsync(4899);
    expect((room.view().gameView as State).open).toBe(true);
    await vi.advanceTimersByTimeAsync(11);
    expect((room.view().gameView as State).last).toBe('catch');
    expect(room.view().botError).toBeNull();
  } finally {
    scheduler.stop();
  }
});
