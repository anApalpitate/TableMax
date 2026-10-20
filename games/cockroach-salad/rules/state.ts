import type { State } from '../types';
import { vegetables, card, validateSetup } from '../types';
const keys = [
  'seats',
  'hands',
  'spare',
  'piles',
  'pile',
  'actor',
  'phase',
  'step',
  'turn',
  'current',
  'previousVegetable',
  'previousAnswer',
  'taboo',
  'answer',
  'late',
  'responses',
  'winners',
  'setup',
  'accepted',
  'lastResult',
]
  .sort()
  .join();
export function validateState(input: unknown, seats: readonly string[]): State {
  const s = input as State;
  const bad = () => {
    throw new Error('蟑螂沙拉存档不变量不符');
  };
  if (!s || typeof s !== 'object' || Object.keys(s).sort().join() !== keys)
    return bad();
  if (
    !Array.isArray(s.seats) ||
    seats.length < 2 ||
    seats.length > 6 ||
    s.seats.join('\0') !== seats.join('\0') ||
    new Set(seats).size !== seats.length
  )
    return bad();
  if (
    !s.hands ||
    Object.keys(s.hands).sort().join() !== [...seats].sort().join() ||
    !s.responses ||
    Object.keys(s.responses).some(
      (k) =>
        !seats.includes(k) ||
        k === s.actor ||
        !['challenge', 'pass'].includes(s.responses[k]!),
    )
  )
    return bad();
  if (
    ![s.step, s.turn, s.accepted].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    s.turn < 1 ||
    s.step < s.turn ||
    s.accepted > s.turn - (s.phase === 'ended' ? 0 : 1) ||
    !seats.includes(s.actor) ||
    ![0, 1].includes(s.pile) ||
    !['thinking', 'overtime', 'review', 'ended'].includes(s.phase)
  )
    return bad();
  if (
    !Array.isArray(s.piles) ||
    s.piles.length !== 2 ||
    !Array.isArray(s.spare) ||
    s.spare.length !== 128 % seats.length
  )
    return bad();
  const zones = [...seats.map((k) => s.hands[k]), ...s.piles, s.spare];
  if (
    zones.some(
      (z) =>
        !Array.isArray(z) ||
        z.some((n) => !Number.isInteger(n) || n < 0 || n >= 128),
    )
  )
    return bad();
  const ids = zones.flat();
  if (
    !Number.isInteger(s.current) ||
    s.current < 0 ||
    s.current >= 128 ||
    ids.length !== 128 ||
    new Set(ids).size !== 128 ||
    (s.phase !== 'ended' && s.piles[s.pile]!.at(-1) !== s.current)
  )
    return bad();
  const answerOK = (a: unknown) =>
    a === null || [...vegetables, 'cockroach'].includes(a as never);
  if (
    !answerOK(s.answer) ||
    !answerOK(s.previousAnswer) ||
    !(
      s.previousVegetable === null || vegetables.includes(s.previousVegetable)
    ) ||
    typeof s.late !== 'boolean' ||
    typeof s.lastResult !== 'string' ||
    s.lastResult.length > 300
  )
    return bad();
  if (
    !Array.isArray(s.taboo) ||
    s.taboo.length > 2 ||
    new Set(s.taboo).size !== s.taboo.length ||
    s.taboo.some((v) => !vegetables.includes(v))
  )
    return bad();
  const visible = s.piles
    .map((p) => p.at(-1))
    .filter((id): id is number => id !== undefined)
    .map(card)
    .filter((c) => c.taboo)
    .map((c) => c.vegetable);
  if (s.phase !== 'ended') {
    const old = s.piles
      .map((p, i) =>
        i === s.pile && !card(s.current).taboo ? p.at(-2) : p.at(-1),
      )
      .filter((id): id is number => id !== undefined)
      .map(card)
      .filter((c) => c.taboo)
      .map((c) => c.vegetable);
    const expected = [
      ...new Set([
        ...old,
        ...(card(s.current).taboo ? [card(s.current).vegetable] : []),
      ]),
    ].sort();
    if (
      [...s.taboo].sort().join() !== expected.join() ||
      visible.some((v) => !s.taboo.includes(v))
    )
      return bad();
  }
  if (
    (s.phase === 'thinking' &&
      (s.answer !== null || s.late || Object.keys(s.responses).length)) ||
    (s.phase === 'overtime' && (s.answer !== null || !s.late)) ||
    (s.phase === 'review' && s.answer === null)
  )
    return bad();
  if (
    !Array.isArray(s.winners) ||
    s.winners.some((k) => !seats.includes(k)) ||
    s.winners.length > 1 ||
    (s.phase === 'ended') !== (s.winners.length === 1) ||
    (s.winners[0] && s.hands[s.winners[0]]!.length !== 0)
  )
    return bad();
  if (
    s.seats.some((k) => k !== s.actor && s.hands[k]!.length === 0) ||
    (s.phase === 'ended' && (s.winners[0] !== s.actor || s.answer === null))
  )
    return bad();
  validateSetup(s.setup);
  return structuredClone(s);
}
