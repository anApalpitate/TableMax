import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { HostedGame } from '../../../packages/web-host/src';
import type { RoomSession } from '../../../apps/web/src/session/useRoomSession';
import { client } from '../../../games/pokemon-encounters/expansion/web';
import { ResearchCard } from '../../../games/pokemon-encounters/expansion/web/ResearchCard';
import { task } from '../../../games/pokemon-encounters/expansion/research';
import { AVATAR_PRESETS } from '../../../packages/protocol/src';
import { poseSequences } from '../../../games/pokemon-encounters/expansion/web/poses/timeline';
import { pokemonExpansion as rules } from '../../../games/pokemon-encounters/expansion';
import {
  validateState,
  decisionId,
  type State,
  type Action,
} from '../../../games/pokemon-encounters/expansion/state';
import { RandomSource } from '../../../packages/platform-core/src/random';
import '../../../apps/web/src/styles.css';

type Settings = {
  scenario?: 'draw' | 'vote' | 'place' | 'result' | 'row';
  seats?: number;
  creature?: string;
  ordinary?: string;
  role?: 'host' | 'public' | 'player';
  animate?: boolean;
  paused?: boolean;
  connected?: boolean;
  branch?: number;
  terminal?: boolean;
  commonWinner?: boolean;
  emptyDiscard?: boolean;
  waiting?: boolean;
};
declare global {
  interface Window {
    redesignShow(settings: Settings): {
      phase: string;
      events: State['events'];
      privateCards: string[];
    };
    redesignResearch(creature: string): void;
    expansionTimelines: typeof poseSequences;
    redesignCommands: { action: string; before: string; after: string }[];
  }
}
const root = createRoot(document.getElementById('root')!);

let serial = 0;
function fixture(settings: Settings) {
  const seats = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].slice(
    0,
    settings.seats ?? 6,
  );
  window.redesignCommands = [];
  const ctx = { seats, random: new RandomSource(1060651) };
  let state = rules.initialize(ctx);
  if (settings.commonWinner) state.researchCandidates = ['R01', 'R02', 'R03'];
  const apply = (action: Action) => {
    const actor =
      state.phase === 'zapdos-receive'
        ? state.recipientQueue[state.recipientIndex]!
        : state.turnSeat;
    state = rules.apply(state, action, actor, ctx).state;
    validateState(state, seats);
  };
  if (settings.scenario !== 'vote') {
    for (const seat of seats)
      state = rules.apply(
        state,
        { type: 'vote-research', taskId: state.researchCandidates[0]! },
        seat,
        ctx,
      ).state;
    for (const seat of seats)
      state = rules.apply(
        state,
        { type: 'initial-flip', slot: 0 },
        seat,
        ctx,
      ).state;
  }
  const actor = state.turnSeat;
  const swapInstance = (wanted: string, replacement: string) => {
    for (const board of Object.values(state.boards))
      for (const slot of board)
        if (slot.instanceId === wanted) slot.instanceId = replacement;
    state.deck = state.deck.map((id) => (id === wanted ? replacement : id));
    state.discard = state.discard.map((id) =>
      id === wanted ? replacement : id,
    );
  };
  const placeReference = (
    seat: string,
    slot: number,
    category: string,
    copy = 1,
  ) => {
    const wanted = `${category}#${String(copy).padStart(2, '0')}`,
      previous = state.boards[seat]![slot]!.instanceId;
    if (wanted !== previous) swapInstance(wanted, previous);
    state.boards[seat]![slot] = { instanceId: wanted, faceUp: true };
  };
  if (settings.terminal) {
    const others = seats.filter((seat) => seat !== actor);
    placeReference(others[0]!, 0, 'special-kyogre');
    if (others[1]) placeReference(others[1], 0, 'special-rayquaza');
    for (const slot of state.boards[actor]!) slot.faceUp = true;
    state.boards[actor]![8]!.faceUp = false;
    state.winsBySeat[actor] = 2;
  }
  if (settings.commonWinner) {
    const other = seats.find((seat) => seat !== actor)!;
    for (const [seat, values] of [
      [actor, [3, 4, 5]],
      [other, [0, 1, 6]],
    ] as const) {
      values.forEach((value, row) => {
        for (let col = 0; col < 3; col++)
          placeReference(
            seat,
            row * 3 + col,
            `ordinary-${value}`,
            col + 1 + (value === 5 ? 1 : 0),
          );
      });
      state.winsBySeat[seat] = 2;
    }
    state.boards[actor]![8]!.faceUp = false;
  }
  if (settings.scenario === 'draw') {
    ['special-rayquaza#01', 'special-ditto#01'].forEach((wanted, i) => {
      const index = state.discard.length - 1 - i,
        previous = state.discard[index]!;
      if (wanted !== previous) swapInstance(wanted, previous);
      state.discard[index] = wanted;
    });
  }
  if (settings.emptyDiscard) {
    state.deck.push(...state.discard);
    state.discard = [];
  }
  const before = rules.project(state, { role: 'public' });
  if (!['vote', 'draw'].includes(settings.scenario ?? '')) {
    const category = settings.ordinary
      ? `ordinary-${settings.ordinary}`
      : `special-${settings.creature ?? 'mewtwo'}`;
    const wanted = `${category}#01`,
      top = state.deck.at(-1)!;
    if (wanted !== top) swapInstance(wanted, top);
    state.deck[state.deck.length - 1] = wanted;
    validateState(state, seats);

    apply({ type: 'draw', source: 'deck' });
    const take = (type: Action['type']) => {
      const selected = rules
        .legalActions(state, actor)
        .find((action) => action.type === type);
      if (!selected)
        throw new Error(`Missing legal fixture ${type}/${state.phase}`);
      apply(selected);
    };
    if (!settings.ordinary) {
      const creature = settings.creature ?? 'mewtwo';
      if (creature === 'mew') take('mew-target');
      else if (creature === 'mewtwo') {
        take('mewtwo-target');
        take('mewtwo-exchange');
      } else if (creature === 'zapdos') take('pass-direction');
      else if (creature !== 'team-rocket') {
        apply({ type: 'replace', slot: settings.terminal ? 8 : 1 });
        const choices: Record<string, Action['type']> = {
          charizard: 'peek',
          snorlax: 'swap',
          arceus: 'activate-arceus',
          greninja: 'ninja-target',
          lucario: 'extra-draw',
          groudon: 'row-target',
          kyogre: 'row-target',
          rayquaza: 'row-target',
        };
        if (choices[creature] && settings.scenario !== 'row') {
          if (settings.terminal && creature === 'groudon') {
            // Preserve the complete actor row so this legal last ability really settles.
            const row = 2;
            const other = seats.find((seat) => seat !== actor)!;
            for (let i = row * 3; i < row * 3 + 3; i++)
              state.boards[other]![i]!.faceUp = true;
          }
          take(choices[creature]!);
        }
      }
    }

    if (settings.scenario === 'result') apply({ type: 'replace', slot: 8 });
  }
  validateState(state, seats);
  const role = settings.role ?? 'host';
  const viewerSeat = settings.waiting
    ? seats.find((seat) => seat !== actor)!
    : actor;
  const game = rules.project(
    state,
    role === 'player' ? { role, seatId: viewerSeat } : { role },
  );
  const changed = client.savedChanges(before, game);
  const currentSeats = seats.map((id, i) => ({
    id,
    name: `玩家${i + 1}`,
    avatarId: AVATAR_PRESETS[i]!.id,
    controller: 'human' as const,
    ready: true,
    online: true,
  }));
  const last = before.events.at(-1)?.id ?? 0;
  const events = game.events.filter((event) => event.id > last);
  const view = {
    instanceId: 'vector-fixture',
    revision: ++serial,
    branch: settings.branch ?? 0,
    status: 'playing',
    paused: settings.paused ?? false,
    restored: false,
    joinOpen: false,
    playMode: 'play',
    countdownSeconds: 20,
    decisionClock: null,
    game: {
      id: 'pokemon-encounters',
      name: '宝可梦奇遇',
      min: 2,
      max: 6,
      variantId: 'expansion',
      variants: [],
      decisionTimer: true,
    },
    catalog: [],
    ownerSeatId: null,
    capabilities: { manage: false, control: false, manageSeats: false },
    seats: currentSeats,
    self: { role, seatId: role === 'player' ? viewerSeat : null },
    gameView: game,
    actions: role === 'player' ? rules.legalActions(state, viewerSeat) : [],
    decisionId: decisionId(state, actor),
    selectionToken: decisionId(state, actor),
    history: [],
    lifecycleActions: [],
    botError: null,
    endReason: null,
  };
  const session = {
    role,
    view,
    connected: settings.connected ?? true,
    locked: settings.paused ?? false,
    self:
      role === 'player'
        ? currentSeats.find((seat) => seat.id === viewerSeat)
        : undefined,
    canControl: false,
    isHost: role === 'host',
    name: '',
    message: '',
    admissionPending: false,
    awaitingConfirmation: false,
    busy: false,
    errorId: '',
    credential: role === 'player' ? 'fixture-owner' : null,
    motion: settings.animate === false ? [] : changed,
    feedback: null,
    command(command: { type: string; decisionId?: string; action?: Action }) {
      if (command.type !== 'game' || !command.action) return;
      if (command.decisionId !== decisionId(state, actor))
        throw new Error('Fixture received stale component intent');
      const before = state.phase;
      apply(command.action);
      window.redesignCommands.push({
        action: command.action.type,
        before,
        after: state.phase,
      });
    },
    setName() {},
    join() {},
    retry() {},
  } as unknown as RoomSession;
  return { session, state, game, events };
}
window.redesignShow = (settings) => {
  const { session, game, events } = fixture(settings);
  document.body.className = '';
  flushSync(() =>
    root.render(<HostedGame key={serial} session={session} client={client} />),
  );
  window.scrollTo(0, 0);
  return {
    phase: game.phase,
    events,
    privateCards: game.peek?.cards.map((card) => card.card.categoryId) ?? [],
  };
};
window.expansionTimelines = poseSequences;
window.redesignResearch = (id) => {
  document.body.className = '';
  flushSync(() =>
    root.render(
      <div className="expansion-screen ex-research-detail">
        <ResearchCard task={task(id)} />
      </div>,
    ),
  );
};
window.redesignShow({
  ordinary: 'magikarp',
  scenario: 'draw',
  role: 'player',
  animate: false,
});
