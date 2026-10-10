import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { scopedVitestIncludes } from './tools/test/runner/scopes.mjs';
import {
  failureLimit,
  HistoryReporter,
  HistorySequencer,
} from './tools/test/runner/vitest-history.mjs';

export default defineConfig({
  test: {
    include: scopedVitestIncludes(
      process.cwd(),
      process.env.TABLEMAX_TEST_SCOPE,
      process.argv.slice(2),
    ),
    environment: 'node',
    // Ordered execution prevents later work starting after the failure budget.
    maxWorkers: 1,
    fileParallelism: false,
    bail: failureLimit(),
    retry: 0,
    reporters: ['default', new HistoryReporter()],
    runner: fileURLToPath(
      new URL('./tools/test/runner/history-runner.mjs', import.meta.url),
    ),
    sequence: { sequencer: HistorySequencer, concurrent: false },
  },
});
