import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type {
  BotStrategy,
  GameRules,
  JsonValue,
  RuleContext,
} from '../../../packages/game-sdk/src/index';
import type {
  Command,
  CommandReply,
  RoomView,
} from '../../../packages/protocol/src/index';
import type {
  Save,
  SaveRepository,
} from '../../../packages/platform-core/src/model';

type Entry = { key: string; rules: GameRules; bot: BotStrategy };
type Room = {
  hostToken: string;
  join(name: string): Promise<{ token: string }>;
  view(token?: string): RoomView;
  command(token: string, command: Command): Promise<CommandReply>;
};
type Views = { host: RoomView; player: RoomView; anonymous?: RoomView };
type GameFixture = {
  lobby: Views;
  playing: Views;
  stateSha256: string;
  phase: string;
  steps: number;
};

const stateObject = (state: JsonValue) => state as Record<string, JsonValue>;
const digest = (state: JsonValue) =>
  createHash('sha256').update(JSON.stringify(state)).digest('hex');

/** Legal rule continuation for source layouts; no saved history is fabricated. */
export async function preparePublicScreenRetirement(
  entries: Entry[],
  createRoom: (entry: Entry, repository: SaveRepository) => Room,
  parse: (input: unknown) => RoomView,
  allows: (
    rules: GameRules,
    state: JsonValue,
    action: JsonValue,
    seatId: string,
  ) => boolean,
  options: { selectedKeys?: string[]; includeMixedName?: boolean } = {},
) {
  const games: Record<string, GameFixture> = {};
  const proof: { method: string; entries: unknown[] } = {
    method:
      'Real RoomCoordinator joins/ready/start, then bounded legal rules.apply and bot decisions with complete state validation; independent authorized UI projections. Continuation does not claim transport, persistence or a naturally played match.',
    entries: [],
  };
  const selectedEntries = options.selectedKeys
    ? entries.filter((entry) => options.selectedKeys!.includes(entry.key))
    : entries;
  if (options.selectedKeys) {
    assert.equal(
      new Set(options.selectedKeys).size,
      options.selectedKeys.length,
    );
    assert.equal(selectedEntries.length, options.selectedKeys.length);
  }
  for (const entry of selectedEntries) {
    let saved: Save | null = null;
    const repository: SaveRepository = {
      load: () => structuredClone(saved),
      save: (value) => {
        saved = structuredClone(value);
      },
    };
    const room = createRoom(entry, repository);
    const players: { token: string }[] = [];
    let commands = 0;
    const act = async (credential: string, command: Command['command']) => {
      const view = room.view(credential);
      const reply = await room.command(credential, {
        actionId: randomUUID(),
        instanceId: view.instanceId,
        revision: view.revision,
        branch: view.branch,
        command,
      });
      assert(
        reply.ok,
        `${entry.key}: ${JSON.stringify(command)}: ${JSON.stringify(reply)}`,
      );
      commands++;
    };
    for (let index = 0; index < entry.rules.manifest.players.max; index++) {
      const joined = await room.join(
        index === 0
          ? '一起开心玩桌游呀'
          : index === 1
            ? 'WWWWWWWWWWWWWWWW'
            : index === 2 && options.includeMixedName
              ? '朋友WWWWWWWWWWWW'
              : `朋友${index + 1}`,
      );
      players.push(joined);
      await act(joined.token, { type: 'ready', ready: true });
    }
    const lobby = {
      host: parse(room.view(room.hostToken)),
      player: parse(room.view(players[0]!.token)),
      anonymous: parse(room.view('')),
    };
    await act(room.hostToken, { type: 'start' });
    if (room.view(room.hostToken).paused)
      await act(room.hostToken, { type: 'resume' });
    const initial = repository.load() as Save;
    assert(initial.snapshot);
    const seats = initial.seats.map((seat) => seat.id);
    let state = entry.rules.validateState(initial.snapshot.state, seats);
    const baseHost = parse(room.view(room.hostToken));
    const basePlayer = parse(room.view(players[0]!.token));
    assert.deepEqual(baseHost.gameView, room.view('').gameView);
    let seed = 728;
    const random = {
      next() {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
      },
    };
    const context: RuleContext = {
      seats,
      random,
      ...(initial.gameSetup ? { setup: initial.gameSetup } : {}),
    };
    let steps = 0;
    const actionsTaken: string[] = [];
    const snapshot = (key: string) => {
      state = entry.rules.validateState(state, seats);
      const decisions = entry.rules.decisions(state);
      const actor =
        decisions.find(
          (decision) => entry.rules.legalActions(state, decision.seatId).length,
        )?.seatId ?? seats[0]!;
      const decision = decisions.find((item) => item.seatId === actor);
      const ended = entry.rules.ended(state);
      const make = (role: 'host' | 'player') =>
        parse({
          ...(role === 'host' ? baseHost : basePlayer),
          status: ended ? 'ended' : 'playing',
          revision: steps + 100,
          paused: false,
          self: { role, seatId: role === 'player' ? actor : null },
          gameView: entry.rules.project(
            state,
            role === 'player'
              ? { role: 'player', seatId: actor }
              : { role: 'public' },
          ),
          actions:
            role === 'player' ? entry.rules.legalActions(state, actor) : [],
          lifecycleActions:
            role === 'host'
              ? (entry.rules.lifecycleActions?.(state) ?? [])
              : [],
          decisionId: decision?.id ?? null,
          selectionToken: decision?.id ?? null,
          decisionClock: null,
          history: [],
          endReason: ended ? '合法规则夹具已结束' : null,
        });
      const value = {
        lobby,
        playing: { host: make('host'), player: make('player') },
        stateSha256: digest(state),
        phase: String(stateObject(state).phase),
        steps,
      };
      assert.equal(value.playing.host.actions.length, 0);
      games[key] = value;
      proof.entries.push({
        key,
        seats: seats.length,
        commands,
        steps,
        phase: value.phase,
        stateSha256: value.stateSha256,
        actionsTaken: [...actionsTaken],
        validated: true,
      });
    };
    const step = async () => {
      const decision = entry.rules
        .decisions(state)
        .find((item) => entry.rules.legalActions(state, item.seatId).length);
      assert(decision, `${entry.key}: no legal decision before target phase`);
      const actions = entry.rules.legalActions(state, decision.seatId);
      const own = entry.rules.project(state, {
        role: 'player',
        seatId: decision.seatId,
      });
      let action: JsonValue | undefined;
      if (entry.key === 'modern-art') {
        const object = own as unknown as {
          self?: { hand?: { id: string; auctionKind: string }[] };
        };
        action =
          actions.find((item) => {
            const candidate = item as { type?: string; cardId?: string };
            return (
              candidate.type === 'offer' &&
              object.self?.hand?.some(
                (card) =>
                  card.id === candidate.cardId && card.auctionKind === 'double',
              )
            );
          }) ??
          actions.find(
            (item) => (item as { type?: string }).type === 'add-double',
          ) ??
          actions.find(
            (item) => (item as { type?: string }).type === 'decline-double',
          );
      }
      if (!action) {
        const result = await entry.bot.decide({
          view: own,
          actions,
          decision,
          memory: null,
          difficulty: 'juewu',
          random,
          signal: new AbortController().signal,
        });
        action = result.action;
      }
      assert(
        allows(entry.rules, state, action, decision.seatId),
        `${entry.key}: chosen action is not legal`,
      );
      state = entry.rules.validateState(
        entry.rules.apply(state, action, decision.seatId, context).state,
        seats,
      );
      actionsTaken.push(String((action as { type?: string }).type));
      steps++;
    };
    const reached = () => {
      const object = stateObject(state);
      if (entry.key === 'pokemon-encounters' || entry.key === 'expansion')
        return object.phase === 'draw';
      if (entry.key === 'power-grid') return object.phase === 'building';
      if (entry.key === 'manila') return object.phase === 'place';
      if (entry.key === 'avalon') {
        const discussion = object.discussion as
          { completed?: string[] } | undefined;
        return (
          object.phase === 'discussion' &&
          (discussion?.completed?.length ?? 0) === 2
        );
      }
      if (entry.key === 'modern-art') {
        const game = entry.rules.project(state, {
          role: 'public',
        }) as unknown as { phase: string; auction?: { cards?: unknown[] } };
        return game.phase === 'auction' && game.auction?.cards?.length === 2;
      }
      return true;
    };
    while (!reached() && steps < 5000 && !entry.rules.ended(state))
      await step();
    assert(
      reached(),
      `${entry.key}: target phase unreachable in bounded legal preparation`,
    );
    snapshot(entry.key);
    if (entry.key === 'avalon') {
      while (!entry.rules.ended(state) && steps < 5000) await step();
      assert(
        entry.rules.ended(state),
        'Avalon terminal target was not reached',
      );
      snapshot('avalon-ended');
    }
  }
  return { createdAt: Date.now(), games, proof };
}
