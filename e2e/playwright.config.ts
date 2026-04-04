import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// .env.local (Supabase URL/KEY) + .env.test (테스트 계정) 로드
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 430, height: 932 },
    actionTimeout: 10_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  webServer: {
    command: 'npx serve dist -l 8081 --single',
    port: 8081,
    cwd: path.resolve(__dirname, '..'),
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],
  outputDir: './test-results',
});
