import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { HostedGame } from '../../../packages/web-host/src';
import type { RoomSession } from '../../../apps/web/src/session/useRoomSession';
import { client } from '../../../games/pokemon-encounters/expansion/web';
import { PoseArt } from '../../../games/pokemon-encounters/expansion/web/poses';
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
  creature?: string;
  ordinary?: string;
  role?: 'host' | 'public' | 'player';
  animate?: boolean;
  paused?: boolean;
  connected?: boolean;
  branch?: number;
  terminal?: boolean;
};
declare global {
  interface Window {
    expansionShow(settings: Settings): {
      phase: string;
      events: State['events'];
      privateCards: string[];
    };
    expansionGallery(creature: string): void;
    expansionReenter(): void;
    expansionTimelines: typeof poseSequences;
    expansionCommands: { action: string; before: string; after: string }[];
  }
}
const root = createRoot(document.getElementById('root')!);
const seats = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
let serial = 0;
let currentSession: RoomSession;
function fixture(settings: Settings) {
  window.expansionCommands = [];
  const ctx = { seats, random: new RandomSource(1060651) };
  let state = rules.initialize(ctx);
  const apply = (action: Action) => {
    const actor =
      state.phase === 'zapdos-receive'
        ? state.recipientQueue[state.recipientIndex]!
        : state.turnSeat;
    state = rules.apply(state, action, actor, ctx).state;
    validateState(state, seats);
  };
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
  const placeReference = (seat: string, slot: number, category: string) => {
    const wanted = `${category}#01`,
      previous = state.boards[seat]![slot]!.instanceId;
    if (wanted !== previous) swapInstance(wanted, previous);
    state.boards[seat]![slot] = { instanceId: wanted, faceUp: true };
  };
  if (settings.terminal) {
    const others = seats.filter((seat) => seat !== actor);
    placeReference(others[0]!, 0, 'special-kyogre');
    placeReference(others[1]!, 0, 'special-rayquaza');
    for (const slot of state.boards[actor]!) slot.faceUp = true;
    state.boards[actor]![8]!.faceUp = false;
    state.winsBySeat[actor] = 2;
  }
  const category = settings.ordinary
    ? `ordinary-${settings.ordinary}`
    : `special-${settings.creature ?? 'mewtwo'}`;
  const wanted = `${category}#01`,
    top = state.deck.at(-1)!;
  if (wanted !== top) swapInstance(wanted, top);
  state.deck[state.deck.length - 1] = wanted;
  validateState(state, seats);
  const before = rules.project(state, { role: 'public' });
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
      if (choices[creature]) {
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
  validateState(state, seats);
  const role = settings.role ?? 'host';
  const game = rules.project(
    state,
    role === 'player' ? { role, seatId: actor } : { role },
  );
  const changed = client.savedChanges(before, game);
  const currentSeats = seats.map((id, i) => ({
    id,
    name: `玩家${i + 1}`,
    avatarId: `builtin-${i + 1}`,
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
    self: { role, seatId: role === 'player' ? actor : null },
    gameView: game,
    actions: role === 'player' ? rules.legalActions(state, actor) : [],
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
        ? currentSeats.find((seat) => seat.id === actor)
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
    feedback:
      settings.animate === false
        ? null
        : {
            instanceId: view.instanceId,
            revision: view.revision,
            branch: view.branch,
            events: events.map(({ kind, text, action }) => ({
              kind,
              text,
              ...(action ? { action } : {}),
            })),
          },
    command(command: { type: string; decisionId?: string; action?: Action }) {
      if (command.type !== 'game' || !command.action) return;
      if (command.decisionId !== decisionId(state, actor))
        throw new Error('Fixture received stale component intent');
      const before = state.phase;
      apply(command.action);
      window.expansionCommands.push({
        action: command.action.type,
        before,
        after: state.phase,
      });
    },
    setName() {},
    join() {},
    retry() {},
  } as unknown as RoomSession;
  return { session, state, game, events, before };
}
window.expansionShow = (settings) => {
  const { session, game, events, before } = fixture(settings);
  currentSession = session;
  document.body.className = '';
  if (settings.animate !== false) {
    const baseline = {
      ...session,
      view: { ...session.view!, gameView: before },
      motion: [],
      feedback: null,
    } as RoomSession;
    flushSync(() =>
      root.render(
        <HostedGame key={serial} session={baseline} client={client} />,
      ),
    );
  }
  flushSync(() =>
    root.render(<HostedGame key={serial} session={session} client={client} />),
  );
  return {
    phase: game.phase,
    events,
    privateCards: game.peek?.cards.map((card) => card.card.categoryId) ?? [],
  };
};
window.expansionReenter = () => {
  flushSync(() =>
    root.render(
      <HostedGame key={++serial} session={currentSession} client={client} />,
    ),
  );
};
window.expansionTimelines = poseSequences;
window.expansionGallery = (creature) => {
  const sequence = poseSequences[creature]!;
  document.body.className = 'ex-pose-gallery-page';
  flushSync(() =>
    root.render(
      <div style={{ padding: 20, background: '#f5f1e7', color: '#223c53' }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>
          {creature} — {sequence.durationMs} ms
        </h1>
        <div style={{ display: 'flex', gap: 10 }}>
          {sequence.poseNames.map((name, i) => (
            <figure
              key={name}
              style={{
                margin: 0,
                width: 230,
                flexShrink: 0,
                background: '#e9edf3',
                borderRadius: 18,
                padding: 6,
              }}
            >
              <PoseArt
                creatureId={creature}
                progress={sequence.positions[i]!}
              />
              <figcaption style={{ textAlign: 'center', fontSize: 18 }}>
                {i + 1}. {name}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>,
    ),
  );
};
window.expansionShow({ creature: 'mewtwo', animate: false });
