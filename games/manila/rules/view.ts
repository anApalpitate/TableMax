/** Safe, JSON-only public/player contract. No authoritative secrets. */
export type CargoId = 'nutmeg' | 'silk' | 'ginseng' | 'jade';
export type Phase =
  | 'auction'
  | 'share'
  | 'setup'
  | 'place'
  | 'board'
  | 'pilot-small'
  | 'pilot-large'
  | 'plunder'
  | 'financing'
  | 'round-result'
  | 'ended';
export type Action =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'buy-share'; cargo: CargoId }
  | { type: 'skip-share' }
  | { type: 'setup'; cargos: CargoId[]; positions: number[] }
  | { type: 'place'; space: string }
  | { type: 'board'; cargo: CargoId | null }
  | { type: 'pilot'; moves: { cargo: CargoId; delta: number }[] }
  | { type: 'plunder'; cargo: CargoId; destination: 'port' | 'shipyard' }
  | { type: 'mortgage' | 'repay'; shareId: string }
  | { type: 'next-voyage' };
export type ShareView = {
  id: string;
  cargo: CargoId;
  mortgaged: boolean;
  revealed: boolean;
};
export type BoatView = {
  cargo: CargoId;
  position: number;
  destination: 'sea' | 'port' | 'shipyard';
  destinationIndex: number | null;
  crew: string[];
  plundered: boolean;
};
export type SpaceView = {
  id: string;
  kind: 'cargo' | 'port' | 'shipyard' | 'pirate' | 'pilot' | 'insurance';
  cargo: CargoId | null;
  index: number;
  cost: number;
  payout: number | null;
  occupant: string | null;
};
export type VoyageResult = {
  voyage: number;
  income: Record<string, number>;
  port: CargoId[];
  shipyard: CargoId[];
  plundered: CargoId[];
  dice: { movement: number; values: Record<string, number> }[];
};
export type ManilaView = {
  gameId: 'manila';
  voyage: number;
  phase: Phase;
  seatOrder: string[];
  turnSeat: string | null;
  harborMaster: string;
  placementRound: number;
  movement: number;
  market: Record<CargoId, number>;
  stock: Record<CargoId, number>;
  cargos: { id: CargoId; name: string; payout: number; costs: number[] }[];
  boats: BoatView[];
  spaces: SpaceView[];
  auction: { bid: number; highBidder: string | null; passed: string[] };
  payment: {
    seatId: string;
    amount: number;
    reason: 'auction' | 'share' | 'place' | 'insurance';
  } | null;
  players: Record<
    string,
    {
      cash: number;
      shareCount: number;
      mortgageCount: number;
      revealedShares: ShareView[];
      availableWorkers: number;
      passed: boolean;
    }
  >;
  self: {
    seatId: string;
    cash: number;
    shares: ShareView[];
    availableCredit: number;
  } | null;
  latest: string;
  dice: { movement: number; values: Record<string, number> }[];
  result: VoyageResult | null;
  scores: Record<string, number> | null;
  winners: string[];
};
