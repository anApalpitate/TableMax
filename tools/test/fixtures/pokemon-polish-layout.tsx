import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { client } from '../../../apps/web/src/game-clients/PokemonScreen';
import { BoxScreen } from '../../../apps/web/src/screens/BoxScreen';
import type { RoomSession } from '../../../apps/web/src/session/useRoomSession';
import type { PokemonView } from '../../../games/pokemon-encounters/rules/project';
import { rules, type Action } from '../../../games/pokemon-encounters/rules';
import {
  applyPokemonOriginalState as apply,
  makePokemonOriginalState as make,
  type PokemonOriginalScene,
} from './pokemon-original-state';
import '../../../apps/web/src/styles.css';

type Scene = PokemonOriginalScene;
type Setting = {
  seats: number;
  scene: Scene;
  role: 'player' | 'host' | 'public';
  connected: boolean;
  paused: boolean;
  playMode: 'play' | 'test';
  fullscreenSupported: boolean;
  serial: number;
  animate: boolean;
  longTargets: boolean;
  surface: 'game' | 'box';
  message: string;
  messageKind: 'saved' | 'error' | null;
  busy: boolean;
  admissionPending: boolean;
  awaitingConfirmation: boolean;
};
type FixtureCommand = { type: 'game'; decisionId: string; action: Action };
declare global {
  interface Window {
    setPokemonFixture(setting: Partial<Omit<Setting, 'serial'>>): void;
    updatePokemonSession(setting: Partial<Setting>): void;
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

const initialSetting: Setting = {
  seats: 6,
  scene: 'initial',
  role: 'player',
  connected: true,
  paused: false,
  playMode: 'play',
  fullscreenSupported: true,
  serial: 0,
  animate: false,
  longTargets: false,
  surface: 'game',
  message: '',
  messageKind: null,
  busy: false,
  admissionPending: false,
  awaitingConfirmation: false,
};
function Fixture() {
  const [setting, setSetting] = useState(initialSetting);
  const [current, setCurrent] = useState(() => make('initial'));
  window.setPokemonFixture = (next) => {
    const updated = { ...initialSetting, ...next };
    window.pokemonCommands = [];
    flushSync(() => {
      setSetting((prior) => ({ ...updated, serial: prior.serial + 1 }));
      setCurrent(make(updated.scene, updated.seats));
    });
  };
  window.updatePokemonSession = (next) => {
    flushSync(() => setSetting((prior) => ({ ...prior, ...next })));
  };
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    get: () => setting.fullscreenSupported,
  });
  const game = rules.project(current.state, {
    role: setting.role === 'player' ? 'player' : 'public',
    seatId: current.self,
  }) as PokemonView;
  const seats = current.state.seatOrder.map((id, index) => ({
    id,
    name:
      index === 0
        ? '首席宝可梦玩家'
        : setting.longTargets
          ? `朋友${index + 1}ABCDEFGH`
          : `朋友 ${index + 1}`,
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
    countdownSeconds: 20,
    decisionClock: null,
    game: {
      id: 'pokemon-encounters',
      name: '宝可梦奇遇',
      min: 2,
      max: 6,
      decisionTimer: true,
    },
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
    name: seats.find((seat) => seat.id === current.self)!.name,
    setName() {},
    credential: setting.role === 'player' ? 'fixture-phone' : null,
    join() {},
    locked,
    canControl: false,
    isHost: setting.role === 'host',
    self:
      setting.role === 'player'
        ? seats.find((seat) => seat.id === current.self)
        : null,
    message: setting.message,
    messageKind: setting.messageKind,
    motion: setting.animate
      ? game.roundResult
        ? ['@saved', '@result']
        : ['@saved', ...(game.coin ? ['@coin'] : [])]
      : [],
    feedback: null,
    busy: setting.busy,
    admissionPending: setting.admissionPending,
    awaitingConfirmation: setting.awaitingConfirmation,
    retryAdmission() {},
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
  return setting.surface === 'box' ? (
    <BoxScreen key={setting.serial} session={session} />
  ) : (
    <client.Screen key={setting.serial} session={session} />
  );
}

window.pokemonCommands = [];
createRoot(document.getElementById('root')!).render(<Fixture />);
