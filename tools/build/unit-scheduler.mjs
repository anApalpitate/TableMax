export function parseBuildJobs(args) {
  const options = args.filter((arg) => arg.startsWith('--jobs'));
  if (!options.length) return 1;
  if (options.length !== 1 || !/^--jobs=(1|2|4)$/.test(options[0]))
    throw new Error(
      '--jobs must be exactly one of --jobs=1, --jobs=2, --jobs=4',
    );
  return Number(options[0].slice(7));
}

/** Desktop preparation is shared; finish it before the independent bounded pool. */
export async function runUnitPool(
  units,
  { jobs = 1, run, onResult = () => {} },
) {
  if (![1, 2, 4].includes(jobs)) throw new Error('Invalid build concurrency');
  if (new Set(units.map((unit) => unit.id)).size !== units.length)
    throw new Error('Duplicate build unit');
  const results = new Array(units.length);
  const exclusive = (unit) => ['runtime', 'native'].includes(unit.kind);
  const independent = [];
  const execute = async (index) => {
    results[index] = await run(units[index]);
    onResult(results[index]);
  };
  for (let index = 0; index < units.length; index += 1) {
    if (exclusive(units[index])) await execute(index);
    else independent.push(index);
  }
  let next = 0,
    failure;
  const workers = Array.from(
    { length: Math.min(jobs, independent.length) },
    async () => {
      while (!failure && next < independent.length) {
        const index = independent[next++];
        try {
          await execute(index);
        } catch (error) {
          failure ??= error;
        }
      }
    },
  );
  // Drain in-flight writers before exposing failure to the freeze/assembly caller.
  await Promise.all(workers);
  if (failure) throw failure;
  return results;
}
