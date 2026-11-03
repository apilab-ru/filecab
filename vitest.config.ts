import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts', 'apps/**/*.unit.test.ts', 'packages/**/*.unit.test.ts'] } },
      { test: { name: 'contracts', environment: 'node', include: ['tests/contracts/**/*.test.ts', 'packages/**/*.contract.test.ts'] } },
      { test: { name: 'integration', environment: 'node', include: ['tests/integration/**/*.test.ts', 'apps/**/*.integration.test.ts'], testTimeout: 15_000, hookTimeout: 15_000, fileParallelism: false } },
    ],
  },
});
