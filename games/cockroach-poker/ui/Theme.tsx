/* eslint-disable react-refresh/only-export-components -- Asset resolution belongs with this game-owned theme. */
import { kindOf, names, type Kind } from '../rules/cards';
// Literal recursive glob freezes both the root SVGs and audio/*.wav inputs.
const files = import.meta.glob<string>(
  '../../../assets/games/cockroach-poker/**/*.{svg,wav}',
  { eager: true, query: '?url', import: 'default' },
);
export function asset(file: string): string {
  const url = files[`../../../assets/games/cockroach-poker/${file}`];
  if (!url) throw new Error(`Unknown cockroach poker asset: ${file}`);
  return url;
}
export function Critter({ kind }: { kind: Kind }) {
  return (
    <img className="cp-critter" src={asset(`${kind}.svg`)} alt={names[kind]} />
  );
}
export function Card({ card }: { card: number }) {
  return (
    <span className="cp-card">
      <Critter kind={kindOf(card)} />
      <strong>{names[kindOf(card)]}</strong>
    </span>
  );
}
