import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { HostedGame } from '../../../packages/web-host/src';
import { configureGameHost } from '../../../packages/web-host/src/platform';
import type { RoomSession } from '../../../apps/web/src/session/useRoomSession';
import { client } from '../../../games/pokemon-encounters/expansion/web';
import { client as originalClient } from '../../../games/pokemon-encounters/web';
import {
  rules as originalRules,
  type Action as OriginalAction,
} from '../../../games/pokemon-encounters/rules';
import {
  validateState as validateOriginalState,
  type State as OriginalState,
} from '../../../games/pokemon-encounters/rules/state';
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
import {
  eventKinds,
  type EventKind,
} from '../../../games/pokemon-encounters/expansion/events';
import '../../../apps/web/src/styles.css';

const avatarImages: Record<string, string> = await fetch('/avatars.json').then(
  (response) => response.json(),
);
configureGameHost({
  ScreenLink: (props) => <a {...props} />,
  FullscreenControl: () => null,
  DisplaySettings: () => null,
  useAudioOutput: () => false,
  claimAudioEvent: () => false,
  avatarFor: (id) => avatarImages[id] ?? '',
  avatarChoices: [],
});
const presentation = {
  management: () => null,
  feedback: () => null,
  playMode: () => null,
  countdown: ({ children }: { children?: import('react').ReactNode }) =>
    children ?? null,
};
type Settings = {
  creature?: string;
  ordinary?: string;
  role?: 'host' | 'public' | 'player';
  animate?: boolean;
  paused?: boolean;
  connected?: boolean;
  branch?: number;
  terminal?: boolean;
  event?: EventKind;
};
declare global {
  interface Window {
    expansionShow(settings: Settings): {
      phase: string;
      events: State['events'];
      privateCards: string[];
      boards: ReturnType<typeof rules.project>['boards'];
      beforeBoards: ReturnType<typeof rules.project>['boards'];
      currentEvent: ReturnType<typeof rules.project>['currentEvent'];
      overrideCount: number;
    };
    expansionGallery(creature: string): void;
    expansionReenter(): void;
    expansionTimelines: typeof poseSequences;
    expansionCommands: { action: string; before: string; after: string }[];
    expansionSceneTrace: { kind: string; name: string; at: number }[];
    originalShow(
      creature: 'charizard' | 'snorlax',
      animate?: boolean,
    ): {
      phase: string;
      events: OriginalState['events'];
      actions: OriginalAction[];
    };
    originalClear(): void;
  }
}
const root = createRoot(document.getElementById('root')!);
const seats = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
let serial = 0;
let currentSession: RoomSession;
let observedNodes = new WeakSet<Element>();
window.expansionSceneTrace = [];
new MutationObserver((records) => {
  for (const record of records)
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      const scenes = [
        node,
        ...node.querySelectorAll(
          '[data-event-entrance],[data-sequence],.anime-entrance[data-scene]',
        ),
      ];
      for (const scene of scenes) {
        if (observedNodes.has(scene)) continue;
        const kind = scene.hasAttribute('data-event-entrance')
          ? 'event'
          : scene.hasAttribute('data-sequence')
            ? 'ability'
            : scene.matches('.anime-entrance[data-scene]')
              ? 'original'
              : null;
        if (!kind) continue;
        observedNodes.add(scene);
        window.expansionSceneTrace.push({
          kind,
          name:
            scene.getAttribute('data-event-entrance') ??
            scene.getAttribute('data-sequence') ??
            scene.getAttribute('data-scene')!,
          at: performance.now(),
        });
      }
    }
}).observe(document.getElementById('root')!, {
  childList: true,
  subtree: true,
});
function fixture(settings: Settings) {
  window.expansionCommands = [];
  const random = new RandomSource(1060651);
  let eventRandom: number | undefined;
  const ctx = { seats, random: { next: () => eventRandom ?? random.next() } };
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
    : settings.event && !settings.creature
      ? 'ordinary-4'
      : `special-${settings.creature ?? 'mewtwo'}`;
  const wanted = `${category}#01`,
    top = state.deck.at(-1)!;
  if (wanted !== top) swapInstance(wanted, top);
  state.deck[state.deck.length - 1] = wanted;
  if (settings.event) {
    // A constructed, validated boundary input; the draw itself uses the real rule transaction.
    placeReference(actor, 0, 'special-zorua');
    placeReference(actor, 3, 'ordinary-magikarp');
    placeReference(actor, 1, 'ordinary-3');
    placeReference(actor, 2, 'ordinary-garchomp');
    placeReference(actor, 4, 'ordinary-rowlet');
    placeReference(actor, 5, 'ordinary-psyduck');
    placeReference(actor, 6, 'ordinary-dragonite');
    state.normalTurnsBySeat = Object.fromEntries(
      seats.map((seat) => [seat, 2]),
    );
    state.randomEvent = {
      markerInstanceId: wanted,
      kind: null,
      triggered: false,
      protected: false,
    };
    eventRandom =
      (eventKinds.indexOf(settings.event) + 0.5) / eventKinds.length;
  } else {
    // Reordering a visual fixture must leave its still-protected marker in the deck.
    state.randomEvent!.markerInstanceId = state.deck[0]!;
  }
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
  if (!settings.ordinary && (!settings.event || settings.creature)) {
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
    avatarId: `avatar-${i + 1}`,
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
  window.expansionSceneTrace = [];
  observedNodes = new WeakSet();
  const { session, state, game, events, before } = fixture(settings);
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
        <HostedGame
          presentation={presentation}
          key={serial}
          session={baseline}
          client={client}
        />,
      ),
    );
  }
  flushSync(() =>
    root.render(
      <HostedGame
        presentation={presentation}
        key={serial}
        session={session}
        client={client}
      />,
    ),
  );
  return {
    phase: game.phase,
    events,
    privateCards: game.peek?.cards.map((card) => card.card.categoryId) ?? [],
    boards: game.boards,
    beforeBoards: before.boards,
    currentEvent: game.currentEvent,
    overrideCount: Object.keys(state.cardOverrides ?? {}).length,
  };
};
window.expansionReenter = () => {
  flushSync(() =>
    root.render(
      <HostedGame
        presentation={presentation}
        key={++serial}
        session={currentSession}
        client={client}
      />,
    ),
  );
};
window.originalShow = (creature, animate = true) => {
  window.expansionSceneTrace = [];
  observedNodes = new WeakSet();
  const ctx = { seats, random: new RandomSource(1060651) };
  let state = originalRules.initialize(ctx) as OriginalState;
  const applied: OriginalAction[] = [];
  const apply = (action: OriginalAction, seat = state.turnSeat) => {
    state = originalRules.apply(state, action, seat, ctx)
      .state as OriginalState;
    validateOriginalState(state, seats);
    applied.push(action);
  };
  for (const seat of seats) {
    const initial = originalRules.legalActions(
      state,
      seat,
    )[0] as OriginalAction;
    apply(initial, seat);
  }
  const actor = state.turnSeat;
  const wanted = `special-${creature}#01`,
    top = state.deck.at(-1)!;
  for (const board of Object.values(state.boards))
    for (const slot of board)
      if (slot.instanceId === wanted) slot.instanceId = top;
  state.deck = state.deck.map((id) => (id === wanted ? top : id));
  state.deck[state.deck.length - 1] = wanted;
  validateOriginalState(state, seats);
  apply({ type: 'draw', source: 'deck' });
  apply({ type: 'replace', slot: 1 });
  const before = originalRules.project(state, { role: 'public' });
  const ability = originalRules
    .legalActions(state, actor)
    .find(
      (action) => action.type === (creature === 'charizard' ? 'peek' : 'swap'),
    ) as OriginalAction | undefined;
  if (!ability)
    throw new Error(
      `Missing legal original fixture ${creature}/${state.phase}`,
    );
  apply(ability, actor);
  const game = originalRules.project(state, { role: 'public' });
  const base = fixture({
    ordinary: 'magikarp',
    animate: false,
    role: 'host',
  }).session;
  const events = game.events.filter(
    (event) => event.id > (before.events.at(-1)?.id ?? 0),
  );
  currentSession = {
    ...base,
    view: {
      ...base.view!,
      game: { ...base.view!.game!, variantId: 'original' },
      gameView: game,
    },
    motion: animate ? originalClient.savedChanges(before, game) : [],
    feedback: animate
      ? {
          ...base.feedback!,
          instanceId: base.view!.instanceId,
          branch: base.view!.branch,
          revision: base.view!.revision,
          events: events.map(({ kind, text, action }) => ({
            kind,
            text,
            ...(action ? { action } : {}),
          })),
        }
      : null,
  } as unknown as RoomSession;
  flushSync(() =>
    root.render(
      <HostedGame
        presentation={presentation}
        key={serial}
        session={currentSession}
        client={originalClient}
      />,
    ),
  );
  return { phase: game.phase, events, actions: applied };
};
window.originalClear = () => {
  currentSession = { ...currentSession, motion: [], feedback: null };
  flushSync(() =>
    root.render(
      <HostedGame
        presentation={presentation}
        key={serial}
        session={currentSession}
        client={originalClient}
      />,
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
