import {
  collectCalibrationSeed,
  type CalibrationSeedTask,
} from './uno-calibration-seed';

const task = JSON.parse(
  process.argv[2] ?? 'null',
) as CalibrationSeedTask | null;
if (!task || (task.stage !== 'fit-data' && task.stage !== 'holdout'))
  throw new Error('Expected an internal UNO calibration seed assignment');

console.log(JSON.stringify(await collectCalibrationSeed(task)));
