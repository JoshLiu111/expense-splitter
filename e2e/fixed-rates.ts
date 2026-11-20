import type { RateSnapshot } from "../src/domain";

/** The exchange rates the app uses in S2: units per one US dollar. */
export const FIXED_EXCHANGE_RATES = { JPY: 150, EUR: 0.925 };

/** Whether a `/api/rates` response body holds exactly FIXED_EXCHANGE_RATES. */
export function servesFixedRates(body: RateSnapshot | null): boolean {
  return Object.entries(FIXED_EXCHANGE_RATES).every(
    ([code, rate]) => body?.perUsd[code as keyof typeof FIXED_EXCHANGE_RATES] === rate,
  );
}
