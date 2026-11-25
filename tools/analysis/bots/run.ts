import { parseArgs } from 'node:util';
import { BotDifficultySchema } from '../../../packages/protocol/src/index';
import { bot as unoBot, rules as unoRules } from '../../../games/uno';
import {
  bot as pokemonBot,
  rules as pokemonRules,
} from '../../../games/pokemon-encounters';
import { evaluateBotMatch } from './evaluate';

const { values } = parseArgs({
  options: {
    game: { type: 'string' },
    seeds: { type: 'string' },
    levels: { type: 'string' },
    'max-steps': { type: 'string' },
    setup: { type: 'string' },
  },
});
const games = {
  uno: { rules: unoRules, strategy: unoBot },
  'pokemon-encounters': { rules: pokemonRules, strategy: pokemonBot },
};
const selected = values.game as keyof typeof games | undefined;
if (
  !selected ||
  !Object.hasOwn(games, selected) ||
  !values.seeds ||
  !values.levels
)
  throw new Error(
    'Usage: node --import tsx tools/analysis/bots/run.ts --game=uno|pokemon-encounters --seeds=41,42 --levels=default,doubao [--max-steps=15000] [--setup=<JSON>]',
  );
const { rules, strategy } = games[selected];
const seeds = values.seeds.split(',').map(Number);
if (
  new Set(seeds).size !== seeds.length ||
  seeds.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)
)
  throw new Error('Seeds must be unique positive unsigned 32-bit integers');
const seats = values.levels.split(',').map((level, index) => ({
  id: `seat-${index + 1}`,
  strategy,
  difficulty: BotDifficultySchema.parse(level),
}));
const setup = values.setup === undefined ? undefined : JSON.parse(values.setup);
const maxSteps = Number(values['max-steps'] ?? 15000);
console.log(
  JSON.stringify({
    type: 'batch',
    game: rules.manifest,
    strategy: strategy.version,
    seeds,
    levels: seats.map(({ difficulty }) => difficulty),
    setup: setup ?? rules.setup?.defaults,
    maxSteps,
  }),
);
for (const seed of seeds) {
  try {
    const result = await evaluateBotMatch(
      { rules, seats, seed, ...(setup === undefined ? {} : { setup }) },
      { maxSteps },
    );
    console.log(
      JSON.stringify({
        type: 'match',
        seed,
        outcome: result.outcome,
        steps: result.checkpoint.steps,
        inputDigest: result.checkpoint.match,
        traceDigest: result.checkpoint.traceDigest,
        result: result.publicResult,
      }),
    );
    if (result.outcome !== 'ended') process.exitCode = 1;
  } catch (error) {
    console.log(
      JSON.stringify({
        type: 'match',
        seed,
        outcome: 'failed',
        reason:
          error instanceof Error ? error.message : 'Unknown evaluation error',
      }),
    );
    process.exitCode = 1;
  }
}
