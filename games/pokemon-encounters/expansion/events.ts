import { card, category, type Card } from './cards';
import type { RulesProfile } from './config/types';
import type { State } from './state';
import type { ResolvedCardDefinitions } from './scoring';

export const eventKinds = [
  'mega',
  'rain',
  'sandstorm',
  'sun',
  'snow',
  'trick-room',
] as const;
export type EventKind = (typeof eventKinds)[number];
export type Weather = 'rain' | 'sandstorm' | 'sun' | 'snow';
export type CurrentEvent = { kind: EventKind; placeholder: boolean };
export type ScoreEffect = { kind: Weather; delta: number; inherited?: boolean };
export type RandomEvent = {
  markerInstanceId: string | null;
  kind: EventKind | null;
  triggered: boolean;
  protected: boolean;
};
export type BondPlaceholder = {
  id: string;
  name: string;
  seats: string[];
  placeholder: true;
};
export const eventNames: Record<EventKind, string> = {
  mega: 'Mega 事件',
  rain: '雨天',
  sandstorm: '沙暴',
  sun: '晴天',
  snow: '雪天',
  'trick-room': '戏法空间',
};
export const trickRoomPairs = [
  ['ordinary--2', 'ordinary-garchomp'],
  ['ordinary-mimikyu', 'ordinary-dragonite'],
  ['ordinary-togepi', 'ordinary-9'],
  ['ordinary-0', 'ordinary-8'],
  ['ordinary-magikarp', 'ordinary-gardevoir'],
  ['ordinary-1', 'ordinary-7'],
  ['ordinary-piplup', 'ordinary-psyduck'],
  ['ordinary-3', 'ordinary-6'],
  ['ordinary-rowlet', 'ordinary-metagross'],
  ['ordinary-4', 'ordinary-5'],
] as const;
export const trickRoomMap: Readonly<Record<string, string>> =
  Object.fromEntries(
    trickRoomPairs.flatMap(([a, b]) => [
      [a, b],
      [b, a],
    ]),
  );
export function currentEvent(
  s: Pick<State, 'rulesProfile' | 'randomEvent'>,
): CurrentEvent | null {
  if (s.rulesProfile !== 'events-research-v3' || !s.randomEvent?.kind)
    return null;
  return {
    kind: s.randomEvent.kind,
    placeholder: s.randomEvent.kind === 'mega',
  };
}
export function currentWeather(
  s: Pick<State, 'rulesProfile' | 'randomEvent'>,
): Weather | null {
  const kind = currentEvent(s)?.kind;
  return kind === 'rain' ||
    kind === 'sandstorm' ||
    kind === 'sun' ||
    kind === 'snow'
    ? kind
    : null;
}
export function weatherDelta(c: Card, weather: Weather | null): number {
  if (!weather || c.value === null) return 0;
  const has = (...types: string[]) =>
    c.types.some((type) => types.includes(type));
  switch (weather) {
    case 'rain':
      return has('water') ? -2 : has('fire') ? 2 : 0;
    case 'sun':
      return has('fire', 'grass') ? -2 : has('water') ? 2 : 0;
    case 'sandstorm':
      return has('rock', 'ground', 'steel') ? -2 : 1;
    case 'snow':
      return c.value >= 8 ? -2 : c.value <= 3 ? 1 : 0;
  }
}
export function effectiveCard(
  instance: string,
  profile: RulesProfile,
  overrides: Readonly<Record<string, string>> = {},
  weather: Weather | null = null,
  faceUp = true,
): Card {
  const original = card(instance, profile);
  const c = overrides[instance]
    ? category(overrides[instance]!, profile)
    : original;
  const delta = faceUp ? weatherDelta(c, weather) : 0;
  return { ...c, value: c.value === null ? null : c.value + delta };
}
export function resolveCardDefinitions(
  s: State,
  forceFaceUp = false,
): ResolvedCardDefinitions {
  if (s.rulesProfile !== 'events-research-v3') return {};
  const weather = currentWeather(s);
  return Object.fromEntries(
    s.seatOrder.flatMap((seat) =>
      s.boards[seat]!.map((slot) => [
        slot.instanceId,
        effectiveCard(
          slot.instanceId,
          s.rulesProfile!,
          s.cardOverrides,
          weather,
          forceFaceUp || slot.faceUp,
        ),
      ]),
    ),
  );
}
/** Event effects are attached to physical instances, never to a reusable board slot. */
export function applyEventEffect(s: State) {
  if (currentEvent(s)?.kind !== 'trick-room') return;
  for (const seat of s.seatOrder)
    for (const slot of s.boards[seat]!) {
      const original = card(slot.instanceId, 'events-research-v3');
      const replacement = trickRoomMap[original.categoryId];
      if (replacement) s.cardOverrides![slot.instanceId] = replacement;
    }
}
const bonds = [
  {
    id: 'origin-copy',
    name: '起源与复制',
    roles: ['special-mew', 'special-mewtwo'],
  },
  {
    id: 'true-false-pikachu',
    name: '真假皮卡丘',
    roles: ['ordinary--2', 'ordinary-mimikyu'],
  },
  {
    id: 'still-confused',
    name: '今天也没想明白',
    roles: ['ordinary-psyduck', 'ordinary-6'],
  },
  {
    id: 'aura-ninja',
    name: '波导与忍术',
    roles: ['special-lucario', 'special-greninja'],
  },
  {
    id: 'good-sleep',
    name: '一起睡个好觉',
    roles: ['ordinary-0', 'special-snorlax'],
  },
  {
    id: 'kanto-friends',
    name: '关都老伙伴',
    roles: ['ordinary-3', 'ordinary-4', 'special-charizard'],
  },
  {
    id: 'copy-partners',
    name: '幻化搭档',
    roles: ['special-ditto', 'special-zorua'],
  },
] as const;
/** Only already-public combinations are listed. These placeholders have no game effect. */
export function newlyVisibleBonds(s: State): BondPlaceholder[] {
  if (s.rulesProfile !== 'events-research-v3') return [];
  const found: BondPlaceholder[] = [];
  const visible = (seat: string) =>
    s.boards[seat]!.flatMap((slot, index) =>
      slot.faceUp
        ? [
            {
              role: effectiveCard(
                slot.instanceId,
                s.rulesProfile!,
                s.cardOverrides,
              ).categoryId,
              index,
            },
          ]
        : [],
    );
  const all = s.seatOrder.flatMap((seat) =>
    visible(seat).map((v) => ({ ...v, seat })),
  );
  if (
    ['special-groudon', 'special-kyogre', 'special-rayquaza'].every((role) =>
      all.some((v) => v.role === role),
    )
  )
    found.push({
      id: 'hoenn-together',
      name: '丰缘三傻共同登场',
      seats: s.seatOrder.filter((seat) =>
        all.some(
          (v) =>
            v.seat === seat &&
            ['special-groudon', 'special-kyogre', 'special-rayquaza'].includes(
              v.role,
            ),
        ),
      ),
      placeholder: true,
    });
  for (const seat of s.seatOrder) {
    const cards = visible(seat);
    for (const bond of bonds) {
      if (!bond.roles.every((role) => cards.some((v) => v.role === role)))
        continue;
      if (
        bond.id === 'copy-partners' &&
        !cards.some(
          (a) =>
            a.role === 'special-ditto' &&
            cards.some(
              (b) =>
                b.role === 'special-zorua' &&
                Math.abs(Math.floor(a.index / 3) - Math.floor(b.index / 3)) +
                  Math.abs((a.index % 3) - (b.index % 3)) ===
                  1,
            ),
        )
      )
        continue;
      found.push({
        id: `${bond.id}:${seat}`,
        name: bond.name,
        seats: [seat],
        placeholder: true,
      });
    }
  }
  return found.filter(
    (bond) => !s.bondPlaceholders!.some((previous) => previous.id === bond.id),
  );
}
