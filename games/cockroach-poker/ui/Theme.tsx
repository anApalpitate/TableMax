/* eslint-disable react-refresh/only-export-components -- Asset resolution belongs with this game-owned theme. */
import { resourceUrl } from '@tablemax/web-host';
import { kindOf, names, type Kind } from '../rules/cards';
export const asset = (file: string) =>
  resourceUrl(`cockroach-poker/${file}`, import.meta.url);
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
