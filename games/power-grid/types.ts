// Game-owned contracts: clients and strategies only receive this safe projection.
export type Resource = 'coal' | 'oil' | 'garbage' | 'uranium';
export type Stock = Record<Resource, number>;
export type Fuel = Resource | 'hybrid' | 'green' | 'fusion';
export type Plant = { id: number; fuel: Fuel; input: number; output: number };
export type OwnedPlant = { id: number; resources: Stock };
export type Phase =
  | 'regions'
  | 'offer'
  | 'auction'
  | 'replace'
  | 'resources'
  | 'building'
  | 'powering'
  | 'ended';
export type Action =
  | { type: 'select-regions'; regions: string[] }
  | { type: 'offer'; plantId: number; amount: number }
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'discard-plant'; plantId: number }
  | { type: 'salvage'; resource: Resource; plantId: number }
  | { type: 'discard-salvage'; resource: Resource }
  | { type: 'buy-resource'; resource: Resource; plantId: number }
  | {
      type: 'transfer';
      resource: Resource;
      fromPlantId: number;
      toPlantId: number;
    }
  | {
      type: 'swap-resources';
      resource: Resource;
      otherResource: Resource;
      fromPlantId: number;
      toPlantId: number;
    }
  | { type: 'build'; cityId: string }
  | { type: 'run'; plantId: number; coal: number }
  | { type: 'finish'; cities?: number };
export type PowerGridLog = {
  id: string;
  actor: string | null;
  verb: string;
  plantId: number | null;
  cityId: string | null;
  resource: Resource | null;
  amount: number | null;
  text: string;
};
export type Auction = {
  plantId: number;
  opener: string;
  highBidder: string;
  amount: number;
  passes: string[];
  actor: string;
};
export type Replacement = {
  buyer: string;
  newPlantId: number;
  oldPlantIds: number[];
  removedPlantId: number | null;
  salvage: Stock;
};
export type CityOption = {
  cityId: string;
  cost: number;
  connectionCost: number;
  buildingCost: number;
  path: string[];
};
export type PlayerView = {
  plants: OwnedPlant[];
  cities: string[];
  cash: number | null;
  capacity: number;
  powered: number;
  ran: number[];
};
export type FinalResult = {
  seatId: string;
  powered: number;
  cash: number;
  cities: number;
  availableResources: Stock;
  burned: Stock;
  operated: { plantId: number; coal: number }[];
};
export type PowerGridView = {
  gameId: 'power-grid';
  round: number;
  step: 1 | 2 | 3;
  phase: Phase;
  actor: string | null;
  seatOrder: string[];
  playerOrder: string[];
  regions: string[];
  regionCount: number;
  plantLimit: number;
  step2Threshold: number;
  endThreshold: number;
  market: number[];
  actualMarket: number[];
  futureMarket: number[];
  deckCount: number;
  step3Pending: boolean;
  resources: Stock;
  resourcePrices: Record<Resource, number | null>;
  supply: Stock;
  replenishment: Stock;
  auction: Auction | null;
  replacement: Replacement | null;
  bought: string[];
  passed: string[];
  players: Record<string, PlayerView>;
  self: { seatId: string; cash: number } | null;
  buildOptions: CityOption[];
  winners: string[];
  finalResults: FinalResult[];
  latest: PowerGridLog | null;
  history: PowerGridLog[];
};
