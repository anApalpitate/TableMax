import { trackPlaybackVolume } from '@tablemax/web-host';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { claimAudioEvent } from '@tablemax/web-host';
import { raSound } from './feedback';
import {
  publicCategoryPoints,
  scoreBeatMs,
  type ScoreCategory,
  type SettlementTable,
} from './sample-scoring';
import './score-motion.css';

export function RaScoreNumber({
  points,
  category,
}: {
  points: number;
  category: ScoreCategory;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const label = ref.current!;
    const card = label.parentElement!;
    const holdings = card.querySelector('.ra-seat-holdings');
    function position() {
      const bounds = card.getBoundingClientRect();
      const clip = holdings?.getBoundingClientRect();
      const active = [...card.querySelectorAll('[data-ra-score-hit]')]
        .map((item) => item.getBoundingClientRect())
        .filter(
          (rect) => !clip || (rect.bottom > clip.top && rect.top < clip.bottom),
        );
      const band = card
        .querySelector(
          `[data-ra-holding-band="${category === 'civilization' || category === 'river' ? 'temporary' : 'persistent'}"]`,
        )
        ?.getBoundingClientRect();
      const fallback = band ?? clip ?? bounds;
      const left = active.length
        ? Math.min(...active.map((rect) => rect.left))
        : fallback.left;
      const right = active.length
        ? Math.max(...active.map((rect) => rect.right))
        : fallback.right;
      const top = active.length
        ? Math.min(...active.map((rect) => rect.top))
        : band
          ? band.top + 30
          : Math.min(bounds.bottom - 9, (clip?.bottom ?? bounds.top + 88) + 27);
      label.style.left = `${Math.max(30, Math.min(bounds.width - 30, (left + right) / 2 - bounds.left))}px`;
      label.style.top = `${Math.max(15, top - bounds.top - 2)}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(card);
    holdings?.addEventListener('scroll', position, { passive: true });
    return () => {
      observer.disconnect();
      holdings?.removeEventListener('scroll', position);
    };
  }, [category]);
  return (
    <span
      className="ra-score-pop"
      data-tone={points > 0 ? 'positive' : points < 0 ? 'negative' : 'zero'}
      ref={ref}
    >
      {points > 0 ? '+' + points : points < 0 ? '−' + Math.abs(points) : '0'}
    </span>
  );
}

export function RaScoreSound({
  table,
  category,
  enabled,
}: {
  table: SettlementTable;
  category: ScoreCategory;
  enabled: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const values = table.scene.holdings.map(({ seat }) =>
    publicCategoryPoints(table, seat, category),
  );
  const positive = values.some((value) => value !== undefined && value > 0);
  const negative = values.some((value) => value !== undefined && value < 0);
  const cue = positive
    ? negative
      ? 'score-mixed'
      : 'score-gain'
    : negative
      ? 'score-loss'
      : 'score-neutral';
  const source = raSound(cue);
  const eventKey = `${table.key}:score`;
  useEffect(() => {
    const element = audio.current;
    if (!enabled || !element || !source) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void Promise.resolve(claimAudioEvent(eventKey))
        .then((claimed) => {
          if (claimed && !cancelled) void element.play().catch(() => {});
        })
        .catch(() => {});
    }, scoreBeatMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      element.pause();
    };
  }, [enabled, eventKey, source]);
  return (
    <audio
      className="ra-score-audio"
      ref={audio}
      src={enabled ? source : undefined}
      preload="auto"
    />
  );
    const untrackVolume = trackPlaybackVolume(element);
}
      untrackVolume();
