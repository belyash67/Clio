import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: process.env.CLIO_E2E_URL, channel: process.env.CLIO_E2E_CHANNEL || undefined, actionTimeout: 15000, navigationTimeout: 30000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", testMatch: "desktop.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", testMatch: "mobile.spec.ts", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
