// Client contracts contain only public information and the viewer's own secrets.
export type ArtistId = 'manuel' | 'sigrid' | 'daniel' | 'ramon' | 'rafael';
export type AuctionKind = 'open' | 'once' | 'sealed' | 'fixed' | 'double';
export type Phase = 'offer' | 'double' | 'auction' | 'round-result' | 'ended';
export type CardFace = {
  id: string;
  artistId: ArtistId;
  title: string;
  auctionKind: AuctionKind;
  artIndex: number;
};
export type Action =
  | { type: 'offer' | 'add-double'; cardId: string }
  | { type: 'bid' | 'sealed-bid' | 'set-price'; amount: number }
  | { type: 'decline-double' | 'pass' | 'buy' | 'next-round' };
export type ArtistNumbers = Record<ArtistId, number>;
export type ModernArtLog = {
  id: string;
  actor: string | null;
  verb: string;
  cards: CardFace[];
  amount: number | null;
  winner: string | null;
  sealedBids: Record<string, number> | null;
  text: string;
};
export type RoundResultView = {
  round: number;
  ranking: ArtistId[];
  counts: ArtistNumbers;
  values: ArtistNumbers;
  income: Record<string, number>;
  paintings: Record<string, CardFace[]>;
  reason: 'fifth-card' | 'exhausted';
};
export type ModernArtView = {
  round: number;
  phase: Phase;
  seatOrder: string[];
  turnSeat: string | null;
  deckCount: number;
  discardCount: number;
  auction: {
    id: string;
    kind: AuctionKind;
    cards: CardFace[];
    seller: string;
    originalSeller: string;
    currentBid: number;
    highBidder: string | null;
    fixedPrice: number | null;
    actingSeats: string[];
    submitted: string[];
    passes: string[];
  } | null;
  artists: {
    id: ArtistId;
    name: string;
    color: string;
    cardCount: number;
    playedCount: number;
    history: number[];
    currentValue: number;
  }[];
  players: Record<
    string,
    {
      handCount: number;
      collection: CardFace[];
      cash: number | null;
    }
  >;
  self: {
    seatId: string;
    hand: CardFace[];
    cash: number;
    sealedBid: number | null;
  } | null;
  roundResult: RoundResultView | null;
  finalCash: Record<string, number> | null;
  winners: string[];
  latest: ModernArtLog | null;
  history: ModernArtLog[];
};
