import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PlatformGame } from '../../../apps/web/src/session/gameHostAdapter';
import type { RoomSession } from '../../../apps/web/src/session/useRoomSession';
import { client } from '../../../games/pokemon-encounters/expansion/web';
import { ResearchCard } from '../../../games/pokemon-encounters/expansion/web/ResearchCard';
import { task } from '../../../games/pokemon-encounters/expansion/research';
import { AVATAR_PRESETS } from '../../../packages/protocol/src';
import { poseSequences } from '../../../games/pokemon-encounters/expansion/web/poses/timeline';
import { pokemonExpansion as rules } from '../../../games/pokemon-encounters/expansion';
import {
  decisionId,
  type State,
  type Action,
} from '../../../games/pokemon-encounters/expansion/state';
import { createPokemonExpansionState } from './pokemon-expansion-state';
import { type EventKind } from '../../../games/pokemon-encounters/expansion/events';
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
  message?: string;
  messageKind?: 'saved' | 'error' | null;
  busy?: boolean;
  initial?: boolean;
  targetStage?: boolean;
  event?: EventKind;
  buffer?: 'occupied' | 'take';
  admissionPending?: boolean;
  awaitingConfirmation?: boolean;
};
declare global {
  interface Window {
    redesignShow(settings: Settings): {
      phase: string;
      events: State['events'];
      privateCards: string[];
    };
    redesignResearch(creature: string): void;
    redesignUpdate(settings: Partial<Settings>): void;
    expansionTimelines: typeof poseSequences;
    redesignCommands: { action: string; before: string; after: string }[];
  }
}
const root = createRoot(document.getElementById('root')!);

let serial = 0;
function fixture(settings: Settings) {
  window.redesignCommands = [];
  const prepared = createPokemonExpansionState(settings);
  const { seats, actor, before } = prepared;
  let state = prepared.state;
  const apply = (action: Action) => {
    prepared.apply(action);
    state = prepared.state;
  };
  const role = settings.role ?? 'host';
  const viewerSeat = settings.waiting
    ? seats.find((seat) => seat !== actor)!
    : actor;
  const game = rules.project(
    state,
    role === 'player' ? { role, seatId: viewerSeat } : { role: 'public' },
  );
  const changed = client.savedChanges(before, game);
  const currentSeats = seats.map((id, i) => ({
    id,
    name: [
      '首席宝可梦玩家',
      'ABCDEFGHIJKLMNOP',
      '朋友三ABCDEFG',
      '朋友四',
      '朋友五',
      '朋友六',
    ][i]!,
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
    message: settings.message ?? '',
    messageKind: settings.messageKind ?? null,
    admissionPending: settings.admissionPending ?? false,
    awaitingConfirmation: settings.awaitingConfirmation ?? false,
    retryAdmission() {},
    busy: settings.busy ?? false,
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
      const gameView = rules.project(
        state,
        role === 'player' ? { role, seatId: viewerSeat } : { role: 'public' },
      );
      const nextDecision = decisionId(state, state.turnSeat);
      flushSync(() =>
        root.render(
          <PlatformGame
            key={mountedSerial}
            session={{
              ...session,
              view: {
                ...session.view!,
                gameView,
                actions:
                  role === 'player'
                    ? [...rules.legalActions(state, viewerSeat)]
                    : [],
                decisionId: nextDecision,
                selectionToken: nextDecision,
              },
              motion: [],
            }}
            client={client}
          />,
        ),
      );
    },
    setName() {},
    join() {},
    retry() {},
  } as unknown as RoomSession;
  return { session, state, game, events };
}
let lastSettings: Settings = {};
let mountedSerial = 0;
function renderFixture(settings: Settings, remount: boolean) {
  lastSettings = settings;
  const { session, game, events } = fixture(settings);
  if (remount) mountedSerial++;
  document.body.className = '';
  flushSync(() =>
    root.render(
      <PlatformGame key={mountedSerial} session={session} client={client} />,
    ),
  );
  window.scrollTo(0, 0);
  return {
    phase: game.phase,
    events,
    currentEvent: game.currentEvent,
    privateCards: game.peek?.cards.map((card) => card.card.categoryId) ?? [],
  };
}
window.redesignShow = (settings) => renderFixture(settings, true);
window.redesignUpdate = (settings) => {
  renderFixture({ ...lastSettings, ...settings }, false);
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
