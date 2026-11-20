/** The exchange rates the app uses in S2: units per one US dollar. */
export const FIXED_EXCHANGE_RATES = { JPY: 150, EUR: 0.925 };

/** Whether a `/api/rates` response body holds exactly FIXED_EXCHANGE_RATES. */
export function servesFixedRates(body: unknown): boolean {
  const perUsd = (body as { perUsd?: Record<string, unknown> } | null)?.perUsd;
  return Object.entries(FIXED_EXCHANGE_RATES).every(([code, rate]) => perUsd?.[code] === rate);
}
