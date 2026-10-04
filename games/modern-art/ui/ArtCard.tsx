import type { CSSProperties } from 'react';
import { paintingImage } from '../../../assets/games/modern-art/catalog';
import type { CardFace } from './view';
import { auctionNames } from './public/labels';
import { ArtistMark, AuctionMark } from './painting-display';
import { artistPresentation } from './artist-presentation';

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
  const presentation = artistPresentation[card.artistId];
  return (
    <span
      className={`ma-card ${compact ? 'ma-card--compact' : ''}`}
      style={{ '--ma-artist': presentation.color } as CSSProperties}
      data-card-id={card.id}
      data-artist-id={card.artistId}
      data-auction-kind={card.auctionKind}
      aria-label={`${artist?.name ?? card.artistId}，${card.title}，${auctionNames[card.auctionKind]}`}
      title={`${artist?.name ?? card.artistId} / ${card.title} / ${auctionNames[card.auctionKind]}`}
    >
      <span className="ma-card__head">
        <span className="ma-card__artist-mark">
          <ArtistMark artistId={card.artistId} />
        </span>
        <span className="ma-card__artist-name">{presentation.shortName}</span>
        <span className="ma-card__auction-mark">
          <AuctionMark kind={card.auctionKind} />
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
      ></span>
      <span className="ma-card__foot">
        <strong>{card.title}</strong>
        <span>{auctionNames[card.auctionKind]}</span>
      </span>
    </span>
  );
}
