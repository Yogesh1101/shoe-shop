import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Populates process.env before config/env.ts validates it at import time.
    setupFiles: ['./src/__tests__/helpers/testEnv.ts'],
    // Integration suites share one database, so they must not run concurrently
    // — one file's cleanup would wipe another's fixtures mid-test.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
