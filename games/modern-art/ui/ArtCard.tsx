import type { CSSProperties } from 'react';
import { paintingImage } from '../../../assets/games/modern-art/catalog';
import type { CardFace } from './view';
import { auctionNames, auctionMarks } from './public/labels';

export function ArtCard({
  card,
  artist,
  compact = false,
}: {
  card: CardFace;
  artist?: { name: string; color: string } | undefined;
  compact?: boolean;
}) {
  const image = paintingImage(card.artistId, card.artIndex);
  return (
    <span
      className={`ma-card ${compact ? 'ma-card--compact' : ''}`}
      style={{ '--ma-artist': artist?.color ?? '#a18162' } as CSSProperties}
      data-card-id={card.id}
    >
      <span className="ma-card__head">
        <span>{artist?.name ?? card.artistId}</span>
        <span title={auctionNames[card.auctionKind]}>
          {auctionMarks[card.auctionKind]}
        </span>
      </span>
      <span
        className={`ma-card__art ${image.url ? '' : 'ma-card__art--pending'}`}
        role="img"
        aria-label={card.title}
        style={{
          ...(image.url ? { backgroundImage: `url("${image.url}")` } : {}),
          backgroundPosition: image.position,
        }}
      />
      <span className="ma-card__foot">
        <strong>{card.title}</strong>
        <span>{auctionNames[card.auctionKind]}</span>
      </span>
    </span>
  );
}
