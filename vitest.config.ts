import { defineConfig } from 'vitest/config';
import { scopedVitestIncludes } from './scripts/testing/scopes.mjs';

export default defineConfig({
  test: {
    include: scopedVitestIncludes(
      process.cwd(),
      process.env.TABLEMAX_TEST_SCOPE,
      process.argv.slice(2),
    ),
    environment: 'node',
    // Seeded full-game checks are CPU-heavy. Bound file concurrency so local
    // Socket/SQLite tests retain their normal timeouts on Windows.
    maxWorkers: 4,
  },
});
