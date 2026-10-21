/* eslint-disable react-refresh/only-export-components -- Asset resolution belongs with this game-owned theme. */
import { kinds, kindOf, names, type Kind } from '../rules/cards';
// Literal recursive glob freezes physical card originals and local UI media.
const files = import.meta.glob<string>(
  '../../../assets/games/cockroach-poker/**/*.{svg,wav,jpg,png}',
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
  return `cards/${sourceKind}-${(card % 8) + 1}.jpg`;
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
      <svg
        className="cp-back"
        viewBox="225 16 640 704"
        role="img"
        aria-label="经典灰底八动物牌背实拍取景，非平整扫描"
      >
        <defs>
          <clipPath id="cp-back-photo-clip">
            <polygon points="333,23 747,28 860,710 234,709" />
          </clipPath>
        </defs>
        <image
          href={asset('back-photo.jpg')}
          width="1024"
          height="768"
          clipPath="url(#cp-back-photo-clip)"
        />
      </svg>
      <figcaption>经典牌背实拍</figcaption>
    </figure>
  );
}
export function Card({ card }: { card: number }) {
  return (
    <span className="cp-card">
      <img
        className="cp-face"
        src={asset(cardAssetFile(card))}
        alt={`${names[kindOf(card)]}第${(card % 8) + 1}种实体插画`}
      />
      <strong>{names[kindOf(card)]}</strong>
    </span>
  );
}
