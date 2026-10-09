export const COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = (typeof COLORS)[number];
export type CardKind =
  'number' | 'skip' | 'reverse' | 'draw-two' | 'wild' | 'wild-draw-four';
export type Card = {
  id: string;
  color: Color | null;
  kind: CardKind;
  value: number | null;
};
export type Action =
  | { type: 'play'; cardId: string; color?: Color; uno?: boolean }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'choose-color'; color: Color }
  | { type: 'accept-draw-four' }
  | { type: 'challenge-draw-four' }
  | { type: 'declare-uno' }
  | { type: 'catch-uno'; target: string }
  | { type: 'next-round' };
export type RoundResult = {
  roundNumber: number;
  winner: string;
  points: number;
  handValues: Record<string, number>;
  scores: Record<string, number>;
};
export type LatestAction = {
  serial: number;
  actor: string | null;
  verb: string;
  text: string;
  card: Card | null;
  color: Color | null;
  targets: string[];
  drawCount: number;
};
export type ChallengeEvidence = {
  challenger: string;
  offender: string;
  previousColor: Color;
  cards: Card[];
  guilty: boolean;
};
export type UnoView = {
  gameId: 'uno';
  rulesVersion: string;
  phase: 'playing' | 'round-result' | 'ended';
  seatOrder: string[];
  roundNumber: number;
  turnNumber: number;
  dealer: string;
  turnSeat: string | null;
  direction: 1 | -1;
  activeColor: Color | null;
  topCard: Card;
  discardCount: number;
  drawCount: number;
  stage: 'turn' | 'drawn' | 'choose-color' | 'draw-four' | 'result';
  players: Record<
    string,
    { handCount: number; score: number; wins: number; uno: boolean }
  >;
  self: {
    seatId: string;
    hand: Card[];
    drawnCardId: string | null;
    challengeEvidence: ChallengeEvidence | null;
  } | null;
  drawFour: {
    offender: string;
    target: string;
    previousColor: Color;
    chosenColor: Color;
  } | null;
  unoWindow: { seatId: string } | null;
  results: RoundResult[];
  winners: string[];
  latest: LatestAction | null;
};
