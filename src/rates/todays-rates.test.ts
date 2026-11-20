import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const today = new Date().toISOString().slice(0, 10);

// The daily cache already holds today's rates, so the API is never called.
vi.mock("@/db", () => ({
  db: () => ({
    select: () => ({
      from: () => ({
        where: async () => [
          { base: "USD", quote: "USD", rate: "1", fetchedOn: today },
          { base: "USD", quote: "JPY", rate: "155.2", fetchedOn: today },
        ],
      }),
    }),
  }),
}));

const { todaysRates } = await import("./todays-rates");

describe("todaysRates", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("ignores FIXED_EXCHANGE_RATES outside end-to-end tests and uses today's cached rates", async () => {
    vi.stubEnv("FIXED_EXCHANGE_RATES", JSON.stringify({ JPY: 150 }));
    vi.stubEnv("E2E", "");

    expect(await todaysRates()).toEqual({ perUsd: { USD: 1, JPY: 155.2 }, fetchedOn: today, stale: false });
  });

  it("uses FIXED_EXCHANGE_RATES in end-to-end tests (E2E=1)", async () => {
    vi.stubEnv("FIXED_EXCHANGE_RATES", JSON.stringify({ JPY: 150 }));
    vi.stubEnv("E2E", "1");

    expect(await todaysRates()).toEqual({ perUsd: { USD: 1, JPY: 150 }, fetchedOn: today, stale: false });
  });

  it("reports an ignored FIXED_EXCHANGE_RATES once per process, not on every call", async () => {
    vi.resetModules();
    const fresh = await import("./todays-rates");
    vi.stubEnv("FIXED_EXCHANGE_RATES", JSON.stringify({ JPY: 150 }));
    vi.stubEnv("E2E", "");

    await fresh.todaysRates();
    await fresh.todaysRates();
    await fresh.todaysRates();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("FIXED_EXCHANGE_RATES is ignored"));
  });
});
