import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { matchesUnoComparisonStage } from './uno-comparison-plan';
import { sizeUnoComparison } from './uno-paired-statistics';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';

const { values } = parseArgs({
  options: {
    development: { type: 'string' },
    looks: { type: 'string', default: '2' },
    'half-width': { type: 'string', default: '0.02' },
  },
});
if (!values.development)
  throw new Error('Pass the result from compare-uno.ts --development');
const looks = Number(values.looks);
if (looks !== 1 && looks !== 2) throw new Error('Use --looks=1 or --looks=2');
const batch = JSON.parse(readFileSync(values.development, 'utf8'));
if (
  batch?.type !== 'uno-abc-development' ||
  !isCurrentUnoPilot(batch.pilot) ||
  batch.failures !== 0 ||
  !Array.isArray(batch.undispatched) ||
  batch.undispatched.length !== 0 ||
  batch.plan?.looks !== 1 ||
  !matchesUnoComparisonStage(batch.plan, 1, batch.blocks)
)
  throw new Error(
    'Use a complete, separate development batch for sample sizing',
  );

console.log(
  JSON.stringify(
    {
      type: 'uno-abc-sample-sizing',
      pilot: unoPilotEvidence,
      developmentPlanDigest: batch.planDigest,
      developmentSeeds: batch.blocks.map(({ seed }: { seed: number }) => seed),
      looks,
      ...sizeUnoComparison(batch.blocks, looks, Number(values['half-width'])),
    },
    null,
    2,
  ),
);
