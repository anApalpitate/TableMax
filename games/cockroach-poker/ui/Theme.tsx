/* eslint-disable react-refresh/only-export-components -- Asset resolution belongs with this game-owned theme. */
import { kinds, kindOf, names, type Kind } from '../rules/cards';
// Freeze the runtime derivatives; retain physical originals outside this glob.
const files = import.meta.glob<string>(
  [
    '../../../assets/games/cockroach-poker/flow.svg',
    '../../../assets/games/cockroach-poker/audio/*.wav',
    '../../../assets/games/cockroach-poker/runtime/cards/*.webp',
    '../../../assets/games/cockroach-poker/runtime/back-polished.webp',
    '../../../assets/games/cockroach-poker/runtime/cover-reference.webp',
  ],
  { eager: true, query: '?url', import: 'default' },
);
export function asset(file: string): string {
  const url = files[`../../../assets/games/cockroach-poker/${file}`];
  if (!url) throw new Error(`Unknown cockroach poker asset: ${file}`);
  return url;
}
export function cardAssetFile(card: number): string {
  if (!Number.isInteger(card) || card < 0 || card >= 64)
    throw new Error('Invalid card image ID');
  const sourceKind = kindOf(card) === 'stinkbug' ? 'stink-bug' : kindOf(card);
  return `runtime/cards/${sourceKind}-${(card % 8) + 1}.webp`;
}
export function Critter({ kind }: { kind: Kind }) {
  return (
    <img
      className="cp-critter"
      src={asset(cardAssetFile(kinds.indexOf(kind) * 8))}
      alt={`${names[kind]}物种参考`}
    />
  );
}
export function Back() {
  return (
    <figure className="cp-back-reference">
      <img
        className="cp-back"
        src={asset('runtime/back-polished.webp')}
        alt="经典灰底八动物统一牌背，照片参考的AI精修衍生"
      />
    </figure>
  );
}
export function Card({ card }: { card: number }) {
  return (
    <span className="cp-card">
      <img
        className="cp-face"
        src={asset(cardAssetFile(card))}
        alt={`${names[kindOf(card)]}第${(card % 8) + 1}种实体插画，AI精修衍生`}
      />
    </span>
  );
}
