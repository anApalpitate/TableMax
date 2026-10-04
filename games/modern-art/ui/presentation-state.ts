import type { RoomFeedback } from '../../../packages/protocol/src';
import type { ModernArtView } from './view';

export type ModernArtSoundCue =
  | 'offer'
  | 'auction-open'
  | 'auction-once'
  | 'auction-sealed'
  | 'auction-fixed'
  | 'double-open'
  | 'double-add'
  | 'bid'
  | 'sealed-submit'
  | 'price-set'
  | 'pass'
  | 'sale'
  | 'round-start'
  | 'round-result'
  | 'match-result'
  | 'error';

/** Reads only the publicly saved verb and painting kind, never a bid amount. */
export function modernArtSoundCue(
  feedback: Pick<RoomFeedback, 'events'> | null,
  game: Pick<ModernArtView, 'phase' | 'latest'> | null,
): ModernArtSoundCue | null {
  const event = feedback?.events.at(-1);
  if (!event || !game) return null;
  if (event.kind === 'round-result' || game.latest?.verb === 'round-result')
    return game.phase === 'ended' ? 'match-result' : 'round-result';
  switch (game.latest?.verb) {
    case 'offer': {
      switch (game.latest.cards[0]?.auctionKind) {
        case 'open':
          return 'auction-open';
        case 'once':
          return 'auction-once';
        case 'sealed':
          return 'auction-sealed';
        case 'fixed':
          return 'auction-fixed';
        case 'double':
          return 'double-open';
        default:
          return 'offer';
      }
    }
    case 'double-add':
      return 'double-add';
    case 'double-decline':
    case 'pass':
      return 'pass';
    case 'sealed-submit':
      return 'sealed-submit';
    case 'set-price':
      return 'price-set';
    case 'bid':
      return 'bid';
    case 'sale':
      return 'sale';
    case 'deal':
      return 'round-start';
    default:
      return null;
  }
}

export function modernArtFeedbackKey(feedback: RoomFeedback | null) {
  return feedback
    ? `${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
}

/** Consume muted/disallowed events too; gaining permission cannot replay them. */
export class ModernArtSavedFeedback {
  private readonly seen = new Set<string>();
  constructor(initial: RoomFeedback | null) {
    const key = modernArtFeedbackKey(initial);
    if (key) this.seen.add(key);
  }
  accept(feedback: RoomFeedback | null) {
    const key = modernArtFeedbackKey(feedback);
    if (!key || this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 16) this.seen.delete(this.seen.values().next().value!);
    return true;
  }
}
