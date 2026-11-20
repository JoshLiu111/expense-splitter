import type { FullConfig } from "@playwright/test";
import type { RateSnapshot } from "../src/domain";
import { FIXED_EXCHANGE_RATES, servesFixedRates } from "./fixed-rates";

/**
 * Fails the run before any test if the app under test doesn't serve
 * FIXED_EXCHANGE_RATES. Locally Playwright reuses a server already on the
 * port, and one started without E2E=1 would quietly run S2 against real rates.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  const response = await fetch(`${baseURL}/api/rates`);
  const body = response.ok ? ((await response.json()) as RateSnapshot | null) : null;
  if (servesFixedRates(body)) return;
  throw new Error(
    `The server at ${baseURL} doesn't serve FIXED_EXCHANGE_RATES ${JSON.stringify(FIXED_EXCHANGE_RATES)}; ` +
      `/api/rates answered ${response.status} ${JSON.stringify(body)}. ` +
      `It was most likely started without E2E=1 and FIXED_EXCHANGE_RATES, and Playwright reused it. ` +
      `Stop the server on that port so Playwright starts its own, or start it with both set.`,
  );
}
