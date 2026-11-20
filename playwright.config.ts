import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { EMAIL_OUTBOX_DIR } from "./e2e/outbox";
import { FIXED_EXCHANGE_RATES } from "./e2e/fixed-rates";

const PORT = 3100;

// e2e writes Users and Groups, so it gets its own database: never the
// DATABASE_URL that `npm run dev` uses. Read from .env.local locally, and
// from the workflow's env in CI.
loadEnvConfig(process.cwd());
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL;
if (!E2E_DATABASE_URL) {
  throw new Error("Set E2E_DATABASE_URL (see .env.example): e2e never runs against DATABASE_URL.");
}

export default defineConfig({
  testDir: "./e2e",
  // e2e/*.test.ts are vitest unit tests of the e2e helpers.
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      // The environment wins over .env.local, so the app under test uses it.
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      EMAIL_OUTBOX_DIR,
      // Lets FIXED_EXCHANGE_RATES take effect; the app ignores it otherwise.
      E2E: "1",
      // S2 runs against fixed rates, never the real currency API.
      FIXED_EXCHANGE_RATES: JSON.stringify(FIXED_EXCHANGE_RATES),
    },
  },
});
