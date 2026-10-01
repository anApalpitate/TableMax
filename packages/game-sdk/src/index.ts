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
}

export type Viewer = { role: 'public' } | { role: 'player'; seatId: string };
// Authorization is platform-owned; a host gets no extra game information.
export interface RuleContext {
  seats: readonly string[];
  hostSeat?: string; // Participating host seat, verified by the platform.
  random: { next(): number }; // Platform owns the serializable generator state.
}

export interface DecisionBoundary {
  label: string;
  revealedInformation: boolean;
}

export interface PendingDecision {
  id: string;
  seatId: string;
}
export interface PublicEvent {
  kind: 'draw' | 'replace' | 'effect-complete' | 'round-result';
  text: string;
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

export interface BotStrategy {
  id: string;
  version: string;
  gameId: string;
  rulesVersion: string;
  validateMemory(input: unknown): JsonValue;
  decide(input: {
    view: JsonValue;
    actions: readonly JsonValue[];
    decision: PendingDecision;
    memory: JsonValue;
    random: { next(): number };
    signal: AbortSignal;
  }): Promise<{ action: JsonValue; memory: JsonValue }>;
}
