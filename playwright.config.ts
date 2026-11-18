import { defineConfig, devices } from "@playwright/test";
import { EMAIL_OUTBOX_DIR } from "./e2e/outbox";
import { FIXED_EXCHANGE_RATES } from "./e2e/fixed-rates";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
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
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      EMAIL_OUTBOX_DIR,
      // Lets FIXED_EXCHANGE_RATES take effect; the app ignores it otherwise.
      E2E: "1",
      // S2 runs against fixed rates, never the real currency API.
      FIXED_EXCHANGE_RATES: JSON.stringify(FIXED_EXCHANGE_RATES),
    },
  },
});
