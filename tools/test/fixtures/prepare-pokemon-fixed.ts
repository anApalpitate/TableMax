import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { playerNameError } from '../../../packages/protocol/src/names';
import {
  RoomFeedbackSchema,
  type RoomFeedback,
} from '../../../packages/protocol/src';
import type { GameRules, JsonValue } from '../../../packages/game-sdk/src';
import type {
  Save,
  SaveRepository,
} from '../../../packages/platform-core/src/model';
import type {
  Command,
  CommandReply,
  RoomView,
} from '../../../packages/protocol/src';

export type PokemonFixedState =
  | 'draw'
  | 'held'
  | 'placement-selected'
  | 'replace-committed'
  | 'ability-choice'
  | 'ability-resolved'
  | 'private-peek'
  | 'target-private-peek'
  | 'mew-target-selected'
  | 'swap-selected'
  | 'swap-committed'
  | 'research-vote'
  | 'reposition-selected'
  | 'reposition-committed'
  | 'saved-sequence'
  | 'guidance-settings'
  | 'guidance-last-dark'
  | 'dense';
export type PokemonFixedRequest = {
  key: string;
  variant: 'pokemon-encounters' | 'expansion';
  seats: 2 | 3 | 6;
  state: PokemonFixedState;
};
export type PokemonPreparedState = {
  state: JsonValue;
  self: string;
  localSelection: boolean;
  preparation: string;
};
type Entry = {
  key: PokemonFixedRequest['variant'];
  rules: GameRules;
  make(state: PokemonFixedState, count: number): PokemonPreparedState;
};
type Room = {
  hostToken: string;
  join(name: string): Promise<{ token: string }>;
  view(token?: string): RoomView;
  command(token: string, command: Command): Promise<CommandReply>;
  subscribe(
    listener: (feedback?: RoomFeedback, savedAt?: number) => void,
  ): () => void;
};
const denseNames = [
  '一起开心玩桌游呀',
  'WWWWWWWWWWWWWWWW',
  '朋友WWWWWWWWWWWW',
  '宝可梦奇遇训练家',
  'ABCDEFGHIJKLMNOP',
  '玩家ABC朋友WXYZ',
];
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Exact identity remapping, never a projected-view or incomplete-deck patch. */
function remapSeats(value: JsonValue, mapping: Map<string, string>): JsonValue {
  if (typeof value === 'string') return mapping.get(value) ?? value;
  if (Array.isArray(value))
    return value.map((entry) => remapSeats(entry, mapping));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        mapping.get(key) ?? key,
        remapSeats(entry, mapping),
      ]),
    );
  return value;
}

/** Source fixtures only: complete state permutation plus production apply/validate. */
export async function preparePokemonFixedScenes(
  entries: Entry[],
  requests: PokemonFixedRequest[],
  createRoom: (
    rules: GameRules,
    repository: SaveRepository,
    variant: PokemonFixedRequest['variant'],
  ) => Room,
  parse: (value: unknown) => RoomView,
) {
  assert(requests.length, 'No Pokemon fixture requested');
  assert.equal(new Set(requests.map((item) => item.key)).size, requests.length);
  const games: Record<string, unknown> = {};
  const proof: unknown[] = [];
  for (const request of requests) {
    assert([2, 3, 6].includes(request.seats));
    const entry = entries.find((value) => value.key === request.variant);
    assert(entry, `Unimported Pokemon variant: ${request.variant}`);
    const prepared = entry.make(request.state, request.seats);
    const sourceSeats = (prepared.state as { seatOrder: string[] }).seatOrder;
    assert.equal(sourceSeats.length, request.seats);
    const joinNames = [...denseNames];
    if (
      request.variant === 'expansion' &&
      request.seats === 6 &&
      request.state === 'target-private-peek'
    ) {
      const stateBeforeNames = hash(prepared.state);
      const projection = entry.rules.project(prepared.state, {
        role: 'player',
        seatId: prepared.self,
      }) as { peek?: { seat: string } };
      assert.equal(
        hash(prepared.state),
        stateBeforeNames,
        'Reading the peek target never changes authoritative state',
      );
      assert(projection.peek);
      const target = sourceSeats.indexOf(projection.peek.seat);
      const actor = sourceSeats.indexOf(prepared.self);
      assert(target >= 0 && actor >= 0);
      const widest = 'W'.repeat(16);
      const otherWide = 'W'.repeat(15) + 'M';
      if (actor !== target) {
        const oldEnglish = joinNames.indexOf('ABCDEFGHIJKLMNOP');
        assert(oldEnglish >= 0);
        joinNames[oldEnglish] = otherWide;
      }
      const assignBySwap = (index: number, name: string) => {
        const previous = joinNames.indexOf(name);
        assert(previous >= 0);
        [joinNames[index], joinNames[previous]] = [
          joinNames[previous]!,
          joinNames[index]!,
        ];
      };
      assignBySwap(target, widest);
      if (actor !== target) assignBySwap(actor, otherWide);
      assert.equal(new Set(joinNames).size, request.seats);
      assert(
        joinNames.includes('一起开心玩桌游呀') &&
          joinNames.includes('朋友WWWWWWWWWWWW'),
      );
      for (const name of joinNames) assert.equal(playerNameError(name), null);
    }
    let state: JsonValue | undefined;
    let selectedSeat: string | undefined;
    const rules: GameRules = {
      ...entry.rules,
      initialize(context) {
        const mapping = new Map(
          sourceSeats.map((seat, index) => [seat, context.seats[index]!]),
        );
        selectedSeat = mapping.get(prepared.self);
        assert(selectedSeat);
        state = entry.rules.validateState(
          remapSeats(prepared.state, mapping),
          context.seats,
        );
        return state;
      },
    };
    let saved: Save | null = null;
    const repository: SaveRepository = {
      load: () => structuredClone(saved),
      save: (value) => {
        saved = structuredClone(value);
      },
    };
    const room = createRoom(rules, repository, request.variant);
    const players: { token: string }[] = [];
    const act = async (token: string, command: Command['command']) => {
      const current = room.view(token);
      const reply = await room.command(token, {
        actionId: randomUUID(),
        instanceId: current.instanceId,
        branch: current.branch,
        revision: current.revision,
        command,
      });
      assert(reply.ok, JSON.stringify(reply));
    };
    for (let index = 0; index < request.seats; index++) {
      const player = await room.join(joinNames[index]!);
      players.push(player);
      await act(player.token, { type: 'ready', ready: true });
    }
    const lobby = {
      host: parse(room.view(room.hostToken)),
      player: parse(room.view(players[0]!.token)),
    };
    await act(room.hostToken, { type: 'start' });
    if (room.view(room.hostToken).paused)
      await act(room.hostToken, { type: 'resume' });
    assert(state && selectedSeat);
    const host = parse(room.view(room.hostToken));
    const anonymous = parse(room.view(''));
    assert.equal(host.game?.id, 'pokemon-encounters');
    if (request.variant === 'expansion')
      assert.equal(host.game?.variantId, 'expansion');
    const playerToken = players.find(
      (player) => room.view(player.token).self.seatId === selectedSeat,
    )?.token;
    assert(playerToken);
    const player = parse(room.view(playerToken));
    if (
      request.variant === 'expansion' &&
      request.seats === 6 &&
      request.state === 'target-private-peek'
    ) {
      const peek = (player.gameView as { peek: { seat: string } }).peek;
      assert.equal(
        player.seats.find((seat) => seat.id === peek.seat)?.name,
        'W'.repeat(16),
        'The real joined target owns the widest name',
      );
      if (peek.seat !== player.self.seatId)
        assert.equal(
          player.seats.find((seat) => seat.id === player.self.seatId)?.name,
          'W'.repeat(15) + 'M',
          'The real joined actor owns the other widest name',
        );
    }
    assert.equal(host.self.seatId, null);
    assert.deepEqual(host.gameView, anonymous.gameView);
    assert.equal(host.actions.length, 0);
    assert.equal((host.gameView as { peek?: unknown }).peek ?? null, null);
    if (['private-peek', 'target-private-peek'].includes(request.state)) {
      assert(
        (player.gameView as { peek?: unknown }).peek,
        'The selected player owns the actual private peek',
      );
      for (const other of players.filter(
        (value) => value.token !== playerToken,
      ))
        assert.equal(
          (room.view(other.token).gameView as { peek?: unknown }).peek ?? null,
          null,
          'Other players never receive this private peek',
        );
    }
    const snapshot = (repository.load() as Save | null)?.snapshot;
    assert(snapshot);
    const source = {
      variant: request.variant,
      gameId: 'pokemon-encounters',
      seats: request.seats,
      state: request.state,
      phase: (state as { phase: string }).phase,
      stateSha256: hash(snapshot.state),
      localSelection: prepared.localSelection,
      preparation: prepared.preparation,
      validated: true,
      boundary:
        'Real RoomCoordinator joins/ready/start with verification-only complete initialized-state permutation and production rules.apply/validate; not a naturally played match, transport, save-recovery or physical-device proof.',
    };
    games[request.key] = {
      lobby,
      playing: { host, player, anonymous },
      ...source,
      ...(request.state === 'saved-sequence'
        ? {
            savedTransactions: await prepareSavedTransactions(entry),
          }
        : {}),
    };
    proof.push({ key: request.key, ...source });

    async function prepareSavedTransactions(sourceEntry: Entry) {
      const observerToken = playerToken!;
      const authorized = () => {
        const result = {
          host: parse(room.view(room.hostToken)),
          player: parse(room.view(observerToken)),
          anonymous: parse(room.view('')),
        };
        assert.equal(result.host.self.seatId, null);
        assert.equal(result.host.actions.length, 0);
        assert.deepEqual(result.host.gameView, result.anonymous.gameView);
        assert.equal(
          (result.host.gameView as { peek?: unknown }).peek ?? null,
          null,
        );
        return result;
      };
      const transactions = [];
      for (const kind of ['peek', 'close-peek', 'draw', 'mew-target']) {
        const current = repository.load() as Save | null;
        assert(current?.snapshot);
        const authoritativeState = sourceEntry.rules.validateState(
          current.snapshot.state,
          current.seats.map((seat) => seat.id),
        );
        const candidates = players.map((candidate) => ({
          token: candidate.token,
          view: parse(room.view(candidate.token)),
        }));
        const actor = candidates.find(({ view }) =>
          view.actions.some(
            (value) =>
              (value as { type?: string }).type === kind &&
              (kind !== 'draw' ||
                (value as { source?: string }).source === 'deck'),
          ),
        );
        assert(actor, `No legal saved-sequence actor for ${kind}`);
        const action = actor.view.actions.find((value) => {
          const candidate = value as {
            type?: string;
            source?: string;
            slot?: number;
            seat?: string;
          };
          if (candidate.type !== kind) return false;
          if (kind === 'draw') return candidate.source === 'deck';
          if (kind === 'peek') return candidate.slot === 2;
          if (kind === 'mew-target') {
            const boards = (
              authoritativeState as {
                boards: Record<string, { faceUp: boolean }[]>;
              }
            ).boards;
            return (
              candidate.seat &&
              candidate.slot !== undefined &&
              !boards[candidate.seat]![candidate.slot]!.faceUp
            );
          }
          return true;
        });
        assert(action, `No chosen legal saved-sequence action ${kind}`);
        const before = authorized();
        const intent: Command['command'] = {
          type: 'game',
          decisionId: actor.view.decisionId!,
          action: action as JsonValue,
        };
        const envelope: Command = {
          actionId: randomUUID(),
          instanceId: actor.view.instanceId,
          branch: actor.view.branch,
          revision: actor.view.revision,
          command: intent,
        };
        const received: {
          feedback: RoomFeedback;
          savedAt: number | undefined;
        }[] = [];
        const invalid: string[] = [];
        const unsubscribe = room.subscribe((feedback, savedAt) => {
          if (!feedback) return;
          const parsed = RoomFeedbackSchema.safeParse(feedback);
          if (parsed.success) received.push({ feedback: parsed.data, savedAt });
          else invalid.push(parsed.error.message);
        });
        let reply: CommandReply;
        try {
          reply = await room.command(actor.token, envelope);
        } finally {
          unsubscribe();
        }
        assert(reply.ok, JSON.stringify(reply));
        assert.equal(invalid.length, 0, JSON.stringify(invalid));
        const after = authorized();
        assert.equal(after.player.instanceId, before.player.instanceId);
        assert.equal(after.player.branch, before.player.branch);
        assert.equal(after.player.revision, before.player.revision + 1);
        const matching = received.filter(
          ({ feedback }) =>
            feedback.instanceId === after.player.instanceId &&
            feedback.branch === after.player.branch &&
            feedback.revision === after.player.revision,
        );
        assert.equal(
          matching.length,
          1,
          'Exactly one actual subscribed feedback belongs to the saved transaction',
        );
        const feedback = matching[0]!.feedback;
        assert(feedback.events.length > 0);
        const snapshotAfter = (repository.load() as Save | null)?.snapshot;
        assert(snapshotAfter);
        sourceEntry.rules.validateState(
          snapshotAfter.state,
          current.seats.map((seat) => seat.id),
        );
        const peeking =
          (after.player.gameView as { peek?: unknown }).peek ?? null;
        if (kind === 'peek') {
          assert.equal(actor.view.self.seatId, selectedSeat);
          assert(peeking, 'Actual private peek belongs to the observing owner');
          for (const candidate of candidates.filter(
            ({ token }) => token !== observerToken,
          ))
            assert.equal(
              (room.view(candidate.token).gameView as { peek?: unknown })
                .peek ?? null,
              null,
            );
        } else assert.equal(peeking, null);
        if (kind === 'draw') {
          assert.notEqual(
            actor.view.self.seatId,
            selectedSeat,
            'The next actual player owns the public Mew draw',
          );
          assert.equal(
            (after.player.gameView as { held?: { categoryId?: string } }).held
              ?.categoryId,
            'special-mew',
          );
        }
        transactions.push({
          index: transactions.length,
          actor: actor.view.self.seatId,
          uiOwned: actor.view.self.seatId === selectedSeat,
          intent,
          envelope,
          reply,
          feedback,
          before,
          after,
          stateBeforeSha256: hash(current.snapshot.state),
          stateAfterSha256: hash(snapshotAfter.state),
          source:
            'Actual RoomCoordinator.command save and room.subscribe feedback, parsed by RoomFeedbackSchema; authorized production room.view projections only. No events are taken from CommandReply or fabricated from the state diff.',
        });
      }
      return transactions;
    }
  }
  return { games, proof };
}
