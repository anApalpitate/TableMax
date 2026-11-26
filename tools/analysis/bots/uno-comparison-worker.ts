import {
  createUnoComparisonEvaluator,
  type UnoComparisonInputs,
  type UnoComparisonMatch,
} from './uno-comparison-match';

const request = JSON.parse(process.argv[2] ?? 'null') as {
  input: UnoComparisonInputs;
  match: UnoComparisonMatch;
} | null;
if (!request?.match || !request.input)
  throw new Error('Expected an internal UNO comparison match assignment');
try {
  console.log(
    JSON.stringify(
      await createUnoComparisonEvaluator(request.input)(request.match),
    ),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      arm: request.match.arm,
      seat: request.match.seat,
      outcome: 'failed',
      won: null,
      error:
        error instanceof Error ? error.message : 'Unknown UNO comparison error',
    }),
  );
}
