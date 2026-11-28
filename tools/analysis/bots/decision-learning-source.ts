import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

function gameSources(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const file = `${path}/${entry.name}`;
    if (entry.isDirectory() && entry.name !== 'node_modules')
      return gameSources(file);
    return entry.isFile() &&
      /\.(?:[cm]?ts|mjs|json)$/.test(entry.name) &&
      !/\.test\.[^.]+$/.test(entry.name)
      ? [file]
      : [];
  });
}

export function decisionLearningSource(game: string) {
  const paths = [
    ...gameSources('games/' + game),
    'apps/server/src/game-registry.ts',
    'packages/game-sdk/src/candidate-rating.ts',
    'packages/game-sdk/src/index.ts',
    'packages/platform-core/src/bot-scheduler.ts',
    'packages/platform-core/src/game-actions.ts',
    'packages/platform-core/src/random.ts',
    ...[
      'confirm-decision-learning.ts',
      'decision-learning-pilots.ts',
      'decision-learning-source.ts',
      'decision-learning.ts',
      'evaluate.ts',
      'fit.ts',
      'ridge-cuda.py',
      'train-decision-learning.ts',
      'training-checkpoint.ts',
      'uno-gpu-fit.ts',
    ].map((name) => `tools/analysis/bots/${name}`),
  ].sort();
  const hash = (bytes: string | Buffer) =>
    createHash('sha256').update(bytes).digest('hex');
  return hash(
    JSON.stringify(paths.map((path) => [path, hash(readFileSync(path))])),
  );
}
