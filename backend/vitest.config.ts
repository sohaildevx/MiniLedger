import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // config.ts validates NODE_ENV against an enum, so set it before modules load.
    env: { NODE_ENV: 'test' },
    setupFiles: ['tests/setup.ts'],
    // Tests share one database and TRUNCATE between cases, so they must not run
    // in parallel or they would delete each other's rows mid-test.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
