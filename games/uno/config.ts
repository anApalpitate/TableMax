export type UnoSetup = {
  drawPenaltyStacking: boolean;
  catchUnoDelayMs: number;
};

export const unoSetupDefaults: Readonly<UnoSetup> = Object.freeze({
  drawPenaltyStacking: false,
  catchUnoDelayMs: 500,
});
export const legacyUnoSetup: Readonly<UnoSetup> = Object.freeze({
  drawPenaltyStacking: false,
  catchUnoDelayMs: 0,
});

export function validateUnoSetup(input: unknown): UnoSetup {
  const value = input as UnoSetup;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'catchUnoDelayMs,drawPenaltyStacking' ||
    typeof value.drawPenaltyStacking !== 'boolean' ||
    !Number.isSafeInteger(value.catchUnoDelayMs) ||
    value.catchUnoDelayMs < 0 ||
    value.catchUnoDelayMs > 5000 ||
    value.catchUnoDelayMs % 100 !== 0
  )
    throw new Error(
      'UNO 开局设置无效。抓漏延迟须为 0–5000 毫秒、步长 100 毫秒。',
    );
  return {
    drawPenaltyStacking: value.drawPenaltyStacking,
    catchUnoDelayMs: value.catchUnoDelayMs,
  };
}

/** Absence is a saved classic match, never a request to migrate its settings. */
export function unoSetupFor(state: { setup?: UnoSetup }): Readonly<UnoSetup> {
  return state.setup ?? legacyUnoSetup;
}
