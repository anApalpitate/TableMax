import {
  collectUnoResidualSeed,
  type UnoResidualSeed,
} from './uno-residual-seed';

const task = JSON.parse(process.argv[2] ?? 'null') as UnoResidualSeed | null;
if (
  !task ||
  !Number.isInteger(task.seed) ||
  task.seed < 1 ||
  task.seed > 0xffffffff ||
  (task.salt !== 0xc0000 && task.salt !== 0xe0000)
)
  throw new Error(
    'Expected an internal synthetic UNO residual seed assignment',
  );
console.log(
  JSON.stringify({
    seed: task.seed,
    positions: await collectUnoResidualSeed(task),
  }),
);
