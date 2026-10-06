import type { GameRules, RuleContext, PublicAction } from '@tablemax/game-sdk';
import { card, instancesForSeats, type Ability } from './cards';
import { grid, tasks, task } from './research';
import { scoreBoard } from './scoring';
import {
  phases,
  actor,
  decisionId,
  validateState,
  legacyPendingAbility,
  type EventEffect,
  type State,
  type Action,
  type Phase,
} from './state';
import { project, type View } from './project';
export type { State, Action, Phase, View };

export function shuffle<T>(
  items: readonly T[],
  random: RuleContext['random'],
): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
function selectResearch(
  pool: 'opening' | 'hoenn',
  used: string[],
  count: number,
  context: RuleContext,
) {
  let available = tasks.filter((t) => t.pool === pool && !used.includes(t.id));
  if (available.length < count) {
    used.length = 0;
    available = tasks.filter((t) => t.pool === pool);
  }
  return shuffle(
    available.map((t) => t.id),
    context.random,
  ).slice(0, count);
}
function round(
  context: RuleContext,
  starter: string,
  wins: Record<string, number>,
  number: number,
  previous?: State,
): State {
  const usedOpeningResearch = previous ? [...previous.usedOpeningResearch] : [],
    usedHoennResearch = previous ? [...previous.usedHoennResearch] : [];
  return {
    gameId: 'pokemon-encounters',
    variantId: 'expansion',
    rulesVersion: 'tablemax-cn-expansion-v1',
    stateVersion: 1,
    roundNumber: number,
    seatOrder: [...context.seats],
    winsBySeat: wins,
    boards: Object.fromEntries(context.seats.map((id) => [id, []])),
    deck: instancesForSeats(context.seats.length),
    discard: [],
    held: null,
    phase: 'research-vote',
    turnSeat: starter,
    initialDone: [],
    step: previous ? previous.step + 1 : 0,
    drawSource: null,
    coin: null,
    recipientQueue: [],
    recipientIndex: 0,
    peekSlots: [],
    targetSeat: null,
    suppressedAbility: false,
    usedAbilityIds: [],
    pendingAbility: null,
    rowAbility: null,
    researchCandidates: selectResearch(
      'opening',
      usedOpeningResearch,
      3,
      context,
    ),
    votesBySeat: {},
    voteCounts: null,
    activeResearch: [],
    usedOpeningResearch,
    usedHoennResearch,
    hoennTriggered: false,
    hoennPending: null,
    arceusUsed: false,
    preReveal: null,
    roundResult: null,
    matchWinners: [],
    eventCounter: previous?.eventCounter ?? 0,
    events: previous ? structuredClone(previous.events) : [],
  };
}
function deal(s: State, context: RuleContext) {
  const excluded = s.deck.filter((id) =>
    ['special-mewtwo', 'special-arceus'].includes(card(id).categoryId),
  );
  s.deck = shuffle(
    s.deck.filter((id) => !excluded.includes(id)),
    context.random,
  );
  const order = orderFrom(s.seatOrder, s.turnSeat);
  for (let i = 0; i < 9; i++)
    for (const seat of order)
      s.boards[seat]!.push({ instanceId: s.deck.pop()!, faceUp: false });
  s.deck = shuffle([...s.deck, ...excluded], context.random);
  s.discard.push(s.deck.pop()!, s.deck.pop()!);
  s.phase = 'initial-flip';
}
function orderFrom(seats: readonly string[], start: string, direction = 1) {
  return Array.from(
    { length: seats.length },
    (_, i) =>
      seats[
        (seats.indexOf(start) + i * direction + seats.length) % seats.length
      ]!,
  );
}
function event(
  s: State,
  kind: string,
  text: string,
  action?: PublicAction,
  effect?: EventEffect,
) {
  s.eventCounter++;
  s.events.push({
    id: s.eventCounter,
    kind,
    text,
    ...(action ? { action } : {}),
    ...(effect ? { effect } : {}),
  });
  s.events = s.events.slice(-60);
}
function checkHoenn(s: State, context: RuleContext) {
  if (s.hoennTriggered) return;
  const visible = s.seatOrder.flatMap((seat) =>
    s.boards[seat]!.filter((c) => c.faceUp).map(
      (c) => card(c.instanceId).ability,
    ),
  );
  if (
    ['groudon', 'kyogre', 'rayquaza'].every((a) =>
      visible.includes(a as Ability),
    )
  ) {
    s.hoennTriggered = true;
    s.hoennPending = selectResearch(
      'hoenn',
      s.usedHoennResearch,
      1,
      context,
    )[0]!;
    s.usedHoennResearch.push(s.hoennPending);
  }
}
function publishHoenn(s: State) {
  if (s.hoennPending !== null) {
    s.activeResearch.push(s.hoennPending);
    event(
      s,
      'research',
      `丰缘三神齐聚，发布「${task(s.hoennPending).name}」。`,
    );
    s.hoennPending = null;
  }
}
const canDrawDeck = (s: State) => s.deck.length > 0 || s.discard.length > 2;
function beginAbility(s: State, sourceInstanceId: string, ability: Ability) {
  s.pendingAbility = { kind: 'current', ability, sourceInstanceId };
}
function useAbility(s: State) {
  const pending = s.pendingAbility;
  if (
    pending?.kind === 'current' &&
    pending.sourceInstanceId !== null &&
    !s.usedAbilityIds!.includes(pending.sourceInstanceId)
  )
    s.usedAbilityIds!.push(pending.sourceInstanceId);
}
/** Only an already public source hidden by this result needs a public memory hint. */
function coveredAbilitySource(
  before: State,
  after: State,
): EventEffect['source'] {
  const pending = before.pendingAbility;
  if (pending?.kind !== 'current' || pending.sourceInstanceId === null)
    return undefined;
  for (const seat of before.seatOrder) {
    const slot = before.boards[seat]!.findIndex(
      (c) => c.instanceId === pending.sourceInstanceId && c.faceUp,
    );
    if (
      slot >= 0 &&
      after.boards[seat]!.some(
        (c) => c.instanceId === pending.sourceInstanceId && !c.faceUp,
      )
    )
      return { seat, slot };
  }
  return undefined;
}
function drawDeck(s: State, context: RuleContext) {
  if (!s.deck.length) {
    const keep = Math.min(2, s.discard.length),
      recycled = s.discard.slice(0, s.discard.length - keep);
    s.usedAbilityIds = s.usedAbilityIds!.filter((id) => !recycled.includes(id));
    s.deck = shuffle(recycled, context.random);
    s.discard = s.discard.slice(-keep);
  }
  const id = s.deck.pop();
  if (!id) throw new Error('No available expansion deck card');
  return id;
}
function replace(s: State, seat: string, slot: number) {
  if (!s.held) throw new Error('Missing held card');
  const outgoing = s.boards[seat]![slot]!.instanceId;
  s.boards[seat]![slot] = { instanceId: s.held, faceUp: true };
  s.held = null;
  return outgoing;
}
function finish(s: State, context: RuleContext) {
  checkHoenn(s, context);
  publishHoenn(s);
  s.held = null;
  s.peekSlots = [];
  s.targetSeat = null;
  s.recipientQueue = [];
  s.recipientIndex = 0;
  s.drawSource = null;
  s.rowAbility = null;
  s.suppressedAbility = false;
  s.pendingAbility = null;
  if (s.seatOrder.some((id) => s.boards[id]!.every((c) => c.faceUp))) {
    s.preReveal = Object.fromEntries(
      s.seatOrder.map((id) => [id, s.boards[id]!.map((c) => c.faceUp)]),
    );
    const scores = Object.fromEntries(
      s.seatOrder.map((id) => [
        id,
        scoreBoard(
          s.boards[id]!.map((c) => c.instanceId),
          s.activeResearch,
          s.preReveal![id]!,
        ),
      ]),
    );
    const min = Math.min(...Object.values(scores).map((v) => v.total)),
      winners = s.seatOrder.filter((id) => scores[id]!.total === min);
    for (const id of winners) s.winsBySeat[id]!++;
    s.roundResult = { scores, winners };
    s.matchWinners = s.seatOrder.filter((id) => s.winsBySeat[id] === 3);
    s.phase = s.matchWinners.length ? 'match-result' : 'round-result';
    for (const id of s.seatOrder)
      for (const c of s.boards[id]!) c.faceUp = true;
    event(
      s,
      'round-result',
      `第${s.roundNumber}小局结算，最低分${min}，${winners.length}位共同赢家。`,
    );
  } else {
    s.turnSeat = orderFrom(s.seatOrder, s.turnSeat)[1]!;
    s.phase = 'draw';
  }
}
function afterPlace(s: State, incoming: string, context: RuleContext) {
  const ability = card(incoming).ability;
  if (s.suppressedAbility || s.usedAbilityIds!.includes(incoming)) {
    finish(s, context);
    return;
  }
  const map: Partial<Record<Ability, Phase>> = {
    charizard: 'charizard-choice',
    snorlax: 'snorlax-choice',
    arceus: 'arceus-choice',
    greninja: 'greninja-choice',
    lucario: 'lucario-choice',
    groudon: 'row-choice',
    kyogre: 'row-choice',
    rayquaza: 'row-choice',
  };
  const phase = ability === null ? undefined : map[ability];
  if (
    !phase ||
    (ability === 'arceus' && s.arceusUsed) ||
    (ability === 'charizard' && s.boards[s.turnSeat]!.every((c) => c.faceUp))
  ) {
    finish(s, context);
    return;
  }
  s.phase = phase;
  beginAbility(s, incoming, ability!);
  if (phase === 'row-choice') s.rowAbility = ability as State['rowAbility'];
}
const slot = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 9;
export function validateAction(input: unknown): Action {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid expansion action');
  const a = input as Record<string, unknown>,
    keys = (fields: string[]) =>
      Object.keys(a).sort().join(',') === fields.sort().join(',');
  if (typeof a.type !== 'string') throw new Error('Invalid expansion action');
  if (
    [
      'discard-held',
      'decline-ability',
      'close-peek',
      'activate-arceus',
      'extra-draw',
      'next-round',
    ].includes(a.type) &&
    keys(['type'])
  )
    return { type: a.type } as Action;
  if (
    ['initial-flip', 'replace', 'peek', 'mewtwo-exchange'].includes(a.type) &&
    keys(['type', 'slot']) &&
    slot(a.slot)
  )
    return { type: a.type, slot: a.slot } as Action;
  if (
    a.type === 'vote-research' &&
    keys(['type', 'taskId']) &&
    typeof a.taskId === 'string' &&
    task(a.taskId).pool === 'opening'
  )
    return { type: a.type, taskId: a.taskId };
  if (a.type === 'draw' && a.source === 'deck' && keys(['type', 'source']))
    return { type: a.type, source: 'deck' };
  if (
    a.type === 'draw' &&
    a.source === 'discard' &&
    keys(['type', 'source', 'discardIndex']) &&
    (a.discardIndex === 0 || a.discardIndex === 1)
  )
    return { type: a.type, source: 'discard', discardIndex: a.discardIndex };
  if (
    ['swap', 'reposition'].includes(a.type) &&
    keys(['type', 'a', 'b']) &&
    slot(a.a) &&
    slot(a.b) &&
    a.a !== a.b
  )
    return { type: a.type, a: a.a, b: a.b } as Action;
  if (
    a.type === 'mew-target' &&
    keys(['type', 'seat', 'slot']) &&
    typeof a.seat === 'string' &&
    slot(a.slot)
  )
    return { type: a.type, seat: a.seat, slot: a.slot };
  if (
    a.type === 'mewtwo-target' &&
    keys(['type', 'seat', 'a', 'b']) &&
    typeof a.seat === 'string' &&
    slot(a.a) &&
    slot(a.b) &&
    a.a !== a.b
  )
    return { type: a.type, seat: a.seat, a: a.a, b: a.b };
  if (
    a.type === 'ninja-target' &&
    keys(['type', 'seat', 'a', 'b', 'swap']) &&
    typeof a.seat === 'string' &&
    slot(a.a) &&
    slot(a.b) &&
    a.a !== a.b &&
    typeof a.swap === 'boolean'
  )
    return { type: a.type, seat: a.seat, a: a.a, b: a.b, swap: a.swap };
  if (
    a.type === 'row-target' &&
    keys(['type', 'seat']) &&
    typeof a.seat === 'string'
  )
    return { type: a.type, seat: a.seat };
  if (
    a.type === 'pass-direction' &&
    keys(['type', 'direction']) &&
    ['clockwise', 'counterclockwise'].includes(a.direction as string)
  )
    return { type: a.type, direction: a.direction } as Action;
  throw new Error('Invalid expansion action');
}
export function legalActions(s: State, seat: string): Action[] {
  if (!s.seatOrder.includes(seat)) return [];
  if (s.phase === 'research-vote')
    return s.votesBySeat[seat] === undefined
      ? s.researchCandidates.map((taskId) => ({
          type: 'vote-research',
          taskId,
        }))
      : [];
  if (s.phase === 'initial-flip')
    return s.initialDone.includes(seat)
      ? []
      : grid.slots.map((slot) => ({ type: 'initial-flip', slot }));
  if (['round-result', 'match-result'].includes(s.phase) || actor(s) !== seat)
    return [];
  const replaceActions = grid.slots.map((slot) => ({
      type: 'replace' as const,
      slot,
    })),
    decline: Action = { type: 'decline-ability' };
  const pairs = grid.slots.flatMap((a) =>
      grid.slots.filter((b) => b > a).map((b) => ({ a, b })),
    ),
    opponents = s.seatOrder.filter((id) => id !== seat);
  const draws: Action[] = [
    ...(s.deck.length || s.discard.length > 2
      ? [{ type: 'draw' as const, source: 'deck' as const }]
      : []),
    ...s.discard.slice(-2).map((_, discardIndex) => ({
      type: 'draw' as const,
      source: 'discard' as const,
      discardIndex: discardIndex as 0 | 1,
    })),
  ];
  switch (s.phase) {
    case 'draw':
      return [
        ...draws,
        ...pairs.map((p) => ({ type: 'reposition' as const, ...p })),
      ];
    case 'lucario-draw':
      return canDrawDeck(s) ? [{ type: 'draw', source: 'deck' }] : [decline];
    case 'place':
      return [
        ...replaceActions,
        ...(s.drawSource === 'deck' ? [{ type: 'discard-held' as const }] : []),
      ];
    case 'mew-other':
      return opponents.flatMap((id) =>
        grid.slots.map((slot) => ({
          type: 'mew-target' as const,
          seat: id,
          slot,
        })),
      );
    case 'mew-self':
    case 'rocket-meowth':
    case 'rocket-pikachu':
    case 'zapdos-self':
    case 'zapdos-receive':
      return replaceActions;
    case 'zapdos-direction':
      return [
        { type: 'pass-direction', direction: 'clockwise' },
        { type: 'pass-direction', direction: 'counterclockwise' },
      ];
    case 'snorlax-choice':
      return [decline, ...pairs.map((p) => ({ type: 'swap' as const, ...p }))];
    case 'charizard-choice':
      return [
        decline,
        ...grid.slots
          .filter((slot) => !s.boards[seat]![slot]!.faceUp)
          .map((slot) => ({ type: 'peek' as const, slot })),
      ];
    case 'charizard-view':
      return [{ type: 'close-peek' }];
    case 'mewtwo-target':
      return opponents.flatMap((id) =>
        pairs.map((p) => ({ type: 'mewtwo-target' as const, seat: id, ...p })),
      );
    case 'mewtwo-choice':
      return [
        decline,
        ...s.peekSlots.map((slot) => ({
          type: 'mewtwo-exchange' as const,
          slot,
        })),
      ];
    case 'arceus-choice':
      return [decline, { type: 'activate-arceus' }];
    case 'greninja-choice':
      return [
        decline,
        ...s.seatOrder.flatMap((id) =>
          pairs.flatMap((p) =>
            [false, true].map((swap) => ({
              type: 'ninja-target' as const,
              seat: id,
              ...p,
              swap,
            })),
          ),
        ),
      ];
    case 'lucario-choice':
      return [
        decline,
        ...(canDrawDeck(s) ? [{ type: 'extra-draw' as const }] : []),
      ];
    case 'row-choice':
      return [
        decline,
        ...opponents.map((id) => ({ type: 'row-target' as const, seat: id })),
      ];
    default:
      return [];
  }
}
function announcement(
  before: State,
  s: State,
  a: Action,
  seat: string,
): PublicAction {
  const privateAction = [
    'peek',
    'close-peek',
    'mewtwo-target',
    'decline-ability',
    'vote-research',
  ].includes(a.type);
  const targets: PublicAction['targets'] = privateAction
    ? []
    : a.type === 'mewtwo-exchange'
      ? [{ seat: before.targetSeat!, slots: [a.slot] }]
      : 'seat' in a
        ? [
            {
              seat: a.seat,
              slots:
                'slot' in a
                  ? [a.slot]
                  : 'a' in a
                    ? [a.a, a.b]
                    : grid.rows[
                        before.rowAbility === 'groudon'
                          ? 2
                          : before.rowAbility === 'kyogre'
                            ? 1
                            : 0
                      ]!,
            },
          ]
        : 'slot' in a
          ? [{ seat, slots: [a.slot] }]
          : 'a' in a
            ? [{ seat, slots: [a.a, a.b] }]
            : a.type === 'activate-arceus'
              ? s.seatOrder.map((id) => ({ seat: id, slots: [...grid.slots] }))
              : [];
  const incoming = before.held ? card(before.held).categoryId : null;
  const ability =
    before.phase === 'charizard-choice' || before.phase === 'charizard-view'
      ? 'charizard'
      : before.phase.startsWith('mewtwo')
        ? 'mewtwo'
        : before.phase.startsWith('zapdos')
          ? 'zapdos'
          : before.phase.startsWith('rocket')
            ? 'team-rocket'
            : before.phase === 'arceus-choice'
              ? 'arceus'
              : before.phase === 'greninja-choice'
                ? 'greninja'
                : before.phase === 'snorlax-choice'
                  ? 'snorlax'
                  : before.phase.startsWith('lucario')
                    ? 'lucario'
                    : before.rowAbility;
  return {
    actor: seat,
    verb:
      a.type === 'ninja-target'
        ? a.swap
          ? 'ninja-swap'
          : 'ninja-cover'
        : a.type,
    cardCategory:
      a.type === 'draw' && s.held ? card(s.held).categoryId : incoming,
    ability,
    ...(a.type === 'draw' ? { source: a.source } : {}),
    targets,
  };
}
function apply(input: State, raw: Action, seat: string, context: RuleContext) {
  const a = validateAction(raw);
  if (
    !legalActions(input, seat).some(
      (v) => JSON.stringify(v) === JSON.stringify(a),
    )
  )
    throw new Error('Illegal expansion action');
  const s = structuredClone(input),
    before = s.phase;
  // Do not enrich old snapshots during load: their exact bytes bind checkpoints.
  if (s.usedAbilityIds === undefined) {
    s.usedAbilityIds = [];
    s.pendingAbility = legacyPendingAbility(s);
  }
  let effect: EventEffect | undefined;
  s.step++;
  if (a.type === 'vote-research') {
    s.votesBySeat[seat] = a.taskId;
    if (Object.keys(s.votesBySeat).length === s.seatOrder.length) {
      s.voteCounts = Object.fromEntries(
        s.researchCandidates.map((id) => [
          id,
          Object.values(s.votesBySeat).filter((v) => v === id).length,
        ]),
      );
      const high = Math.max(...Object.values(s.voteCounts)),
        tied = s.researchCandidates.filter((id) => s.voteCounts![id] === high),
        selected =
          tied.length === 1
            ? tied[0]!
            : tied[Math.floor(context.random.next() * tied.length)]!;
      s.activeResearch = [selected];
      s.usedOpeningResearch.push(selected);
      deal(s, context);
      event(s, 'research', `投票结束，本小局任务「${task(selected).name}」。`);
    } else event(s, 'vote', '一位玩家已提交研究投票。');
  } else if (a.type === 'initial-flip') {
    s.boards[seat]![a.slot]!.faceUp = true;
    s.initialDone.push(seat);
    checkHoenn(s, context);
    publishHoenn(s);
    if (s.initialDone.length === s.seatOrder.length) s.phase = 'draw';
  } else if (a.type === 'draw') {
    if (a.source === 'discard') effect = { discardIndex: a.discardIndex };
    s.drawSource = a.source;
    s.coin = null;
    s.held =
      a.source === 'deck'
        ? drawDeck(s, context)
        : s.discard.splice(s.discard.length - 1 - a.discardIndex, 1)[0]!;
    const ability = card(s.held).ability;
    s.phase = 'place';
    if (!s.suppressedAbility && !s.usedAbilityIds.includes(s.held)) {
      if (ability === 'mew') {
        beginAbility(s, s.held, ability);
        s.phase = 'mew-other';
        effect = { ...effect, entrance: ability };
      }
      if (ability === 'mewtwo') {
        beginAbility(s, s.held, ability);
        s.phase = 'mewtwo-target';
      }
      if (ability === 'zapdos') {
        beginAbility(s, s.held, ability);
        s.phase = 'zapdos-direction';
        effect = { ...effect, entrance: ability };
      }
      if (ability === 'team-rocket') {
        beginAbility(s, s.held, ability);
        useAbility(s);
        s.coin = context.random.next() < 0.5 ? 'meowth' : 'pikachu';
        s.phase = s.coin === 'meowth' ? 'rocket-meowth' : 'rocket-pikachu';
        effect = { ...effect, entrance: ability, coin: s.coin };
      }
    }
  } else if (a.type === 'mew-target') {
    useAbility(s);
    s.held = replace(s, a.seat, a.slot);
    checkHoenn(s, context);
    s.phase = 'mew-self';
  } else if (a.type === 'mewtwo-target') {
    useAbility(s);
    effect = { entrance: 'mewtwo' };
    s.targetSeat = a.seat;
    s.peekSlots = [a.a, a.b];
    s.phase = 'mewtwo-choice';
  } else if (a.type === 'mewtwo-exchange') {
    s.held = replace(s, s.targetSeat!, a.slot);
    s.peekSlots = [];
    s.targetSeat = null;
    s.phase = 'mew-self';
    checkHoenn(s, context);
  } else if (a.type === 'pass-direction') {
    s.recipientQueue = orderFrom(
      s.seatOrder,
      s.turnSeat,
      a.direction === 'clockwise' ? 1 : -1,
    ).slice(1);
    s.recipientIndex = 0;
    s.phase = 'zapdos-self';
  } else if (a.type === 'replace') {
    if (before === 'zapdos-self') useAbility(s);
    if (before === 'rocket-pikachu') {
      const order = orderFrom(s.seatOrder, s.turnSeat),
        rocket = s.held!;
      s.discard.unshift(s.boards[seat]![a.slot]!.instanceId);
      s.discard.unshift(rocket);
      for (const id of order.slice(1))
        s.discard.unshift(s.boards[id]![a.slot]!.instanceId);
      s.held = null;
      for (const id of order) {
        s.boards[id]![a.slot] = {
          instanceId: drawDeck(s, context),
          faceUp: true,
        };
      }
      checkHoenn(s, context);
      finish(s, context);
    } else {
      const incoming = s.held!,
        outgoing = replace(s, seat, a.slot);
      checkHoenn(s, context);
      if (before === 'zapdos-self' || before === 'zapdos-receive') {
        s.held = outgoing;
        if (before === 'zapdos-receive') s.recipientIndex++;
        if (s.recipientIndex >= s.recipientQueue.length) {
          s.discard.unshift(outgoing);
          s.held = null;
          finish(s, context);
        } else s.phase = 'zapdos-receive';
      } else {
        s.discard.push(outgoing);
        if (before === 'place') afterPlace(s, incoming, context);
        else finish(s, context);
      }
    }
  } else if (a.type === 'discard-held') {
    s.discard.push(s.held!);
    s.held = null;
    finish(s, context);
  } else if (a.type === 'swap' || a.type === 'reposition') {
    if (a.type === 'swap') {
      useAbility(s);
      effect = { entrance: 'snorlax' };
    }
    const b = s.boards[seat]!;
    [b[a.a], b[a.b]] = [b[a.b]!, b[a.a]!];
    checkHoenn(s, context);
    finish(s, context);
  } else if (a.type === 'peek') {
    useAbility(s);
    effect = { entrance: 'charizard' };
    s.targetSeat = seat;
    s.peekSlots = [a.slot];
    s.phase = 'charizard-view';
  } else if (a.type === 'activate-arceus') {
    useAbility(s);
    effect = { entrance: 'arceus' };
    s.arceusUsed = true;
    for (const id of s.seatOrder) {
      for (const c of s.boards[id]!) c.faceUp = false;
      s.boards[id]![Math.floor(context.random.next() * 9)]!.faceUp = true;
    }
    const source = coveredAbilitySource(input, s);
    if (source) effect.source = source;
    checkHoenn(s, context);
    finish(s, context);
  } else if (a.type === 'ninja-target') {
    useAbility(s);
    effect = { entrance: 'greninja' };
    const b = s.boards[a.seat]!;
    b[a.a]!.faceUp = false;
    b[a.b]!.faceUp = false;
    if (a.swap) [b[a.a], b[a.b]] = [b[a.b]!, b[a.a]!];
    const source = coveredAbilitySource(input, s);
    if (source) effect.source = source;
    checkHoenn(s, context);
    finish(s, context);
  } else if (a.type === 'row-target') {
    useAbility(s);
    effect = { entrance: s.rowAbility! };
    const row =
      grid.rows[
        s.rowAbility === 'groudon' ? 2 : s.rowAbility === 'kyogre' ? 1 : 0
      ]!;
    for (const i of row)
      [s.boards[seat]![i], s.boards[a.seat]![i]] = [
        s.boards[a.seat]![i]!,
        s.boards[seat]![i]!,
      ];
    checkHoenn(s, context);
    finish(s, context);
  } else if (a.type === 'extra-draw') {
    useAbility(s);
    effect = { entrance: 'lucario' };
    s.phase = 'lucario-draw';
    s.suppressedAbility = true;
  } else if (a.type === 'decline-ability' && before === 'mewtwo-choice') {
    s.phase = 'place';
    s.peekSlots = [];
    s.targetSeat = null;
    s.suppressedAbility = true;
  } else if (a.type === 'decline-ability' || a.type === 'close-peek')
    finish(s, context);
  const action = announcement(input, s, a, seat);
  event(
    s,
    a.type === 'draw' ? 'draw' : 'action',
    `S${s.seatOrder.indexOf(seat) + 1}：${actionLabel(a)}。`,
    action,
    effect,
  );
  // Saved visual order follows the action result, then task publication, then settlement.
  // Numbering is finalized atomically; restoring this state never synthesizes events.
  const currentEvents = s.events.filter((e) => e.id > input.eventCounter);
  const actionEvent = currentEvents.pop()!;
  const orderedEvents = [actionEvent, ...currentEvents];
  orderedEvents.forEach((e, i) => {
    e.id = input.eventCounter + i + 1;
  });
  s.events = [
    ...s.events.filter((e) => e.id <= input.eventCounter),
    ...orderedEvents,
  ].slice(-60);
  return {
    state: s,
    decision: {
      label: `${before}之前`,
      roundNumber: s.roundNumber,
      revealedInformation:
        [
          'draw',
          'peek',
          'mewtwo-target',
          'initial-flip',
          'replace',
          'activate-arceus',
        ].includes(a.type) ||
        (a.type === 'vote-research' && s.phase !== 'research-vote'),
    },
    events: s.events
      .filter((e) => e.id > input.eventCounter)
      // The generic feedback protocol only transports this three-field summary.
      // Game-specific effects remain in saved/projected events for the queue.
      .map(({ kind, text, action }) => ({
        kind,
        text,
        ...(action ? { action } : {}),
      })),
  };
}
function actionLabel(a: Action) {
  const labels: Record<Action['type'], string> = {
    'vote-research': '提交研究投票',
    'initial-flip': '翻开初始牌',
    draw: '取牌',
    replace: '换入牌',
    peek: '私看本人一张暗牌',
    'mew-target': '梦幻换入对方',
    'mewtwo-target': '超梦进行精神侦察',
    'mewtwo-exchange': '超梦选定交换',
    swap: '交换本人两格',
    reposition: '本回合调位',
    'ninja-target': '忍蛙盖牌',
    'row-target': '交换指定整行',
    'pass-direction': '选择传牌方向',
    'discard-held': '弃掉所取牌',
    'decline-ability': '放弃可选能力',
    'close-peek': '关闭私看',
    'activate-arceus': '阿尔宙斯盖回全桌并随机一明',
    'extra-draw': '路卡利欧额外取牌',
    'next-round': '下一小局',
  };
  return labels[a.type];
}
export const pokemonExpansion: GameRules<State, Action, View> = {
  manifest: {
    id: 'pokemon-encounters',
    name: '宝可梦奇遇：皮卡丘和朋友们',
    gameVersion: '1.0.0',
    rulesVersion: 'tablemax-cn-expansion-v1',
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 6 },
    assetNamespace: 'pokemon-encounters',
    decisionTimer: false,
  },
  initialize(context) {
    if (
      context.seats.length < 2 ||
      context.seats.length > 6 ||
      new Set(context.seats).size !== context.seats.length
    )
      throw new Error('Invalid expansion seats');
    return round(
      context,
      context.seats[Math.floor(context.random.next() * context.seats.length)]!,
      Object.fromEntries(context.seats.map((id) => [id, 0])),
      1,
    );
  },
  validateState,
  validateAction,
  legalActions,
  decisions(s) {
    if (['research-vote', 'initial-flip'].includes(s.phase))
      return s.seatOrder
        .filter((id) =>
          s.phase === 'research-vote'
            ? s.votesBySeat[id] === undefined
            : !s.initialDone.includes(id),
        )
        .map((id) => ({
          id: decisionId(s, id),
          seatId: id,
          concurrencyGroup: `r${s.roundNumber}-${s.phase}`,
        }));
    return ['round-result', 'match-result'].includes(s.phase)
      ? []
      : [{ id: decisionId(s, actor(s)), seatId: actor(s) }];
  },
  ended: (s) => s.phase === 'match-result',
  lifecycleActions: (s) =>
    s.phase === 'round-result' ? [{ type: 'next-round' }] : [],
  applyLifecycle(s, raw, context) {
    const a = validateAction(raw);
    if (s.phase !== 'round-result' || a.type !== 'next-round')
      throw new Error('Invalid expansion lifecycle');
    const winners = s.roundResult!.winners,
      next = round(
        context,
        winners[Math.floor(context.random.next() * winners.length)]!,
        { ...s.winsBySeat },
        s.roundNumber + 1,
        s,
      );
    event(next, 'research', `第${next.roundNumber}小局：投票选择研究任务。`);
    return {
      state: next,
      decision: {
        label: '下一小局研究投票之前',
        roundNumber: next.roundNumber,
        revealedInformation: true,
      },
      events: next.events
        .filter((e) => e.id > s.eventCounter)
        .map(({ kind, text }) => ({ kind, text })),
    };
  },
  apply,
  project,
};
export const rules = pokemonExpansion;
export { phases };
