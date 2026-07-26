import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next dev -p 3002",
    url: "http://localhost:3002",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
