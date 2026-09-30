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
  random: { next(): number }; // Platform owns the serializable generator state.
}

export interface DecisionBoundary {
  label: string;
  revealedInformation: boolean;
}

// A starting contract only. Queueing, deduplication and persistence come later.
export interface GameRules<
  State extends JsonValue,
  Action extends JsonValue,
  View extends JsonValue,
> {
  manifest: GameManifest;
  initialize(context: RuleContext): State;
  validateAction(input: unknown): Action;
  legalActions(state: State, seatId: string): readonly Action[];
  apply(
    state: State,
    action: Action,
    seatId: string,
    context: RuleContext,
  ): {
    state: State;
    decision: DecisionBoundary;
  };
  project(state: State, viewer: Viewer): View;
}
