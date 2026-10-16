import type { GameHost } from '@tablemax/web-host';
import type { ManilaView } from '../rules/view';
import { presentationChanges } from '../shared/presentation';

export function savedChanges(before: unknown, after: unknown): string[] {
  return presentationChanges(before as ManilaView, after as ManilaView);
}
export type Feedback = NonNullable<GameHost['feedback']>;
export const feedbackKey = (feedback: Feedback | null) =>
  feedback
    ? `manila:${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
export class SavedFeedback {
  private readonly seen = new Set<string>();
  constructor(initial: Feedback | null) {
    if (initial) this.seen.add(feedbackKey(initial));
  }
  accept(feedback: Feedback | null) {
    const key = feedbackKey(feedback);
    if (!key || this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 64) this.seen.delete(this.seen.values().next().value!);
    return true;
  }
}
export type ManilaCue =
  | 'wood'
  | 'coin'
  | 'dice'
  | 'water'
  | 'bell'
  | 'dock'
  | 'boarding'
  | 'repair'
  | 'pirate'
  | 'celebration';
export function cueFor(motion: string[]): ManilaCue | null {
  const has = (kind: string) =>
    motion.some(
      (value) =>
        value === `manila:${kind}` || value.startsWith(`manila:${kind}:`),
    );
  if (has('ended')) return 'celebration';
  if (has('plunder')) return 'pirate';
  if (has('result') || has('auction') || has('voyage') || has('setup'))
    return 'bell';
  if (has('sail')) return 'dice';
  if (has('arrive')) return 'dock';
  if (has('repair') || has('insurance-pay')) return 'repair';
  if (has('board')) return 'boarding';
  if (has('pilot')) return 'water';
  if (has('trade') || has('bid') || has('insurance-income')) return 'coin';
  return has('place') ? 'wood' : null;
}
