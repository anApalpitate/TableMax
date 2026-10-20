import type { Kind } from '../rules/cards';
export type PokerView = {
  seats: string[];
  turn: string;
  serial: number;
  handCounts: Record<string, number>;
  piles: Record<string, number[]>;
  ownHand: number[];
  offer: {
    sender: string;
    target: string;
    claim: Kind;
    seen: string[];
    passing: boolean;
    route: { sender: string; target: string; claim: Kind }[];
    knownCard: number | null;
  } | null;
  last: {
    card: number;
    sender: string;
    target: string;
    claim: Kind;
    belief: boolean;
    collector: string;
  } | null;
  loser: string | null;
  winners: string[];
  threshold: number;
};
