import { pathToFileURL } from 'node:url';

/** Shared execution budget; explicit values override the environment and default. */
export const DEFAULT_FAILURE_LIMIT = 10;

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

// Read-only bridge for the PS 5.1 account preflight; importing never runs it.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const arguments_ = process.argv.slice(2);
  const explicit = arguments_[0]?.match(/^--limit=(.+)$/);
  if (arguments_.length > 1 || (arguments_.length === 1 && !explicit))
    throw new Error('Use only an optional --limit=<integer>');
  console.log(
    JSON.stringify({
      schemaVersion: 1,
      failureLimit: failureLimit(explicit?.[1]),
    }),
  );
}
