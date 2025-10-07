import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**/*'],
    // Run integration tests sequentially to avoid D1 database locks
    // Unit tests can run in parallel since they don't use D1
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.ts',
        '**/*.d.ts',
        'tests/e2e/**',
      ],
    },
  },
});
