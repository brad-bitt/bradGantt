import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  // Un seul worker : la suite reste petite et le serveur de dev (next dev, non buildé) compile
  // les routes à la demande — plusieurs workers en parallèle sur un cache froid provoquent une
  // contention de compilation et des flakys ponctuels. Le gain de déterminisme prime ici sur la
  // parallélisation.
  workers: 1,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100/login',
    reuseExistingServer: !process.env.CI,
    env: { E2E_ENABLED: '1' },
  },
})
