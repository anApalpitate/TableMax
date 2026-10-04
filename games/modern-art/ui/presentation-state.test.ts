import { describe, expect, it } from 'vitest';
import type { RoomFeedback } from '../../../packages/protocol/src';
import type { AuctionKind, ModernArtLog, ModernArtView } from './view';
import {
  modernArtSoundCue,
  ModernArtSavedFeedback,
} from './presentation-state';

function feedback(revision = 1, kind = 'effect-complete'): RoomFeedback {
  return {
    instanceId: '00000000-0000-4000-8000-000000000001',
    branch: 0,
    revision,
    events: [{ kind, text: '已保存' }],
  };
}
function game(
  verb: string,
  kind: AuctionKind = 'open',
  phase: ModernArtView['phase'] = 'auction',
): Pick<ModernArtView, 'phase' | 'latest'> {
  const latest: ModernArtLog = {
    id: 'saved',
    actor: 'seat-1',
    verb,
    cards: [
      {
        id: 'painting-1',
        artistId: 'manuel',
        title: '画作',
        auctionKind: kind,
        artIndex: 1,
      },
    ],
    amount: null,
    winner: null,
    sealedBids: null,
    text: '已保存',
  };
  return { phase, latest };
}

describe('Modern Art saved public sound mapping', () => {
  it.each([
    ['open', 'auction-open'],
    ['once', 'auction-once'],
    ['sealed', 'auction-sealed'],
    ['fixed', 'auction-fixed'],
    ['double', 'double-open'],
  ] as const)('distinguishes painting offer kind %s', (kind, cue) => {
    expect(modernArtSoundCue(feedback(), game('offer', kind))).toBe(cue);
  });
  it.each(['open', 'once', 'sealed', 'fixed'] as const)(
    'double painting completion announces its actual %s auction method',
    (kind) => {
      const auction = { kind } as NonNullable<ModernArtView['auction']>;
      Object.defineProperties(auction, {
        sealedBids: {
          get: () => {
            throw new Error('Never inspect sealed amounts');
          },
        },
        currentBid: {
          get: () => {
            throw new Error('Amount does not select a sound');
          },
        },
      });
      expect(
        modernArtSoundCue(feedback(), { ...game('double-add'), auction }),
      ).toBe(`auction-${kind}`);
    },
  );
  it('makes a sealed submission identical for every secret amount', () => {
    const projection = game('sealed-submit', 'sealed');
    Object.defineProperties(projection.latest!, {
      amount: {
        get: () => {
          throw new Error('Never read a secret amount');
        },
      },
      sealedBids: {
        get: () => {
          throw new Error('Never read sealed bids');
        },
      },
    });
    expect(modernArtSoundCue(feedback(), projection)).toBe('sealed-submit');
    expect(
      modernArtSoundCue(feedback(), {
        ...projection,
        latest: {
          ...game('sealed-submit').latest!,
          amount: 1000000,
          sealedBids: { 'seat-2': 42 },
        },
      }),
    ).toBe('sealed-submit');
  });
  it('plays only a sale when the same saved action also contains a submission', () => {
    const item = feedback();
    item.events.push({ kind: 'effect-complete', text: '成交' });
    expect(modernArtSoundCue(item, game('sale'))).toBe('sale');
  });
  it('prioritizes a round or final result over its triggering painting', () => {
    expect(modernArtSoundCue(feedback(1, 'round-result'), game('offer'))).toBe(
      'round-result',
    );
    expect(
      modernArtSoundCue(
        feedback(1, 'round-result'),
        game('offer', 'open', 'ended'),
      ),
    ).toBe('match-result');
    expect(
      modernArtSoundCue(
        feedback(),
        game('round-result', 'open', 'round-result'),
      ),
    ).toBe('round-result');
  });
  it('does not turn an unsaved projection or unknown verb into a sound', () => {
    expect(modernArtSoundCue(null, game('bid'))).toBeNull();
    expect(modernArtSoundCue({ events: [] }, game('sale'))).toBeNull();
    expect(modernArtSoundCue(feedback(), null)).toBeNull();
    expect(modernArtSoundCue(feedback(), game('future-unknown'))).toBeNull();
  });
  it.each([
    ['double-add', 'double-add'],
    ['double-decline', 'pass'],
    ['bid', 'bid'],
    ['pass', 'pass'],
    ['set-price', 'price-set'],
    ['deal', 'round-start'],
  ] as const)('uses the public saved verb %s', (verb, cue) => {
    expect(modernArtSoundCue(feedback(), game(verb))).toBe(cue);
  });
});

describe('Modern Art saved event consumption', () => {
  it('skips initial feedback, duplicates, and feedback already consumed while muted', () => {
    const seen = new ModernArtSavedFeedback(feedback());
    expect(seen.accept(feedback())).toBe(false);
    expect(seen.accept(feedback(2))).toBe(true);
    expect(seen.accept(feedback(2))).toBe(false);
    expect(seen.accept(null)).toBe(false);
    expect(seen.accept(feedback(2))).toBe(false);
    expect(seen.accept(feedback(3))).toBe(true);
  });
  it('accepts a newly saved action on the rollback branch without replaying the old branch', () => {
    const before = feedback(5);
    const seen = new ModernArtSavedFeedback(before);
    expect(seen.accept(null)).toBe(false);
    expect(seen.accept(before)).toBe(false);
    expect(seen.accept({ ...feedback(5), branch: 1 })).toBe(true);
    expect(
      seen.accept({
        ...feedback(5),
        instanceId: '00000000-0000-4000-8000-000000000002',
      }),
    ).toBe(true);
  });
});
