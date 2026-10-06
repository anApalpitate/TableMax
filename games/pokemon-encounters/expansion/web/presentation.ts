import type { PublicAction } from '@tablemax/game-sdk';
import { soundRecipe, type SoundCueRecipe } from '../../ui/presentation-state';
import { SOUND_MAX_LATE_MS } from '../../ui/sound-timing';
type VisibleAction = Omit<PublicAction, 'source'> & {
  source?: 'deck' | 'discard' | undefined;
};

export type BoardEffects = {
  moves: { from: string; to: string }[];
  cover: string[];
  reveal: string[];
  pulse: string[];
};

/** Public saved facts only. Private choices never enter a board trajectory. */
export function savedBoardEffects(
  action: VisibleAction | undefined,
  boards: Record<string, readonly { slotId: string; faceUp: boolean }[]> = {},
): BoardEffects {
  const result: BoardEffects = { moves: [], cover: [], reveal: [], pulse: [] };
  if (!action) return result;
  const target = action.targets[0];
  const slots = action.targets.flatMap((t) =>
    t.slots.map((slot) => `${t.seat}:${slot}`),
  );
  if (action.verb === 'row-target' && target && action.actor) {
    result.moves = target.slots.map((slot) => ({
      from: `${action.actor}:${slot}`,
      to: `${target.seat}:${slot}`,
    }));
  } else if (
    ['swap', 'reposition', 'ninja-swap'].includes(action.verb) &&
    target?.slots.length === 2
  ) {
    result.moves = [
      {
        from: `${target.seat}:${target.slots[0]}`,
        to: `${target.seat}:${target.slots[1]}`,
      },
    ];
  }
  if (['ninja-cover', 'ninja-swap', 'activate-arceus'].includes(action.verb))
    result.cover = slots;
  if (action.verb === 'activate-arceus')
    result.reveal = Object.values(boards).flatMap((board) =>
      board
        .filter((slot) => slot.faceUp && slots.includes(slot.slotId))
        .map((slot) => slot.slotId),
    );
  if (
    ['replace', 'mew-target', 'mewtwo-exchange', 'initial-flip'].includes(
      action.verb,
    )
  )
    result.pulse = slots;
  return result;
}

/** Enter only when a committed action actually starts the ability. */
export function startedAbility(
  action: VisibleAction | undefined,
): string | null {
  if (!action) return null;
  const starts: Record<string, string> = {
    'mew-target': 'mew',
    'mewtwo-exchange': 'mewtwo',
    'activate-arceus': 'arceus',
    'ninja-cover': 'greninja',
    'ninja-swap': 'greninja',
    'pass-direction': 'zapdos',
    peek: 'charizard',
    swap: 'snorlax',
    'extra-draw': 'lucario',
  };
  if (action.verb === 'row-target') return action.ability;
  if (action.verb === 'draw' && action.cardCategory === 'special-team-rocket')
    return 'team-rocket';
  return starts[action.verb] ?? null;
}

/** Copies react to their committed public placement, not to a guessed hidden face. */
export function presentationCreature(
  action: VisibleAction | undefined,
): string | null {
  if (action?.cardCategory === 'special-ditto')
    return action.verb === 'replace' ? 'ditto' : null;
  if (action?.cardCategory === 'special-zorua')
    return action.verb === 'replace' ? 'zorua' : null;
  return startedAbility(action);
}

export const ordinaryThemes = [
  'togepi',
  'magikarp',
  'piplup',
  'rowlet',
  'psyduck',
  'garchomp',
  'gardevoir',
  'dragonite',
  'metagross',
  'mimikyu',
] as const;
export type OrdinaryTheme = (typeof ordinaryThemes)[number];

/** A new public draw carries the category; private views and later moves do not. */
export function ordinaryTheme(
  action: VisibleAction | undefined,
): OrdinaryTheme | null {
  if (action?.verb !== 'draw') return null;
  return (
    ordinaryThemes.find(
      (theme) => action.cardCategory === `ordinary-${theme}`,
    ) ?? null
  );
}

/** Only presentation waits: the saved authoritative state is already settled. */
export function presentationTiming(
  events: readonly { kind: string; action?: VisibleAction | undefined }[],
  durations: Readonly<Record<string, number>>,
) {
  const acted = [...events]
    .reverse()
    .find((event) => presentationCreature(event.action));
  const creature = presentationCreature(acted?.action);
  const abilityMs = creature ? (durations[creature] ?? 0) : 0;
  const saved = [...events].reverse().find((event) => event.action);
  const board = savedBoardEffects(saved?.action);
  const boardMs =
    board.moves.length +
      board.cover.length +
      board.reveal.length +
      board.pulse.length >
    0
      ? 650
      : 0;
  const researchDelayMs = abilityMs + boardMs;
  const resultDelayMs = events.some((event) => event.kind === 'round-result')
    ? researchDelayMs +
      (events.some((event) => event.kind === 'research') ? 2500 : 0)
    : 0;
  return { creature, abilityMs, boardMs, researchDelayMs, resultDelayMs };
}

/** Original theme sounds are feedback, never labeled as official creature cries. */
export function expansionThemeFor(
  kind: string,
  action: VisibleAction | undefined,
  cue: string,
): string | null {
  if (cue !== 'effect-complete') return null;
  if (kind === 'research') return 'research';
  const ability = startedAbility(action);
  return ability &&
    [
      'mewtwo',
      'arceus',
      'groudon',
      'kyogre',
      'rayquaza',
      'greninja',
      'lucario',
    ].includes(ability)
    ? ability
    : null;
}

/** Adapt public metadata, never pass a nine-cell view into original rules. */
export function expansionSoundRecipe(
  kind: string,
  action: VisibleAction | undefined,
  game: { coin: 'meowth' | 'pikachu' | null; matchWinners: string[] },
  reducedMotion: boolean,
  voices: Readonly<Record<string, string>> = {},
): SoundCueRecipe[] {
  const cue = (sound: SoundCueRecipe['cue'], delayMs = 0): SoundCueRecipe => ({
    cue: sound,
    lane: sound === 'meowth' || sound === 'pikachu' ? 'cry' : 'effect',
    priority: 2,
    delayMs,
    maxLateMs: SOUND_MAX_LATE_MS,
  });
  if (kind === 'round-result')
    return [
      {
        ...cue(game.matchWinners.length ? 'match-result' : 'round-result'),
        priority: 3,
      },
    ];
  if (kind === 'research') return [cue('effect-complete')];
  const ability = startedAbility(action);
  if (ability === 'team-rocket')
    return [
      cue('rocket'),
      ...(game.coin ? [cue(game.coin, reducedMotion ? 0 : 1200)] : []),
    ];
  if (ability && ['mew', 'zapdos', 'charizard', 'snorlax'].includes(ability))
    return [cue(ability as 'mew' | 'zapdos' | 'charizard' | 'snorlax')];
  if (ability) return [cue('effect-complete')];
  // Optional abilities that were skipped receive only their mechanical feedback.
  const normalized: PublicAction | undefined = action
    ? {
        actor: action.actor,
        verb: action.verb,
        ability: null,
        cardCategory: action.cardCategory,
        targets: action.targets,
        ...(action.source ? { source: action.source } : {}),
      }
    : undefined;
  const mechanicalKind =
    action && ['replace', 'discard-held'].includes(action.verb)
      ? 'replace'
      : action?.verb === 'reposition'
        ? 'effect-complete'
        : kind;
  const recipe = soundRecipe(mechanicalKind, normalized, null, {
    reducedMotion,
  });
  const voice = action?.cardCategory ? voices[action.cardCategory] : undefined;
  if (action?.verb === 'draw' && voice)
    recipe.push({
      cue: 'draw',
      source: voice,
      lane: 'cry',
      priority: 2,
      delayMs: 0,
      maxLateMs: SOUND_MAX_LATE_MS,
    });
  return recipe;
}
