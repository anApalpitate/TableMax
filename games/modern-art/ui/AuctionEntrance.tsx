import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RoomFeedback } from '../../../packages/protocol/src';
import type { AuctionKind, ModernArtView } from './view';
import {
  ModernArtSavedFeedback,
  modernArtFeedbackKey,
} from './presentation-state';
import { AuctionMark } from './painting-display';
import { auctionNames } from './public/labels';

const themes: Record<AuctionKind, { color: string; line: string }> = {
  open: { color: '#dc782c', line: '自由加价，一锤定音' },
  once: { color: '#3094c4', line: '顺时针出价，每人一次机会' },
  sealed: { color: '#9361c5', line: '秘密落笔，同时揭标' },
  fixed: { color: '#cf9e32', line: '卖家定价，先买先得' },
  double: { color: '#33826d', line: '同一画家，两幅联拍' },
};

/** Presentation follows newly committed public actions, never snapshots. */
export function AuctionEntrance({
  feedback,
  game,
  disabled,
}: {
  feedback: RoomFeedback | null;
  game: ModernArtView | null;
  disabled: boolean | undefined;
}) {
  const seen = useRef(new ModernArtSavedFeedback(feedback));
  const [entrance, setEntrance] = useState<{
    key: string;
    kind: AuctionKind;
  } | null>(null);
  useEffect(() => {
    if (!feedback) {
      const frame = window.requestAnimationFrame(() => setEntrance(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const fresh = seen.current.accept(feedback);
    if (disabled) {
      const frame = window.requestAnimationFrame(() => setEntrance(null));
      return () => window.cancelAnimationFrame(frame);
    }
    if (!fresh) return;
    const latest = game?.latest;
    const kind =
      latest?.verb === 'offer'
        ? latest.cards[0]?.auctionKind
        : latest?.verb === 'double-add'
          ? game?.auction?.kind
          : null;
    if (!kind || (game?.phase !== 'auction' && game?.phase !== 'double'))
      return;
    const frame = window.requestAnimationFrame(() =>
      setEntrance({ key: modernArtFeedbackKey(feedback), kind }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [feedback, game, disabled]);
  useEffect(() => {
    if (!entrance) return;
    const timer = window.setTimeout(
      () => setEntrance(null),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 450
        : 1600,
    );
    return () => window.clearTimeout(timer);
  }, [entrance]);
  if (!entrance || disabled) return null;
  const theme = themes[entrance.kind];
  return (
    <div
      key={entrance.key}
      className={`ma-entrance ma-entrance--${entrance.kind}`}
      data-auction-entrance={entrance.kind}
      aria-hidden="true"
      style={{ '--ma-entrance-color': theme.color } as CSSProperties}
    >
      <div className="ma-entrance__rays" />
      <div className="ma-entrance__seal">
        <AuctionMark kind={entrance.kind} />
      </div>
      <div className="ma-entrance__banner">
        <span>拍卖开场</span>
        <strong>{auctionNames[entrance.kind]}</strong>
        <p>{theme.line}</p>
      </div>
      <div className="ma-entrance__sweep" />
    </div>
  );
}
