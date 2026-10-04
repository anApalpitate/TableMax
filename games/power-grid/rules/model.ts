import type {
  Auction,
  FinalResult,
  OwnedPlant,
  Phase,
  PowerGridLog,
  Replacement,
  Stock,
} from '../types';

export type PlayerState = {
  cash: number;
  plants: OwnedPlant[];
  cities: string[];
  powered: number;
  ran: number[];
  produced: number;
};
export type State = {
  gameId: 'power-grid';
  rulesVersion: string;
  stateVersion: 1;
  seatOrder: string[];
  playerOrder: string[];
  round: number;
  step: 1 | 2 | 3;
  phase: Phase;
  actor: string | null;
  phaseIndex: number;
  regions: string[];
  deck: number[];
  market: number[];
  removed: number[];
  hiddenRemoved: number[];
  resources: Stock;
  supply: Stock;
  players: Record<string, PlayerState>;
  auction: Auction | null;
  replacement: Replacement | null;
  bought: string[];
  passed: string[];
  auctionOpener: string | null;
  step3Pending: 'auction' | 'building' | 'bureaucracy' | null;
  ending: boolean;
  actionSerial: number;
  logSerial: number;
  history: PowerGridLog[];
  incomeIssued: number;
  spent: number;
  winners: string[];
  finalResults: FinalResult[];
};
