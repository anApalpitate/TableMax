import type { Viewer } from '@tablemax/game-sdk';
import type { State } from './state';
export function project(state: State, viewer: Viewer) {
  return {
    turnSeat: state.seats[state.turn] ?? null,
    choices: { ...state.choices },
    winners: [...state.winners],
    ownSecret:
      viewer.role === 'player' ? (state.secrets[viewer.seatId] ?? null) : null,
    results: state.turn === state.seats.length ? { ...state.secrets } : null,
  };
}
