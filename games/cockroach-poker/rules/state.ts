import { kinds, kindOf, type Kind } from './cards';
import { loserFor, winnersFor } from './scoring';
export type Offer = {
  card: number;
  sender: string;
  target: string;
  claim: Kind;
  seen: string[];
  passing: boolean;
  route: { sender: string; target: string; claim: Kind }[];
};
export type Reveal = {
  card: number;
  sender: string;
  target: string;
  claim: Kind;
  belief: boolean;
  collector: string;
};
export type State = {
  seats: string[];
  hands: Record<string, number[]>;
  piles: Record<string, number[]>;
  removed: number[];
  turn: string;
  serial: number;
  offer: Offer | null;
  last: Reveal | null;
  loser: string | null;
  winners: string[];
};
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function validateState(input: unknown, seats: readonly string[]): State {
  const s = input as State;
  const fail = () => {
    throw new Error('Invalid cockroach poker state');
  };
  if (
    !s ||
    !Array.isArray(s.seats) ||
    !equal(s.seats, seats) ||
    seats.length < 2 ||
    seats.length > 6 ||
    new Set(seats).size !== seats.length ||
    !seats.every((x) => typeof x === 'string' && x.length > 0) ||
    !seats.includes(s.turn) ||
    !Number.isSafeInteger(s.serial) ||
    s.serial < 0 ||
    !s.hands ||
    !s.piles ||
    (s.offer !== null &&
      (typeof s.offer !== 'object' || Array.isArray(s.offer))) ||
    (s.last !== null &&
      (typeof s.last !== 'object' || Array.isArray(s.last))) ||
    !Array.isArray(s.removed) ||
    !Array.isArray(s.winners)
  )
    return fail();
  if (
    !equal(
      Object.keys(s).sort(),
      [
        'seats',
        'hands',
        'piles',
        'removed',
        'turn',
        'serial',
        'offer',
        'last',
        'loser',
        'winners',
      ].sort(),
    )
  )
    return fail();
  for (const group of [s.hands, s.piles])
    if (
      !equal(Object.keys(group).sort(), [...seats].sort()) ||
      !Object.values(group).every(Array.isArray)
    )
      return fail();
  if (s.removed.length !== (seats.length === 2 ? 10 : 0)) return fail();
  const o = s.offer;
  if (o) {
    if (
      !equal(
        Object.keys(o).sort(),
        [
          'card',
          'sender',
          'target',
          'claim',
          'seen',
          'passing',
          'route',
        ].sort(),
      ) ||
      !seats.includes(o.sender) ||
      !seats.includes(o.target) ||
      o.sender === o.target ||
      !kinds.includes(o.claim) ||
      !Array.isArray(o.seen) ||
      new Set(o.seen).size !== o.seen.length ||
      !o.seen.every((x) => seats.includes(x)) ||
      !o.seen.includes(o.sender) ||
      typeof o.passing !== 'boolean' ||
      !Array.isArray(o.route) ||
      o.route.length < 1 ||
      o.route.length > seats.length - 1 ||
      (seats.length === 2 && o.passing)
    )
      return fail();
    if (
      o.passing !== o.seen.includes(o.target) ||
      (o.passing && o.seen.length >= seats.length)
    )
      return fail();
    if (
      o.route[0]!.sender !== s.turn ||
      !equal(o.route.at(-1), {
        sender: o.sender,
        target: o.target,
        claim: o.claim,
      })
    )
      return fail();
    const visited = [o.route[0]!.sender];
    for (const [i, r] of o.route.entries()) {
      if (
        !equal(Object.keys(r).sort(), ['claim', 'sender', 'target']) ||
        !kinds.includes(r.claim) ||
        !seats.includes(r.target) ||
        visited.includes(r.target) ||
        r.sender !== visited.at(-1)
      )
        return fail();
      if (i < o.route.length - 1 || o.passing) visited.push(r.target);
    }
    if (!equal(visited, o.seen)) return fail();
  }
  const all = [
    ...Object.values(s.hands).flat(),
    ...Object.values(s.piles).flat(),
    ...s.removed,
    ...(o ? [o.card] : []),
  ];
  if (
    all.length !== 64 ||
    new Set(all).size !== 64 ||
    !all.every((c) => Number.isInteger(c) && c >= 0 && c < 64)
  )
    return fail();
  if (s.last) {
    const r = s.last;
    if (
      !equal(
        Object.keys(r).sort(),
        ['card', 'sender', 'target', 'claim', 'belief', 'collector'].sort(),
      ) ||
      !Number.isInteger(r.card) ||
      r.card < 0 ||
      r.card >= 64 ||
      !seats.includes(r.sender) ||
      !seats.includes(r.target) ||
      r.sender === r.target ||
      !kinds.includes(r.claim) ||
      typeof r.belief !== 'boolean' ||
      !seats.includes(r.collector) ||
      s.piles[r.collector]!.at(-1) !== r.card ||
      s.turn !== r.collector ||
      r.collector !==
        (r.belief === (kindOf(r.card) === r.claim) ? r.sender : r.target)
    )
      return fail();
  }
  const threshold = seats.length === 2 ? 5 : 4;
  const completed = seats.filter((seat) =>
    kinds.some(
      (kind) =>
        s.piles[seat]!.filter((card) => kindOf(card) === kind).length ===
        threshold,
    ),
  );
  if (
    completed.length > 1 ||
    Object.values(s.piles).some((pile) =>
      kinds.some(
        (kind) =>
          pile.filter((card) => kindOf(card) === kind).length > threshold,
      ),
    )
  )
    return fail();
  if (
    completed.length &&
    (s.last?.collector !== completed[0] || s.turn !== completed[0])
  )
    return fail();
  const loser = o ? null : loserFor(s.seats, s.hands, s.piles, s.turn);
  if (
    s.loser !== loser ||
    !equal(s.winners, winnersFor(s.seats, loser)) ||
    (o &&
      Object.values(s.piles).some((p) =>
        kinds.some(
          (k) =>
            p.filter((c) => Math.floor(c / 8) === kinds.indexOf(k)).length >=
            (seats.length === 2 ? 5 : 4),
        ),
      ))
  )
    return fail();
  return structuredClone(s);
}
