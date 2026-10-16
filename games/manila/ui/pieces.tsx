/* eslint-disable react-refresh/only-export-components -- Small presentation helpers are shared with the game components. */
import type { CSSProperties } from 'react';
import harbor from '../../../assets/games/manila/harbor-v1.webp';
import boat from '../../../assets/games/manila/boat-v1.webp';
import cover from '../../../assets/games/manila/cover-v1.webp';
import portraitHarbor from '../../../assets/games/manila/harbor-portrait-v2.webp';
import portraitBoat from '../../../assets/games/manila/boat-portrait-v2.webp';
import nutmeg from '../../../assets/games/manila/cargo-nutmeg-v2.webp';
import silk from '../../../assets/games/manila/cargo-silk-v2.webp';
import ginseng from '../../../assets/games/manila/cargo-ginseng-v2.webp';
import jade from '../../../assets/games/manila/cargo-jade-v2.webp';
import insurance from '../../../assets/games/manila/site-insurance-v2.webp';
import port from '../../../assets/games/manila/site-port-v2.webp';
import shipyard from '../../../assets/games/manila/site-shipyard-v2.webp';
import pirate from '../../../assets/games/manila/site-pirate-v2.webp';
import pilot from '../../../assets/games/manila/site-pilot-v2.webp';
import type { CargoId, SpaceView } from '../rules/view';

// Static imports bind original and portrait artwork to the release's media closure.
const assets = {
  'harbor-v1.webp': harbor,
  'boat-v1.webp': boat,
  'cover-v1.webp': cover,
  'harbor-portrait-v2.webp': portraitHarbor,
  'boat-portrait-v2.webp': portraitBoat,
  'cargo-nutmeg-v2.webp': nutmeg,
  'cargo-silk-v2.webp': silk,
  'cargo-ginseng-v2.webp': ginseng,
  'cargo-jade-v2.webp': jade,
  'site-insurance-v2.webp': insurance,
  'site-port-v2.webp': port,
  'site-shipyard-v2.webp': shipyard,
  'site-pirate-v2.webp': pirate,
  'site-pilot-v2.webp': pilot,
};
export const manilaAsset = (name: keyof typeof assets): string => assets[name];

export const cargoStyle = (color: string): CSSProperties =>
  ({ '--cargo-color': color }) as CSSProperties;

export function CargoArt({ cargo }: { cargo: CargoId }) {
  return (
    <img
      className="mn-cargo-art"
      src={{ nutmeg, silk, ginseng, jade }[cargo]}
      alt=""
      width="52"
      height="52"
      draggable={false}
    />
  );
}
export function SiteArt({ kind }: { kind: SpaceView['kind'] }) {
  if (kind === 'cargo') return null;
  return (
    <img
      className="mn-site-art"
      src={{ insurance, port, shipyard, pirate, pilot }[kind]}
      alt=""
      width="52"
      height="52"
      draggable={false}
    />
  );
}

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
