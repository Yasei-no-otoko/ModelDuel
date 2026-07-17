import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
// Deterministic test-only material. This is not a deployable or production secret.
const PLAYWRIGHT_ONLY_EVALUATION_SECRET =
  "modelduel-playwright-only-evaluation-secret-not-for-production";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: isCI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    env: {
      ...process.env,
      MODELDUEL_EVALUATION_SECRET:
        process.env.MODELDUEL_EVALUATION_SECRET ??
        PLAYWRIGHT_ONLY_EVALUATION_SECRET,
    },
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
