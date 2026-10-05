import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { client } from '../../apps/web/src/game-clients/PokemonScreen';
import type { RoomSession } from '../../apps/web/src/session/useRoomSession';
import { rules, type Action } from '../../games/pokemon-encounters/rules';
import {
  validateState,
  type State,
} from '../../games/pokemon-encounters/rules/state';
import '../../apps/web/src/styles.css';

type Scene =
  | 'initial'
  | 'waiting'
  | 'draw'
  | 'place'
  | 'discard-place'
  | 'snorlax'
  | 'charizard'
  | 'peek'
  | 'mew-other'
  | 'mew-self'
  | 'rocket'
  | 'zapdos-self'
  | 'zapdos-receive'
  | 'round-result'
  | 'match-result';
type Setting = {
  scene: Scene;
  role: 'player' | 'host' | 'public';
  connected: boolean;
  paused: boolean;
  playMode: 'play' | 'test';
  fullscreenSupported: boolean;
  serial: number;
  animate: boolean;
};
type FixtureState = { state: State; self: string };
type FixtureCommand = { type: 'game'; decisionId: string; action: Action };
declare global {
  interface Window {
    setPokemonFixture(setting: Partial<Omit<Setting, 'serial'>>): void;
    pokemonFixture: {
      phase: string;
      step: number;
      self: string;
      scene: string;
      serial: number;
    };
    pokemonCommands: FixtureCommand[];
  }
}
const seatIds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const context = { seats: seatIds, random: { next: () => 0.4 } };

function apply(state: State, action: Action, seat = state.turnSeat) {
  const next = rules.apply(state, action, seat, context).state as State;
  return validateState(next, seatIds);
}

/** Verification-only complete deck permutation; every later transition uses production rules. */
function make(scene: Scene): FixtureState {
  let state = rules.initialize({
    ...context,
    random: { next: () => 0 },
  }) as State;
  const category =
    scene === 'snorlax'
      ? 'special-snorlax'
      : scene === 'charizard' || scene === 'peek'
        ? 'special-charizard'
        : scene.startsWith('mew')
          ? 'special-mew'
          : scene === 'rocket'
            ? 'special-team-rocket'
            : scene.startsWith('zapdos')
              ? 'special-zapdos'
              : 'ordinary-6';
  const wanted = `${category}#01`;
  const top = state.deck.length - 1;
  const displaced = state.deck[top]!;
  const deckIndex = state.deck.indexOf(wanted);
  if (deckIndex >= 0) state.deck[deckIndex] = displaced;
  else {
    const slot = Object.values(state.boards)
      .flat()
      .find((entry) => entry.instanceId === wanted);
    if (!slot) throw new Error(`Missing fixture card ${wanted}`);
    slot.instanceId = displaced;
  }
  state.deck[top] = wanted;
  validateState(state, seatIds);
  if (scene === 'initial') return { state, self: 'S1' };
  for (const seat of seatIds) {
    state = apply(state, { type: 'initial-flip', slot: 0 }, seat);
    if (scene === 'waiting') return { state, self: 'S1' };
  }
  if (scene === 'draw') return { state, self: 'S1' };
  if (scene === 'round-result' || scene === 'match-result') {
    if (scene === 'match-result')
      state.winsBySeat = Object.fromEntries(seatIds.map((seat) => [seat, 2]));
    for (let step = 0; step < 1000 && !state.roundResult; step++) {
      const actor =
        state.phase === 'zapdos-receive'
          ? state.recipientQueue[state.recipientIndex]!
          : state.turnSeat;
      const choices = rules.legalActions(state, actor) as Action[];
      const reveal = choices.find(
        (action) =>
          action.type === 'replace' &&
          !state.boards[actor]![action.slot]!.faceUp,
      );
      state = apply(state, reveal ?? choices[0]!, actor);
    }
    if (!state.roundResult) throw new Error('Result fixture did not finish');
    return { state, self: 'S1' };
  }
  state = apply(state, { type: 'draw', source: 'deck' });
  if (scene === 'discard-place') {
    state = apply(state, { type: 'discard-held' });
    state = apply(state, { type: 'draw', source: 'discard' });
    return { state, self: 'S2' };
  }
  if (['snorlax', 'charizard', 'peek', 'zapdos-receive'].includes(scene))
    state = apply(state, { type: 'replace', slot: 1 });
  if (scene === 'peek') state = apply(state, { type: 'peek', slot: 2 });
  if (scene === 'mew-self')
    state = apply(state, { type: 'mew-target', seat: 'S2', slot: 1 });
  return { state, self: scene === 'zapdos-receive' ? 'S2' : 'S1' };
}

const initialSetting: Setting = {
  scene: 'initial',
  role: 'player',
  connected: true,
  paused: false,
  playMode: 'play',
  fullscreenSupported: true,
  serial: 0,
  animate: false,
};
function Fixture() {
  const [setting, setSetting] = useState(initialSetting);
  const [current, setCurrent] = useState(() => make('initial'));
  window.setPokemonFixture = (next) => {
    const updated = { ...initialSetting, ...next };
    window.pokemonCommands = [];
    flushSync(() => {
      setSetting((prior) => ({ ...updated, serial: prior.serial + 1 }));
      setCurrent(make(updated.scene));
    });
  };
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    get: () => setting.fullscreenSupported,
  });
  const game = rules.project(current.state, {
    role: setting.role === 'player' ? 'player' : 'public',
    seatId: current.self,
  });
  const seats = seatIds.map((id, index) => ({
    id,
    name: index === 0 ? '第一位很长昵称的朋友ABCDEFGHIJ' : `朋友 ${index + 1}`,
    controller: 'human',
    ready: true,
    online: true,
    avatarId: `avatar-${index + 1}`,
    botDifficulty: null,
  }));
  const decisionId = `fixture:${current.state.step}:${current.self}`;
  const locked = !setting.connected || setting.paused;
  const view = {
    instanceId: '00000000-0000-4000-8000-000000000001',
    revision: current.state.step,
    branch: 0,
    status: 'playing',
    paused: setting.paused,
    restored: false,
    joinOpen: false,
    playMode: setting.playMode,
    countdownSeconds: 0,
    decisionClock: null,
    game: { id: 'pokemon-encounters', name: '宝可梦奇遇', min: 2, max: 6 },
    catalog: [],
    ownerSeatId: null,
    capabilities: { manage: false, control: false, manageSeats: false },
    seats,
    self: {
      role: setting.role,
      seatId: setting.role === 'player' ? current.self : null,
    },
    gameView: game,
    actions:
      setting.role === 'player' && !locked
        ? rules.legalActions(current.state, current.self)
        : [],
    decisionId,
    selectionToken: decisionId,
    history: [],
    lifecycleActions: [],
    botError: null,
    endReason: null,
  };
  window.pokemonFixture = {
    phase: current.state.phase,
    step: current.state.step,
    self: current.self,
    scene: setting.scene,
    serial: setting.serial,
  };
  const session = {
    role: setting.role,
    view,
    connected: setting.connected,
    locked,
    canControl: false,
    isHost: setting.role === 'host',
    self:
      setting.role === 'player'
        ? seats.find((seat) => seat.id === current.self)
        : null,
    message: '',
    motion: setting.animate
      ? game.roundResult
        ? ['@saved', '@result']
        : ['@saved', ...(game.coin ? ['@coin'] : [])]
      : [],
    feedback: null,
    busy: false,
    admissionPending: false,
    awaitingConfirmation: false,
    errorId: '',
    command(command: FixtureCommand) {
      if (
        locked ||
        command.type !== 'game' ||
        command.decisionId !== decisionId
      )
        throw new Error('Unexpected or locked fixture command');
      window.pokemonCommands.push(structuredClone(command));
      setCurrent({
        ...current,
        state: apply(current.state, command.action, current.self),
      });
    },
    retry() {},
  } as unknown as RoomSession;
  return <client.Screen key={setting.serial} session={session} />;
}

window.pokemonCommands = [];
createRoot(document.getElementById('root')!).render(<Fixture />);
