/* eslint-disable react-refresh/only-export-components -- Small presentation helpers are shared with the game components. */
import type { CSSProperties } from 'react';
import harbor from '../../../assets/games/manila/harbor-v1.webp';
import boat from '../../../assets/games/manila/boat-v1.webp';
import cover from '../../../assets/games/manila/cover-v1.webp';

// Static imports bind the three original images to this release's media closure.
const assets = {
  'harbor-v1.webp': harbor,
  'boat-v1.webp': boat,
  'cover-v1.webp': cover,
};
export const manilaAsset = (name: keyof typeof assets): string => assets[name];

export const cargoStyle = (color: string): CSSProperties =>
  ({ '--cargo-color': color }) as CSSProperties;

export function Worker({
  number,
  color,
  label,
}: {
  number: number;
  color: string;
  label: string;
}) {
  return (
    <span className="mn-worker" style={cargoStyle(color)} title={label}>
      <span aria-hidden="true" className="mn-worker-head" />
      <b>{number}</b>
      <span className="mn-sr-only">{label}</span>
    </span>
  );
}

export function Die({ value, label }: { value: number; label: string }) {
  return (
    <span className="mn-die" aria-label={`${label}：${value}点`}>
      <b>{value}</b>
      <span aria-hidden="true" className={`mn-pips mn-pips--${value}`}>
        {Array.from({ length: 7 }, (_, index) => (
          <i key={index} />
        ))}
      </span>
    </span>
  );
}
