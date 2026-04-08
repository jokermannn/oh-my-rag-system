import { defineConfig, devices } from '@playwright/test'

const USE_MOCK = !!process.env.CI || !!process.env.USE_MOCK

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'local',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost',
      },
    },
    {
      name: 'ci',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
  ],
  webServer: USE_MOCK
    ? {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
      }
    : undefined,
})
