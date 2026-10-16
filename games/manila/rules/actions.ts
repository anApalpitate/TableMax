import { CARGOS, CARGO } from './catalog';
import { occupant, turnSeat, workerCount, type State } from './state';
import type { Action, CargoId } from './view';

const setups: Action[] = [];
for (const a of CARGOS)
  for (const b of CARGOS)
    for (const c of CARGOS) {
      if (new Set([a, b, c]).size !== 3) continue;
      for (let x = 0; x <= 5; x++)
        for (let y = 0; y <= 5; y++) {
          const z = 9 - x - y;
          if (z >= 0 && z <= 5)
            setups.push({
              type: 'setup',
              cargos: [a, b, c],
              positions: [x, y, z],
            });
        }
    }
export function credit(s: State, seat: string): number {
  return s.players[seat]!.shares.filter((x) => !x.mortgaged).length * 12;
}
export function boardTargets(s: State): CargoId[] {
  return s.boats
    .filter(
      (b) =>
        b.destination === 'sea' &&
        b.position === 13 &&
        b.crew.length < CARGO[b.cargo].costs.length,
    )
    .map((b) => b.cargo);
}
export function placementSpaces(s: State, seat: string): string[] {
  const p = s.players[seat]!;
  if (p.passed || p.usedWorkers >= workerCount(s)) return [];
  const vacancies = s.spaces.filter(
    (space) =>
      space.occupant === null &&
      (space.kind !== 'cargo' ||
        s.boats.some(
          (b) => b.cargo === space.cargo && b.destination === 'sea',
        )) &&
      (space.kind !== 'cargo' ||
        !s.spaces.some(
          (x) =>
            x.cargo === space.cargo &&
            x.index < space.index &&
            x.occupant === null,
        )) &&
      (space.kind !== 'pirate' ||
        space.index === 0 ||
        occupant(s, 'pirate-0') !== null),
  );
  const funds = p.cash + credit(s, seat);
  // The 2005 body text allows an insolvent blind passenger at any vacant paid
  // post except insurance. The 2014 punt-only restriction is a different edition.
  const cheapest = Math.min(
    ...vacancies.filter((x) => x.kind !== 'insurance').map((x) => x.cost),
  );
  return vacancies
    .filter((x) =>
      funds < cheapest ? x.kind !== 'insurance' : x.cost <= funds,
    )
    .map((x) => x.id);
}
function pilotActions(s: State): Action[] {
  const budget = s.phase === 'pilot-small' ? 1 : 2;
  const boats = s.boats.filter((b) => b.destination === 'sea');
  const actions: Action[] = [{ type: 'pilot', moves: [] }];
  for (const boat of boats)
    for (let delta = -budget; delta <= budget; delta++)
      if (delta !== 0 && boat.position + delta >= 0)
        actions.push({ type: 'pilot', moves: [{ cargo: boat.cargo, delta }] });
  if (budget === 2)
    for (let i = 0; i < boats.length; i++)
      for (let j = i + 1; j < boats.length; j++)
        for (const a of [-1, 1])
          for (const b of [-1, 1]) {
            if (boats[i]!.position + a >= 0 && boats[j]!.position + b >= 0)
              actions.push({
                type: 'pilot',
                moves: [
                  { cargo: boats[i]!.cargo, delta: a },
                  { cargo: boats[j]!.cargo, delta: b },
                ],
              });
          }
  return actions;
}
export function legalActions(s: State, seat: string): Action[] {
  if (turnSeat(s) !== seat || s.phase === 'ended') return [];
  let actions: Action[] = [];
  if (s.phase === 'financing')
    return s.players[seat]!.shares.filter((x) => !x.mortgaged).map((share) => ({
      type: 'mortgage',
      shareId: share.id,
    }));
  if (s.phase === 'auction') {
    actions.push({ type: 'pass' });
    for (
      let amount = s.auction.bid + 1;
      amount <= s.players[seat]!.cash + credit(s, seat);
      amount++
    )
      actions.push({ type: 'bid', amount });
  } else if (s.phase === 'share') {
    actions.push({ type: 'skip-share' });
    for (const cargo of CARGOS)
      if (
        s.stock[cargo] > 0 &&
        Math.max(5, s.market[cargo]) <= s.players[seat]!.cash + credit(s, seat)
      )
        actions.push({ type: 'buy-share', cargo });
  } else if (s.phase === 'setup') actions = structuredClone(setups);
  else if (s.phase === 'place')
    actions = [
      ...placementSpaces(s, seat).map((space): Action => ({
        type: 'place',
        space,
      })),
      { type: 'pass' },
    ];
  else if (s.phase === 'board')
    actions = [
      { type: 'board', cargo: null },
      ...boardTargets(s).map((cargo): Action => ({ type: 'board', cargo })),
    ];
  else if (s.phase.startsWith('pilot-')) actions = pilotActions(s);
  else if (s.phase === 'plunder')
    actions = ['port', 'shipyard'].map(
      (destination) =>
        ({ type: 'plunder', cargo: s.plunderQueue[0]!, destination }) as Action,
    );
  else if (s.phase === 'round-result') actions = [{ type: 'next-voyage' }];
  if (s.phase !== 'round-result')
    for (const share of s.players[seat]!.shares) {
      if (!share.mortgaged)
        actions.push({ type: 'mortgage', shareId: share.id });
      else if (s.players[seat]!.cash >= 15)
        actions.push({ type: 'repay', shareId: share.id });
    }
  return actions;
}
function plain(x: unknown): x is Record<string, unknown> {
  return (
    !!x &&
    typeof x === 'object' &&
    !Array.isArray(x) &&
    Object.getPrototypeOf(x) === Object.prototype
  );
}
function keys(x: Record<string, unknown>, names: string[]): boolean {
  return Object.keys(x).sort().join('|') === [...names].sort().join('|');
}
export function validateAction(input: unknown): Action {
  if (!plain(input) || typeof input.type !== 'string')
    throw new Error('Invalid Manila action');
  const a = input;
  let valid = false;
  const cargo = (x: unknown): x is CargoId =>
    typeof x === 'string' && CARGOS.includes(x as CargoId);
  if (['pass', 'skip-share', 'next-voyage'].includes(a.type as string))
    valid = keys(a, ['type']);
  else if (a.type === 'bid')
    valid =
      keys(a, ['type', 'amount']) &&
      Number.isSafeInteger(a.amount) &&
      (a.amount as number) > 0;
  else if (a.type === 'buy-share')
    valid = keys(a, ['type', 'cargo']) && cargo(a.cargo);
  else if (a.type === 'setup')
    valid =
      keys(a, ['type', 'cargos', 'positions']) &&
      Array.isArray(a.cargos) &&
      a.cargos.length === 3 &&
      a.cargos.every(cargo) &&
      new Set(a.cargos).size === 3 &&
      Array.isArray(a.positions) &&
      a.positions.length === 3 &&
      a.positions.every((n) => Number.isInteger(n) && n >= 0 && n <= 5) &&
      a.positions.reduce((x, y) => x + y, 0) === 9;
  else if (a.type === 'place')
    valid =
      keys(a, ['type', 'space']) &&
      typeof a.space === 'string' &&
      a.space.length < 70;
  else if (a.type === 'board')
    valid = keys(a, ['type', 'cargo']) && (a.cargo === null || cargo(a.cargo));
  else if (a.type === 'pilot')
    valid =
      keys(a, ['type', 'moves']) &&
      Array.isArray(a.moves) &&
      a.moves.length <= 2 &&
      a.moves.every(
        (move) =>
          plain(move) &&
          keys(move, ['cargo', 'delta']) &&
          cargo(move.cargo) &&
          Number.isInteger(move.delta) &&
          [-2, -1, 1, 2].includes(move.delta as number),
      ) &&
      new Set(a.moves.map((m) => (m as { cargo: string }).cargo)).size ===
        a.moves.length &&
      a.moves.reduce(
        (sum, m) => sum + Math.abs((m as { delta: number }).delta),
        0,
      ) <= 2;
  else if (a.type === 'plunder')
    valid =
      keys(a, ['type', 'cargo', 'destination']) &&
      cargo(a.cargo) &&
      ['port', 'shipyard'].includes(a.destination as string);
  else if (a.type === 'mortgage' || a.type === 'repay')
    valid =
      keys(a, ['type', 'shareId']) &&
      typeof a.shareId === 'string' &&
      /^(nutmeg|silk|ginseng|jade)-[1-5]$/.test(a.shareId);
  if (!valid) throw new Error('Invalid Manila action');
  const normalized = structuredClone(a) as Action;
  if (normalized.type === 'pilot')
    normalized.moves.sort(
      (a, b) => CARGOS.indexOf(a.cargo) - CARGOS.indexOf(b.cargo),
    );
  return normalized;
}
export function isLegalAction(s: State, action: Action, seat: string): boolean {
  const signature = actionSignature(action);
  return legalActions(s, seat).some(
    (candidate) => actionSignature(candidate) === signature,
  );
}
export function actionSignature(action: Action): string {
  if (action.type === 'pilot')
    return JSON.stringify({
      type: 'pilot',
      moves: [...action.moves].sort(
        (a, b) => CARGOS.indexOf(a.cargo) - CARGOS.indexOf(b.cargo),
      ),
    });
  // JSON object key insertion order is not an action semantic.
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(action).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
