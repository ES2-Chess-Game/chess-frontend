import { defineConfig, devices } from '@playwright/test'

const url = 'http://127.0.0.1:4181'
const channel = process.env.CHESS_E2E_CHROME ? 'chrome' : undefined

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: url, channel },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4181 --strictPort',
    url,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
})
