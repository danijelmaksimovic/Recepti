import { defineConfig, devices } from '@playwright/test'

// End-to-end checks for the Design Studio (BLUEPRINT §13, Phase 5).
// Run: npm run e2e  (Chromium desktop + iPhone emulation). Add --project=webkit
// where Playwright's WebKit is installed, as the closest stand-in for Safari.
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5174', trace: 'off' },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'iphone', use: { ...devices['iPhone 15'], defaultBrowserType: 'chromium' } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
})
