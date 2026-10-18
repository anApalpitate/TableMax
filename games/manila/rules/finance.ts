import type { State } from './state';
import type { VoyageFinance, VoyageFinancePlayer } from './view';

const incomeKinds = [
  'cargo',
  'piracy',
  'port',
  'shipyard',
  'insurance',
] as const;
const expenseKinds = ['auction', 'shares', 'placement', 'insurance'] as const;
type CashFlow =
  | `income.${(typeof incomeKinds)[number]}`
  | `expenses.${(typeof expenseKinds)[number]}`
  | 'borrowed'
  | 'redeemed';

export function startFinance(
  voyage: number,
  seats: readonly string[],
  players: Record<string, { cash: number }>,
): VoyageFinance {
  return {
    voyage,
    players: Object.fromEntries(
      seats.map((seat) => [
        seat,
        {
          openingCash: players[seat]!.cash,
          closingCash: players[seat]!.cash,
          income: { cargo: 0, piracy: 0, port: 0, shipyard: 0, insurance: 0 },
          expenses: { auction: 0, shares: 0, placement: 0, insurance: 0 },
          borrowed: 0,
          redeemed: 0,
        },
      ]),
    ),
  };
}

/** Every real cash transfer is classified once, in the same authoritative state. */
export function changeCash(
  state: State,
  seat: string,
  flow: CashFlow,
  amount: number,
): void {
  const incoming = flow.startsWith('income.') || flow === 'borrowed';
  state.players[seat]!.cash += incoming ? amount : -amount;
  const entry = state.voyageFinance?.players[seat];
  // A partial restored voyage must never acquire a fabricated complete ledger.
  if (!entry) return;
  if (flow === 'borrowed' || flow === 'redeemed') entry[flow] += amount;
  else if (flow.startsWith('income.'))
    entry.income[flow.slice(7) as keyof VoyageFinancePlayer['income']] +=
      amount;
  else
    entry.expenses[flow.slice(9) as keyof VoyageFinancePlayer['expenses']] +=
      amount;
  entry.closingCash = state.players[seat]!.cash;
}

function exact(
  input: unknown,
  keys: readonly string[],
): input is Record<string, unknown> {
  return (
    !!input &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) === Object.prototype &&
    Object.keys(input).sort().join('|') === [...keys].sort().join('|')
  );
}
function nonnegative(input: unknown): input is number {
  return Number.isSafeInteger(input) && (input as number) >= 0;
}
export function validFinance(
  input: unknown,
  voyage: number,
  seats: readonly string[],
  balances: Record<string, { cash: number }>,
): input is VoyageFinance {
  if (
    !exact(input, ['voyage', 'players']) ||
    input.voyage !== voyage ||
    !exact(input.players, seats)
  )
    return false;
  const players = input.players;
  return seats.every((seat) => {
    const entry = players[seat];
    if (
      !exact(entry, [
        'openingCash',
        'closingCash',
        'income',
        'expenses',
        'borrowed',
        'redeemed',
      ]) ||
      !nonnegative(entry.openingCash) ||
      !nonnegative(entry.closingCash) ||
      !nonnegative(entry.borrowed) ||
      entry.borrowed % 12 !== 0 ||
      !nonnegative(entry.redeemed) ||
      entry.redeemed % 15 !== 0 ||
      !exact(entry.income, incomeKinds) ||
      !Object.values(entry.income).every(nonnegative) ||
      !exact(entry.expenses, expenseKinds) ||
      !Object.values(entry.expenses).every(nonnegative)
    )
      return false;
    const income = Object.values(entry.income).reduce<number>(
      (sum, value) => sum + (value as number),
      0,
    );
    const expenses = Object.values(entry.expenses).reduce<number>(
      (sum, value) => sum + (value as number),
      0,
    );
    return (
      Number.isSafeInteger(income) &&
      Number.isSafeInteger(expenses) &&
      entry.closingCash === balances[seat]!.cash &&
      entry.closingCash ===
        entry.openingCash + income - expenses + entry.borrowed - entry.redeemed
    );
  });
}

export function sameFinance(
  first: VoyageFinance,
  second: VoyageFinance,
): boolean {
  return (
    first.voyage === second.voyage &&
    Object.keys(first.players).every((seat) => {
      const a = first.players[seat]!,
        b = second.players[seat]!;
      return (
        a.openingCash === b.openingCash &&
        a.closingCash === b.closingCash &&
        a.borrowed === b.borrowed &&
        a.redeemed === b.redeemed &&
        incomeKinds.every((kind) => a.income[kind] === b.income[kind]) &&
        expenseKinds.every((kind) => a.expenses[kind] === b.expenses[kind])
      );
    })
  );
}
