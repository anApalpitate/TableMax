import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const sha = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const root = new URL('../../../', import.meta.url);
export function unoResidualSourceDigest() {
  const files = [
    ...['bot', 'data', 'rules'].flatMap((directory) => {
      const path = 'games/uno/' + directory + '/';
      return readdirSync(new URL(path, root), { withFileTypes: true })
        .filter(
          (file) =>
            file.isFile() &&
            file.name.endsWith('.ts') &&
            !file.name.endsWith('.test.ts') &&
            file.name !== 'test-fixtures.ts',
        )
        .map((file) => path + file.name);
    }),
    ...['index', 'config', 'types'].map((name) => 'games/uno/' + name + '.ts'),
    ...[
      'bot-scheduler',
      'game-actions',
      'random',
      'learning-storage',
      'training-lease',
      'bot-learning',
    ].map((name) => 'packages/platform-core/src/' + name + '.ts'),
    ...[
      'train-uno-correction',
      'uno-residual-source',
      'uno-residual-seed',
      'uno-residual-worker',
      'uno-residual-labels',
      'uno-samples',
      'uno-shared-reference',
      'evaluate',
      'fit',
      'uno-pilot',
      'uno-gpu-fit',
      'training-checkpoint',
      'local-uno-corpus',
      'uno-human-review',
      'uno-calibration-provenance',
    ].map((name) => 'tools/analysis/bots/' + name + '.ts'),
    'tools/analysis/bots/ridge-cuda.py',
  ].sort();
  return sha(
    JSON.stringify(
      files.map((path) => [path, sha(readFileSync(new URL(path, root)))]),
    ),
  );
}
