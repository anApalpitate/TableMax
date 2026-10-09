import type { GameRules, JsonValue } from '@tablemax/game-sdk';

/** Keep validation pure even when a trusted module accidentally mutates input. */
export function allowsGameAction(
  rules: GameRules,
  state: JsonValue,
  action: JsonValue,
  seatId: string,
): boolean {
  try {
    if (rules.isLegalAction)
      return (
        rules.isLegalAction(
          structuredClone(state),
          structuredClone(action),
          seatId,
        ) === true
      );
    return rules
      .legalActions(structuredClone(state), seatId)
      .some(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
      );
  } catch {
    return false;
  }
}
