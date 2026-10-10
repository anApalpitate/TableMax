import type { GameHost } from '@tablemax/web-host';
import type { AvalonView } from '../types';

export type AvalonCue =
  | 'pledge'
  | 'team'
  | 'ballot'
  | 'approved'
  | 'rejected'
  | 'quest-success'
  | 'quest-fail'
  | 'assassination'
  | 'good-win'
  | 'evil-win';
export type Feedback = NonNullable<GameHost['feedback']>;

export function avalonFeedbackKey(feedback: Feedback | null) {
  return feedback
    ? `avalon:${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
}

/** Only the newly saved public event determines the performance. */
export function avalonCue(
  feedback: Feedback | null,
  game: AvalonView | null,
): AvalonCue | null {
  if (!feedback?.events.length || !game?.latest) return null;
  if (game.latest.verb === 'assassination') return 'assassination';
  if (game.phase === 'ended')
    return game.winner === 'good' ? 'good-win' : 'evil-win';
  switch (game.latest.verb) {
    case 'acknowledge':
      return 'pledge';
    case 'propose-team':
      return 'team';
    case 'vote-submitted':
    case 'quest-submitted':
      return 'ballot';
    case 'team-approved':
      return 'approved';
    case 'team-rejected':
      return 'rejected';
    case 'quest-success':
      return 'quest-success';
    case 'quest-fail':
      return 'quest-fail';
    case 'assassination':
      return 'assassination';
    default:
      return null;
  }
}

/** Muted, hidden and disabled feedback is consumed too, so it cannot replay. */
export class AvalonSavedFeedback {
  private readonly seen = new Set<string>();
  constructor(initial: Feedback | null) {
    const key = avalonFeedbackKey(initial);
    if (key) this.seen.add(key);
  }
  accept(feedback: Feedback | null) {
    const key = avalonFeedbackKey(feedback);
    if (!key || this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 40) this.seen.delete(this.seen.values().next().value!);
    return true;
  }
}
