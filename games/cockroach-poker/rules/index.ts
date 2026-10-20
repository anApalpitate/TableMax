import type { GameRules, JsonValue } from '@tablemax/game-sdk';
import { kinds, kindOf, names, type Kind } from './cards';
import { validateState, type State } from './state';
import { loserFor, winnersFor } from './scoring';
import { project } from './project';
export type Action =
  | { type: 'offer'; card: number; target: string; claim: Kind }
  | { type: 'pass'; target: string; claim: Kind }
  | { type: 'peek' }
  | { type: 'judge'; belief: boolean }
  | { type: 'next-round' };
export function legal(s: State, id: string): Action[] {
  if (s.loser) return [];
  if (!s.offer)
    return s.turn === id
      ? s.hands[id]!.flatMap((card) =>
          s.seats
            .filter((x) => x !== id)
            .flatMap((target) =>
              kinds.map((claim) => ({
                type: 'offer' as const,
                card,
                target,
                claim,
              })),
            ),
        )
      : [];
  const o = s.offer;
  if (o.target !== id) return [];
  const targets = s.seats.filter((x) => !o.seen.includes(x) && x !== id);
  if (o.passing)
    return targets.flatMap((target) =>
      kinds.map((claim) => ({ type: 'pass' as const, target, claim })),
    );
  return [
    { type: 'judge', belief: true },
    { type: 'judge', belief: false },
    ...(targets.length && s.seats.length > 2
      ? [{ type: 'peek' as const }]
      : []),
  ];
}
export const rules: GameRules = {
  manifest: {
    id: 'cockroach-poker',
    name: '德国小强',
    gameVersion: '1.0.0',
    rulesVersion: 'classic-40829-1',
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 6 },
    assetNamespace: 'cockroach-poker',
  },
  initialize(context) {
    if (context.seats.length < 2 || context.seats.length > 6)
      throw new Error('Requires 2–6 seats');
    const deck = Array.from({ length: 64 }, (_, i) => i);
    for (let i = 63; i > 0; i--) {
      const j = Math.floor(context.random.next() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    const removed = context.seats.length === 2 ? deck.splice(0, 10) : [];
    const hands = Object.fromEntries(
      context.seats.map((s) => [s, [] as number[]]),
    );
    deck.forEach((c, i) =>
      hands[context.seats[i % context.seats.length]!]!.push(c),
    );
    return {
      seats: [...context.seats],
      hands,
      piles: Object.fromEntries(context.seats.map((s) => [s, []])),
      removed,
      turn: context.seats[0]!,
      serial: 0,
      offer: null,
      last: null,
      loser: null,
      winners: [],
    };
  },
  validateState,
  decisions(input) {
    const s = input as State;
    return s.loser
      ? []
      : [{ id: `cockroach-${s.serial}`, seatId: s.offer?.target ?? s.turn }];
  },
  ended(input) {
    return (input as State).loser !== null;
  },
  validateAction(input): JsonValue {
    if (!input || typeof input !== 'object') throw new Error('Invalid action');
    const a = input as Action;
    const keys = Object.keys(a).sort().join(',');
    if (
      (a.type === 'judge' &&
        keys === 'belief,type' &&
        typeof a.belief === 'boolean') ||
      ((a.type === 'peek' || a.type === 'next-round') && keys === 'type')
    )
      return a.type === 'judge'
        ? { type: 'judge', belief: a.belief }
        : { type: a.type };
    if (
      ((a.type === 'offer' &&
        keys === 'card,claim,target,type' &&
        Number.isInteger(a.card) &&
        a.card >= 0 &&
        a.card < 64) ||
        (a.type === 'pass' && keys === 'claim,target,type')) &&
      typeof a.target === 'string' &&
      kinds.includes(a.claim)
    )
      return a.type === 'offer'
        ? { type: 'offer', card: a.card, target: a.target, claim: a.claim }
        : { type: 'pass', target: a.target, claim: a.claim };
    throw new Error('Invalid action');
  },
  legalActions(input, id) {
    return legal(input as State, id);
  },
  apply(input, action, id) {
    const original = input as State;
    const a = rules.validateAction(action) as Action;
    if (
      !legal(original, id).some((x) =>
        Object.keys(x).every(
          (k) =>
            (x as unknown as Record<string, unknown>)[k] ===
            (a as unknown as Record<string, unknown>)[k],
        ),
      )
    )
      throw new Error('Illegal action');
    const s = structuredClone(original);
    s.serial++;
    let text = '';
    let reveal = false;
    if (a.type === 'offer') {
      s.hands[id]!.splice(s.hands[id]!.indexOf(a.card), 1);
      s.offer = {
        card: a.card,
        sender: id,
        target: a.target,
        claim: a.claim,
        seen: [id],
        passing: false,
        route: [{ sender: id, target: a.target, claim: a.claim }],
      };
      text = `声明：${names[a.claim]}`;
    } else if (a.type === 'peek') {
      s.offer!.seen.push(id);
      s.offer!.passing = true;
      text = '已秘密查看，须继续转传';
      reveal = true;
    } else if (a.type === 'pass') {
      const o = s.offer!;
      o.sender = id;
      o.target = a.target;
      o.claim = a.claim;
      o.passing = false;
      o.route.push({ sender: id, target: a.target, claim: a.claim });
      text = `转传并声明：${names[a.claim]}`;
    } else if (a.type === 'judge') {
      const o = s.offer!;
      const correct = a.belief === (kindOf(o.card) === o.claim);
      const collector = correct ? o.sender : id;
      s.piles[collector]!.push(o.card);
      s.last = {
        card: o.card,
        sender: o.sender,
        target: id,
        claim: o.claim,
        belief: a.belief,
        collector,
      };
      s.turn = collector;
      s.offer = null;
      s.loser = loserFor(s.seats, s.hands, s.piles, s.turn);
      s.winners = winnersFor(s.seats, s.loser);
      text = `揭晓：${names[kindOf(o.card)]}，${correct ? '判断正确' : '判断错误'}`;
      reveal = true;
    }
    return {
      state: s,
      decision: {
        label:
          a.type === 'peek'
            ? '秘密查看之前'
            : a.type === 'judge'
              ? '判断真假之前'
              : '声明与传牌之前',
        revealedInformation: reveal,
      },
      events: [{ kind: a.type === 'judge' ? 'reveal' : 'pass', text }],
    };
  },
  lifecycleActions(input) {
    return rules.ended(input) ? [{ type: 'next-round' }] : [];
  },
  applyLifecycle(input, action, context) {
    if (
      !rules.ended(input) ||
      JSON.stringify(rules.validateAction(action)) !==
        JSON.stringify({ type: 'next-round' })
    )
      throw new Error('Illegal lifecycle action');
    return {
      state: rules.initialize(context),
      decision: { label: '重新发牌之前', revealedInformation: true },
    };
  },
  project(input, viewer) {
    return project(input as State, viewer);
  },
};
