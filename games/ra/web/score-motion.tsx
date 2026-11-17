import { trackPlaybackVolume } from '@tablemax/web-host';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { claimAudioEvent } from '@tablemax/web-host';
import { raSound } from './feedback';
import {
  publicCategoryPoints,
  scoreBeatMs,
  type ScoreStep,
  type SettlementTable,
} from './settlement';
import './score-motion.css';

export function RaScoreNumber({
  points,
  category,
  floor = 0,
}: {
  points: number;
  category: ScoreStep;
  floor?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const label = ref.current!;
    const card = label.parentElement!;
    const holdings = card.querySelector('.ra-seat-holdings');
    function position() {
      const bounds = card.getBoundingClientRect();
      if (category === 'total') {
        const anchor =
          card
            .querySelector('.ra-rank strong, .ra-running-score')
            ?.getBoundingClientRect() ?? bounds;
        label.style.left = `${Math.max(37, Math.min(bounds.width - 37, anchor.left - bounds.left + anchor.width / 2))}px`;
        label.style.top = `${anchor.top - bounds.top + anchor.height / 2}px`;
        return;
      }
      const clip = holdings?.getBoundingClientRect();
      const active = [...card.querySelectorAll('[data-ra-score-hit]')]
        .map((item) => item.getBoundingClientRect())
        .filter(
          (rect) =>
            category === 'disks' ||
            !clip ||
            (rect.bottom > clip.top && rect.top < clip.bottom),
        );
      if (category === 'disks' && active.length) {
        const right = Math.max(...active.map((rect) => rect.right));
        const top = Math.min(...active.map((rect) => rect.top));
        const bottom = Math.max(...active.map((rect) => rect.bottom));
        label.style.left = `${Math.min(bounds.width - 31, right - bounds.left + 32)}px`;
        label.style.top = `${(top + bottom) / 2 - bounds.top}px`;
        return;
      }
      const band = card
        .querySelector(
          `[data-ra-holding-band="${['civilization', 'river', 'god', 'gold'].includes(category) ? 'temporary' : 'persistent'}"]`,
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
      data-total={category === 'total' || undefined}
      data-disks={category === 'disks' || undefined}
      data-tone={points > 0 ? 'positive' : points < 0 ? 'negative' : 'zero'}
      ref={ref}
    >
      {category === 'total'
        ? points
        : points > 0
          ? '+' + points
          : points < 0
            ? '−' + Math.abs(points)
            : '0'}
      {floor > 0 && <small>下限修正 +{floor}</small>}
    </span>
  );
}

export function RaScoreSound({
  table,
  category,
  enabled,
}: {
  table: SettlementTable;
  category: ScoreStep;
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
    const untrackVolume = trackPlaybackVolume(element);
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void Promise.resolve(claimAudioEvent(eventKey))
        .then((claimed) => {
          if (claimed && !cancelled) void element.play().catch(() => {});
        })
        .catch(() => {});
    }, scoreBeatMs);
    return () => {
      untrackVolume();
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
}
