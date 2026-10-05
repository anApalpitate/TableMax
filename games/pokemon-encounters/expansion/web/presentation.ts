import type { PublicAction } from '@tablemax/game-sdk';
import { soundRecipe, type SoundCueRecipe } from '../../ui/presentation-state';
import { SOUND_MAX_LATE_MS } from '../../ui/sound-timing';
type VisibleAction = Omit<PublicAction, 'source'> & {
  source?: 'deck' | 'discard' | undefined;
};

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

/** Adapt public metadata, never pass a nine-cell view into original rules. */
export function expansionSoundRecipe(
  kind: string,
  action: VisibleAction | undefined,
  game: { coin: 'meowth' | 'pikachu' | null; matchWinners: string[] },
  reducedMotion: boolean,
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
  return soundRecipe(mechanicalKind, normalized, null, { reducedMotion });
}
