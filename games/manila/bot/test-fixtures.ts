import type { RuleContext } from '@tablemax/game-sdk';
import { bot } from './index';
import { rules } from '../rules';
import { startFinance } from '../rules/finance';
import type { State } from '../rules/state';
import { turnSeat } from '../rules/state';
import { CARGOS } from '../rules/catalog';

export function competitiveAuction(context: RuleContext) {
  const [own, leading] = context.seats as readonly [
    string,
    string,
    ...string[],
  ];
  let state = rules.initialize(context) as State;
  state.players[leading]!.cash = 60;
  state.voyageFinance = startFinance(state.voyage, state.seats, state.players);
  const concentration = Math.max(
    ...CARGOS.map(
      (cargo) =>
        state.players[own]!.shares.filter((share) => share.cargo === cargo)
          .length,
    ),
  );
  const bid = Math.floor(4 + concentration * 2.5);
  state = rules.apply(state, { type: 'bid', amount: 1 }, own, context)
    .state as State;
  state = rules.apply(state, { type: 'bid', amount: bid }, leading, context)
    .state as State;
  while (turnSeat(state) !== own)
    state = rules.apply(state, { type: 'pass' }, turnSeat(state)!, context)
      .state as State;
  return state;
}

export function decideFromState(
  state: State,
  difficulty: NonNullable<Parameters<typeof bot.decide>[0]['difficulty']>,
) {
  const decision = rules.decisions(state)[0]!;
  return bot.decide({
    view: rules.project(state, { role: 'player', seatId: decision.seatId }),
    actions: rules.legalActions(state, decision.seatId),
    decision,
    memory: null,
    difficulty,
    random: { next: () => 0 },
    signal: new AbortController().signal,
  });
}
