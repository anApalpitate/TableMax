import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'apps/**/*.test.ts',
      'packages/**/*.test.ts',
      'games/**/*.test.ts',
    ],
    environment: 'node',
    // Seeded full-game checks are CPU-heavy. Bound file concurrency so local
    // Socket/SQLite tests retain their normal timeouts on Windows.
    maxWorkers: 4,
  },
});
