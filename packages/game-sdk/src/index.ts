export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface GameManifest {
  id: string;
  name: string;
  gameVersion: string;
  rulesVersion: string;
  sdkVersion: 1;
  stateVersion: number;
  players: { min: number; max: number };
  assetNamespace: string;
  decisionTimer?: boolean;
}

export type Viewer = { role: 'public' } | { role: 'player'; seatId: string };
// Authorization is platform-owned; a host gets no extra game information.
export interface RuleContext {
  seats: readonly string[];
  random: { next(): number }; // Platform owns the serializable generator state.
}

export interface DecisionBoundary {
  label: string;
  revealedInformation: boolean;
  roundNumber?: number;
}

export interface PendingDecision {
  id: string;
  seatId: string;
  // Only decisions whose actions commute with the other members of this group.
  concurrencyGroup?: string;
}
export type PublicAction = {
  actor: string | null;
  // Each game interprets its own verbs; the platform only transports safe data.
  verb: string;
  cardCategory: string | null;
  ability: string | null;
  source?: 'deck' | 'discard';
  targets: { seat: string; slots: number[] }[];
};
export interface PublicEvent {
  kind: string;
  text: string;
  action?: PublicAction;
}

export interface GameRules<
  State extends JsonValue = JsonValue,
  Action extends JsonValue = JsonValue,
  View extends JsonValue = JsonValue,
> {
  manifest: GameManifest;
  initialize(context: RuleContext): State;
  validateState(input: unknown, seats: readonly string[]): State;
  decisions(state: State): readonly PendingDecision[];
  ended(state: State): boolean;
  validateAction(input: unknown): Action;
  legalActions(state: State, seatId: string): readonly Action[];
  lifecycleActions(state: State): readonly Action[];
  applyLifecycle(
    state: State,
    action: Action,
    context: RuleContext,
  ): { state: State; decision: DecisionBoundary; events?: PublicEvent[] };
  apply(
    state: State,
    action: Action,
    seatId: string,
    context: RuleContext,
  ): {
    state: State;
    decision: DecisionBoundary;
    events?: PublicEvent[];
  };
  project(state: State, viewer: Viewer): View;
}

export type BotDifficulty = 'default' | 'doubao' | 'juewu';

export interface BotStrategy {
  id: string;
  version: string;
  gameId: string;
  rulesVersion: string;
  difficulties?: readonly BotDifficulty[];
  validateMemory(input: unknown): JsonValue;
  decide(input: {
    view: JsonValue;
    actions: readonly JsonValue[];
    decision: PendingDecision;
    memory: JsonValue;
    difficulty?: BotDifficulty;
    random: { next(): number };
    signal: AbortSignal;
  }): Promise<{ action: JsonValue; memory: JsonValue }>;
}
