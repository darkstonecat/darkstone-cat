import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Load local Supabase env vars — must override .env.local (production keys)
dotenv.config({ path: '.env.test.local', override: true })

const E2E_PORT = 3100

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 1,
  fullyParallel: true,
  workers: process.env.CI ? undefined : 4,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'html',
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    locale: 'ca',
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: /global-teardown\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: [/smoke\.spec\.ts/, /global-setup\.ts/, /global-teardown\.ts/],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
      testMatch: [
        /navigation\.spec\.ts/,
        /home\.spec\.ts/,
      ],
    },
  ],
  webServer: {
    command: `npx next dev --port ${E2E_PORT}`,
    port: E2E_PORT,
    reuseExistingServer: !process.env.CI,
    env: {
      // Separate build dir to avoid .next/dev/lock conflicts with `npm run dev`
      NEXT_DIST_DIR: '.next-e2e',
      // Pass test env vars to the Next.js dev server.
      // Next.js won't override vars already present in process.env.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
      SMTP_USER: process.env.SMTP_USER!,
      SMTP_PASSWORD: process.env.SMTP_PASSWORD!,
    },
  },
})
