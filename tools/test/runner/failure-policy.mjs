/** Shared execution budget; explicit values override the environment and default. */
export const DEFAULT_FAILURE_LIMIT = 5;

export function failureLimit(
  value = process.env.TABLEMAX_TEST_MAX_FAILURES ?? DEFAULT_FAILURE_LIMIT,
) {
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error(
      'TABLEMAX_TEST_MAX_FAILURES must be an integer from 1 to 1000',
    );
  return limit;
}
