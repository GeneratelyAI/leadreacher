import { defineConfig, devices } from "@playwright/test";

const productionRun = process.env.PLAYWRIGHT_PRODUCTION === "true";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3002);
const deployedBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = deployedBaseURL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "tablet-chromium",
      use: { ...devices["iPad Pro 11"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop OnboardingChrome"] },
    },
    {
      name: "desktop-firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "desktop-webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop OnboardingChrome"], channel: "chrome" },
    },
    {
      name: "desktop-edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
  // A configured base URL is an already deployed target (for example staging),
  // so do not start a second local Next.js server in that case.
  webServer: deployedBaseURL
    ? undefined
    : {
        command: productionRun ? `npx next start -p ${port}` : `npx next dev -p ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
