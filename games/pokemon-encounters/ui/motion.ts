import { createContext } from 'react';
import type { PokemonView } from '../rules/project';
import type { EffectTheme } from './presentation-state';
export const SavedMotion = createContext<readonly string[]>([]);
export const ActionTargets = createContext<readonly string[]>([]);
export const EffectTargets = createContext<{
  theme?: EffectTheme | undefined;
  slots: readonly string[];
  rocketReturns: readonly string[];
}>({ slots: [], rocketReturns: [] });

export const SAVED_MOTION_MS = 1200;

/** Compare only the viewer's authorized projection. Sync/rollback never calls this for presentation. */
export function savedChanges(
  before: PokemonView,
  after: PokemonView,
): string[] {
  const changes: string[] = [];
  const latest = after.events.at(-1);
  const saved = latest && latest.id !== before.events.at(-1)?.id;
  if (saved) {
    changes.push('@saved');
    for (const target of latest.action?.targets ?? [])
      for (const slot of target.slots) changes.push(`${target.seat}:${slot}`);
  }
  if (before.phase !== after.phase) changes.push('@phase');
  if (
    after.coin &&
    (before.coin !== after.coin ||
      (saved &&
        latest.action?.verb === 'draw' &&
        latest.action.ability === 'special-team-rocket'))
  )
    changes.push('@coin');
  if (JSON.stringify(before.held) !== JSON.stringify(after.held))
    changes.push('@held');
  if (!before.roundResult && after.roundResult) changes.push('@result');
  const abilityPhases = [
    'snorlax-choice',
    'mew-other',
    'mew-self',
    'rocket-meowth',
    'rocket-pikachu',
    'charizard-choice',
    'charizard-view',
    'zapdos-self',
    'zapdos-receive',
  ];
  if (
    before.phase !== after.phase &&
    (abilityPhases.includes(after.phase) ||
      (after.phase !== 'draw' && before.held?.ability && !after.held))
  )
    changes.push('@ability');
  const dealt = before.roundNumber !== after.roundNumber;
  for (const seat of after.seatOrder) {
    after.boards[seat]!.forEach((slot, i) => {
      const old = before.boards[seat]?.[i];
      if (JSON.stringify(slot) !== JSON.stringify(old)) {
        changes.push(slot.slotId);
        if (dealt) changes.push(`deal:${slot.slotId}`);
        else if (old && !old.faceUp && slot.faceUp)
          changes.push(`reveal:${slot.slotId}`);
      }
    });
  }
  return [...new Set(changes)];
}
