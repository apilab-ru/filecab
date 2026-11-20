import { defineConfig, devices } from '@playwright/test';

// Live page rule checks. They load real sites, so they run only on request: `pnpm test:page-rules`.
export default defineConfig({
  testDir: './tests/page-rules',
  timeout: 60_000,
  workers: 1,
  // Real sites are sometimes slow. One retry separates a slow load from a broken rule.
  retries: 1,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'live', testMatch: '*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    // One-time manual sign-in for the pages that need it: `pnpm test:page-rules:sign-in`.
    { name: 'sign-in', testMatch: 'sign-in.ts' },
  ],
});
