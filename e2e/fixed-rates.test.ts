import { describe, expect, it } from "vitest";
import { FIXED_EXCHANGE_RATES, servesFixedRates } from "./fixed-rates";

describe("servesFixedRates", () => {
  it("accepts /api/rates answering with FIXED_EXCHANGE_RATES", () => {
    const body = { perUsd: { USD: 1, ...FIXED_EXCHANGE_RATES }, fetchedOn: "2026-11-19", stale: false };

    expect(servesFixedRates(body)).toBe(true);
  });

  it("rejects real exchange rates", () => {
    const body = { perUsd: { USD: 1, JPY: 155.2, EUR: 0.86 }, fetchedOn: "2026-11-19", stale: false };

    expect(servesFixedRates(body)).toBe(false);
  });

  it("rejects a missing snapshot (no rates ever cached)", () => {
    expect(servesFixedRates(null)).toBe(false);
  });
});
