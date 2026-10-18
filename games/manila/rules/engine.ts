import type { RuleContext } from '@tablemax/game-sdk';
import { CARGOS, CARGO, MARKET, BERTH_PAYOUTS, emptySpaces } from './catalog';
import { boardTargets, credit } from './actions';
import { occupant, workerCount, type State } from './state';
import { finalScores, resolveWinners } from './scoring';
import { changeCash, startFinance } from './finance';
import type { Action, BoatView, CargoId } from './view';

export function initialize(context: RuleContext): State {
  if (
    context.seats.length < 3 ||
    context.seats.length > 5 ||
    new Set(context.seats).size !== context.seats.length ||
    context.seats.some((seat) => typeof seat !== 'string' || !seat.length)
  )
    throw new Error('Manila requires 3–5 stable seats');
  const deck = CARGOS.flatMap((cargo) =>
    [1, 2, 3].map((n) => ({
      id: `${cargo}-${n}`,
      cargo,
      mortgaged: false,
      revealed: false,
    })),
  );
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(context.random.next() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const players = Object.fromEntries(
    context.seats.map((seat) => [
      seat,
      { cash: 30, shares: deck.splice(0, 2), usedWorkers: 0, passed: false },
    ]),
  );
  const stock = Object.fromEntries(
    CARGOS.map((cargo) => [
      cargo,
      5 -
        Object.values(players).reduce(
          (n, p) => n + p.shares.filter((x) => x.cargo === cargo).length,
          0,
        ),
    ]),
  ) as Record<CargoId, number>;
  return {
    version: 1,
    seats: [...context.seats],
    voyage: 1,
    phase: 'auction',
    serial: 0,
    harborMaster: context.seats[0]!,
    players,
    market: Object.fromEntries(CARGOS.map((c) => [c, 0])) as Record<
      CargoId,
      number
    >,
    stock,
    boats: [],
    spaces: emptySpaces([]),
    auction: { bid: 0, highBidder: null, passed: [], actor: context.seats[0]! },
    placementRound: 0,
    placementCursor: 0,
    movement: 0,
    boardQueue: [],
    boardCursor: 0,
    plunderQueue: [],
    dice: [],
    result: null,
    latest: '首航竞选港务长：首座先叫价。',
    scores: null,
    winners: [],
    payment: null,
    settlementBefore: null,
    voyageFinance: startFinance(1, context.seats, players),
  };
}
/** An unaffordable commitment opens a real collateral choice; the engine never
 * selects the player's shares. Insurance exhausts credit before bank coverage. */
function payment(
  s: State,
  seatId: string,
  amount: number,
  reason: NonNullable<State['payment']>['reason'],
  context: RuleContext,
  cargo: CargoId | null = null,
  space: string | null = null,
): void {
  s.payment = { seatId, amount, reason, cargo, space };
  if (s.players[seatId]!.cash < amount && credit(s, seatId) > 0) {
    s.phase = 'financing';
    s.latest = `待付${amount}比索：选择要质押的股份。`;
  } else completePayment(s, context);
}
function completePayment(s: State, context: RuleContext): void {
  const obligation = s.payment!,
    p = s.players[obligation.seatId]!;
  if (p.cash < obligation.amount && obligation.reason !== 'insurance')
    throw new Error('Insufficient funds');
  const category = {
    auction: 'auction',
    share: 'shares',
    place: 'placement',
    insurance: 'insurance',
  } as const;
  changeCash(
    s,
    obligation.seatId,
    `expenses.${category[obligation.reason]}`,
    Math.min(p.cash, obligation.amount),
  );
  s.payment = null;
  if (obligation.reason === 'auction') s.phase = 'share';
  else if (obligation.reason === 'share') {
    const cargo = obligation.cargo!,
      owned = new Set(
        Object.values(s.players).flatMap((x) =>
          x.shares.map((share) => share.id),
        ),
      );
    let number = 1;
    while (owned.has(`${cargo}-${number}`)) number++;
    p.shares.push({
      id: `${cargo}-${number}`,
      cargo,
      mortgaged: false,
      revealed: false,
    });
    s.stock[cargo]--;
    s.phase = 'setup';
    s.latest = '港务长安排三艘货船与起航位置。';
  } else if (obligation.reason === 'place') {
    s.spaces.find((x) => x.id === obligation.space)!.occupant =
      obligation.seatId;
    p.usedWorkers++;
    syncCrew(s);
    s.phase = 'place';
    stepPlacement(s, context);
  } else finalizeSettlement(s);
}
function syncCrew(s: State): void {
  for (const b of s.boats)
    b.crew = s.spaces
      .filter((space) => space.cargo === b.cargo && space.occupant)
      .map((space) => space.occupant!);
}
function dock(s: State, b: BoatView, destination: 'port' | 'shipyard'): void {
  b.destinationIndex = s.boats.filter(
    (x) => x.destination === destination,
  ).length;
  b.destination = destination;
  if (destination === 'port') b.position = 14;
}
function normalizePirates(s: State): void {
  if (!occupant(s, 'pirate-0') && occupant(s, 'pirate-1')) {
    s.spaces.find((x) => x.id === 'pirate-0')!.occupant = occupant(
      s,
      'pirate-1',
    );
    s.spaces.find((x) => x.id === 'pirate-1')!.occupant = null;
  }
}
function settle(s: State, context: RuleContext): void {
  s.settlementBefore = Object.fromEntries(
    s.seats.map((seat) => [seat, s.players[seat]!.cash]),
  );
  const pirates = s.spaces
    .filter((x) => x.kind === 'pirate' && x.occupant)
    .map((x) => x.occupant!);
  for (const boat of s.boats) {
    const crew = boat.plundered
      ? pirates
      : boat.destination === 'port'
        ? boat.crew
        : [];
    for (const seat of crew)
      changeCash(
        s,
        seat,
        boat.plundered ? 'income.piracy' : 'income.cargo',
        CARGO[boat.cargo].payout / crew.length,
      );
  }
  const ports = s.boats.filter((b) => b.destination === 'port').length;
  const yards = s.boats.filter((b) => b.destination === 'shipyard').length;
  for (let i = 0; i < ports; i++) {
    const seat = occupant(s, `port-${i}`);
    if (seat) changeCash(s, seat, 'income.port', BERTH_PAYOUTS[i]!);
  }
  const insurer = occupant(s, 'insurance');
  // Pay every shipyard worker from the bank first. Then collect the insurer's
  // actual liabilities excluding self-payments; all their other profits can
  // therefore fund the liability, as explicitly allowed by the 2005 rules.
  let liability = 0;
  for (let i = 0; i < yards; i++) {
    const recipient = occupant(s, `shipyard-${i}`),
      amount = BERTH_PAYOUTS[i]!;
    if (recipient && recipient !== insurer)
      changeCash(s, recipient, 'income.shipyard', amount);
    if (!insurer && recipient) continue;
    if (insurer && recipient !== insurer) liability += amount;
  }
  if (insurer && liability > 0)
    payment(s, insurer, liability, 'insurance', context);
  else finalizeSettlement(s);
}
function finalizeSettlement(s: State): void {
  const before = s.settlementBefore!;
  s.settlementBefore = null;
  const ports = s.boats.filter((b) => b.destination === 'port').length,
    yards = s.boats.filter((b) => b.destination === 'shipyard').length;
  for (const b of s.boats)
    if (b.destination === 'port')
      s.market[b.cargo] = MARKET[MARKET.indexOf(s.market[b.cargo]) + 1]!;
  s.result = {
    voyage: s.voyage,
    income: Object.fromEntries(
      s.seats.map((seat) => [seat, s.players[seat]!.cash - before[seat]!]),
    ),
    port: s.boats.filter((b) => b.destination === 'port').map((b) => b.cargo),
    shipyard: s.boats
      .filter((b) => b.destination === 'shipyard')
      .map((b) => b.cargo),
    plundered: s.boats.filter((b) => b.plundered).map((b) => b.cargo),
    dice: structuredClone(s.dice),
    ...(s.voyageFinance ? { finance: structuredClone(s.voyageFinance) } : {}),
  };
  s.phase = Object.values(s.market).includes(30) ? 'ended' : 'round-result';
  if (s.phase === 'ended') {
    s.scores = finalScores(s);
    s.winners = resolveWinners(s.scores, s.seats);
  }
  s.latest = `第${s.voyage}航次结算：${ports}船入港，${yards}船维修。`;
}
function finishThird(s: State, context: RuleContext): void {
  const pirates = s.spaces.filter((x) => x.kind === 'pirate' && x.occupant);
  for (const b of s.boats)
    if (b.destination === 'sea') {
      if (b.position === 13 && pirates.length) {
        b.plundered = true;
        for (const space of s.spaces)
          if (space.cargo === b.cargo) space.occupant = null;
        b.crew = [];
        s.plunderQueue.push(b.cargo);
      } else dock(s, b, b.position === 13 ? 'port' : 'shipyard');
    }
  if (s.plunderQueue.length) s.phase = 'plunder';
  else settle(s, context);
}
function startPlacement(s: State, context: RuleContext): void {
  s.phase = 'place';
  s.placementRound++;
  s.placementCursor = 0;
  skipUnavailable(s, context);
}
function afterBoard(s: State, context: RuleContext): void {
  normalizePirates(s);
  startPlacement(s, context);
}
function nextBoard(s: State, context: RuleContext): void {
  while (
    s.boardCursor < s.boardQueue.length &&
    (!occupant(s, `pirate-${s.boardQueue[s.boardCursor]}`) ||
      !boardTargets(s).length)
  )
    s.boardCursor++;
  if (s.boardCursor >= s.boardQueue.length) afterBoard(s, context);
  else s.phase = 'board';
}
function roll(s: State, context: RuleContext): void {
  s.movement++;
  const values: Record<string, number> = {};
  // Roll all three colored dice each time, including already docked cargo. A
  // stable three-die stream makes saved fixed-random replays straightforward.
  for (const b of s.boats) {
    const die = 1 + Math.floor(context.random.next() * 6);
    values[b.cargo] = die;
    if (b.destination === 'sea') {
      b.position += die;
      if (b.position > 13) dock(s, b, 'port');
    }
  }
  s.dice.push({ movement: s.movement, values });
  s.latest = `第${s.movement}次航行：${s.boats.map((b) => `${CARGO[b.cargo].name}${values[b.cargo]}`).join('、')}。`;
  if (s.movement === 1) startPlacement(s, context);
  else if (s.movement === 2) {
    s.boardQueue = [0, 1].filter((i) => occupant(s, `pirate-${i}`) !== null);
    s.boardCursor = 0;
    nextBoard(s, context);
  } else finishThird(s, context);
}
function startLargePilot(s: State, context: RuleContext): void {
  if (
    occupant(s, 'pilot-large') &&
    s.boats.some((b) => b.destination === 'sea')
  )
    s.phase = 'pilot-large';
  else roll(s, context);
}
function afterPlacement(s: State, context: RuleContext): void {
  if (s.placementRound === workerCount(s)) {
    if (
      occupant(s, 'pilot-small') &&
      s.boats.some((b) => b.destination === 'sea')
    )
      s.phase = 'pilot-small';
    else startLargePilot(s, context);
  } else if (s.seats.length === 3 && s.placementRound === 1)
    startPlacement(s, context);
  else roll(s, context);
}
function skipUnavailable(s: State, context: RuleContext): void {
  while (
    s.phase === 'place' &&
    (s.players[
      s.seats[
        (s.seats.indexOf(s.harborMaster) + s.placementCursor) % s.seats.length
      ]!
    ]!.passed ||
      s.players[
        s.seats[
          (s.seats.indexOf(s.harborMaster) + s.placementCursor) % s.seats.length
        ]!
      ]!.usedWorkers >= workerCount(s))
  ) {
    s.placementCursor++;
    if (s.placementCursor === s.seats.length) {
      s.placementCursor = 0;
      afterPlacement(s, context);
    }
  }
}
function stepPlacement(s: State, context: RuleContext): void {
  s.placementCursor++;
  if (s.placementCursor === s.seats.length) {
    s.placementCursor = 0;
    afterPlacement(s, context);
  } else skipUnavailable(s, context);
}
function finishAuction(s: State, context: RuleContext): void {
  s.phase = 'share';
  s.latest = `港务长由第${s.seats.indexOf(s.harborMaster) + 1}座担任，成交${s.auction.bid}比索。`;
  if (s.auction.highBidder) {
    s.harborMaster = s.auction.highBidder;
    payment(s, s.harborMaster, s.auction.bid, 'auction', context);
  }
}
function nextAuctionActor(s: State, context: RuleContext): void {
  if (
    (s.auction.highBidder && s.auction.passed.length === s.seats.length - 1) ||
    s.auction.passed.length === s.seats.length
  ) {
    finishAuction(s, context);
    return;
  }
  let index = s.seats.indexOf(s.auction.actor);
  do {
    index = (index + 1) % s.seats.length;
  } while (
    s.auction.passed.includes(s.seats[index]!) ||
    s.seats[index] === s.auction.highBidder
  );
  s.auction.actor = s.seats[index]!;
}
export function nextVoyage(s: State): void {
  s.voyage++;
  s.phase = 'auction';
  s.boats = [];
  s.spaces = emptySpaces([]);
  s.auction = { bid: 0, highBidder: null, passed: [], actor: s.harborMaster };
  s.placementRound = 0;
  s.placementCursor = 0;
  s.movement = 0;
  s.boardQueue = [];
  s.boardCursor = 0;
  s.plunderQueue = [];
  s.dice = [];
  s.result = null;
  s.voyageFinance = startFinance(s.voyage, s.seats, s.players);
  for (const p of Object.values(s.players)) {
    p.usedWorkers = 0;
    p.passed = false;
  }
  s.latest = `第${s.voyage}航次：竞选港务长。`;
}
export function execute(
  s: State,
  action: Action,
  seat: string,
  context: RuleContext,
): void {
  const p = s.players[seat]!;
  s.serial++;
  if (action.type === 'mortgage' || action.type === 'repay') {
    const share = p.shares.find((x) => x.id === action.shareId)!;
    if (action.type === 'mortgage') {
      share.mortgaged = true;
      changeCash(s, seat, 'borrowed', 12);
    } else {
      share.mortgaged = false;
      share.revealed = true;
      changeCash(s, seat, 'redeemed', 15);
    }
    s.latest =
      action.type === 'mortgage'
        ? '一张股份质押，获得12比索。'
        : '偿还15比索，赎回并公开一张股份。';
    if (s.payment && (p.cash >= s.payment.amount || credit(s, seat) === 0))
      completePayment(s, context);
    return;
  }
  if (s.phase === 'auction') {
    if (action.type === 'bid') {
      s.auction.bid = action.amount;
      s.auction.highBidder = seat;
      s.latest = `第${s.seats.indexOf(seat) + 1}座出价${action.amount}比索。`;
    } else s.auction.passed.push(seat);
    nextAuctionActor(s, context);
  } else if (action.type === 'buy-share' || action.type === 'skip-share') {
    if (action.type === 'buy-share')
      payment(
        s,
        seat,
        Math.max(5, s.market[action.cargo]),
        'share',
        context,
        action.cargo,
      );
    else {
      s.phase = 'setup';
      s.latest = '港务长安排三艘货船与起航位置。';
    }
  } else if (action.type === 'setup') {
    s.boats = action.cargos.map((cargo, index) => ({
      cargo,
      position: action.positions[index]!,
      destination: 'sea',
      destinationIndex: null,
      crew: [],
      plundered: false,
    }));
    s.spaces = emptySpaces(action.cargos);
    s.latest = '货船已装载，开始派遣同伙。';
    startPlacement(s, context);
  } else if (s.phase === 'place') {
    if (action.type === 'pass') {
      p.passed = true;
      s.latest = '放弃本航次剩余派遣。';
    } else if (action.type === 'place') {
      const space = s.spaces.find((x) => x.id === action.space)!;
      if (space.kind === 'insurance') {
        changeCash(s, seat, 'income.insurance', 10);
        space.occupant = seat;
        p.usedWorkers++;
        syncCrew(s);
      } else {
        const funds = p.cash + credit(s, seat);
        payment(
          s,
          seat,
          Math.min(funds, space.cost),
          'place',
          context,
          null,
          space.id,
        );
        return;
      }
      s.latest = `第${s.seats.indexOf(seat) + 1}座派遣同伙。`;
    }
    stepPlacement(s, context);
  } else if (action.type === 'board') {
    if (action.cargo !== null) {
      const space = s.spaces.find(
        (x) => x.cargo === action.cargo && x.occupant === null,
      )!;
      space.occupant = seat;
      s.spaces.find(
        (x) => x.id === `pirate-${s.boardQueue[s.boardCursor]}`,
      )!.occupant = null;
      syncCrew(s);
      s.latest = '海盗登上停在13格的货船。';
    }
    s.boardCursor++;
    nextBoard(s, context);
  } else if (action.type === 'pilot') {
    const small = s.phase === 'pilot-small';
    for (const move of action.moves) {
      const b = s.boats.find((x) => x.cargo === move.cargo)!;
      b.position += move.delta;
      if (b.position > 13) dock(s, b, 'port');
    }
    s.latest = action.moves.length
      ? '领航员已调整货船位置。'
      : '领航员放弃调整。';
    if (small) startLargePilot(s, context);
    else roll(s, context);
  } else if (action.type === 'plunder') {
    const b = s.boats.find((x) => x.cargo === action.cargo)!;
    dock(s, b, action.destination);
    s.plunderQueue.shift();
    if (!s.plunderQueue.length) settle(s, context);
  } else if (action.type === 'next-voyage') nextVoyage(s);
}
