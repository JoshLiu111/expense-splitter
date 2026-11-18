import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { CURRENCY_CODES, type CalendarDate, type CurrencyCode, type RateSnapshot } from "@/domain";

/**
 * Today's exchange rates, from the daily Postgres cache or, once a day, from
 * ExchangeRate-API. The API key is read here, on the server, and never leaves
 * it. If the API can't be reached, the last cached rates come back marked
 * `stale` ("rates may be outdated"); `null` only if none were ever cached.
 *
 * `FIXED_EXCHANGE_RATES` (JSON units per US dollar, e.g. `{"JPY":150}`)
 * replaces the API and cache with fixed rates, for end-to-end tests.
 */
export async function todaysRates(): Promise<RateSnapshot | null> {
  const today: CalendarDate = new Date().toISOString().slice(0, 10);
  const fixed = process.env.FIXED_EXCHANGE_RATES;
  if (fixed) return { perUsd: { USD: 1, ...parsePerUsd(JSON.parse(fixed)) }, fetchedOn: today, stale: false };

  const cached = await readCache().catch((error: unknown) => {
    console.error("Couldn't read the exchange rate cache", error);
    return null;
  });
  if (cached?.fetchedOn === today) return cached;

  refreshing ??= refresh(today).finally(() => {
    refreshing = undefined;
  });
  return (await refreshing) ?? (cached && { ...cached, stale: true });
}

const BASE: CurrencyCode = "USD";
const DEFAULT_API_BASE_URL = "https://v6.exchangerate-api.com/v6";
const TIMEOUT_MS = 4000;
/** After a failed fetch, wait this long before calling the API again. */
const RETRY_AFTER_MS = 10 * 60 * 1000;

/** One refresh at a time per server instance. */
let refreshing: Promise<RateSnapshot | null> | undefined;
let lastFailure = 0;

/** Fetches today's rates and caches them; `null` if that fails. */
async function refresh(today: CalendarDate): Promise<RateSnapshot | null> {
  const key = process.env.CURRENCY_API_KEY;
  if (!key || Date.now() - lastFailure < RETRY_AFTER_MS) return null;
  let perUsd: RateSnapshot["perUsd"];
  try {
    perUsd = await fetchPerUsd(key);
  } catch (error) {
    lastFailure = Date.now();
    console.error("Couldn't refresh exchange rates; using the last cached ones", error);
    return null;
  }
  await writeCache(perUsd, today).catch((error: unknown) =>
    console.error("Couldn't cache today's exchange rates", error),
  );
  return { perUsd, fetchedOn: today, stale: false };
}

async function fetchPerUsd(key: string): Promise<RateSnapshot["perUsd"]> {
  const baseUrl = (process.env.CURRENCY_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/${encodeURIComponent(key)}/latest/${BASE}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // The URL holds the key, so errors never repeat it.
  if (!response.ok) throw new Error(`ExchangeRate-API answered ${response.status}`);
  const body = (await response.json()) as { result?: string; "error-type"?: string; conversion_rates?: unknown };
  if (body.result !== "success") throw new Error(`ExchangeRate-API error: ${body["error-type"] ?? "unknown"}`);
  const perUsd = parsePerUsd(body.conversion_rates);
  if (CURRENCY_CODES.some((code) => perUsd[code] === undefined)) {
    throw new Error("ExchangeRate-API left out a supported currency");
  }
  return perUsd;
}

/** The supported currencies' positive rates from an untrusted object. */
function parsePerUsd(input: unknown): RateSnapshot["perUsd"] {
  const record = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return Object.fromEntries(
    CURRENCY_CODES.flatMap((code) => {
      const rate = Number(record[code]);
      return Number.isFinite(rate) && rate > 0 ? [[code, rate]] : [];
    }),
  );
}

async function readCache(): Promise<RateSnapshot | null> {
  const rows = await db().select().from(exchangeRates).where(eq(exchangeRates.base, BASE));
  if (rows.length === 0) return null;
  return {
    perUsd: parsePerUsd(Object.fromEntries(rows.map((r) => [r.quote, r.rate]))),
    // The oldest row dates the snapshot.
    fetchedOn: rows.map((r) => r.fetchedOn).sort()[0],
    stale: false,
  };
}

async function writeCache(perUsd: RateSnapshot["perUsd"], today: CalendarDate): Promise<void> {
  const rows = Object.entries(perUsd).map(([quote, rate]) => ({
    base: BASE,
    quote,
    rate: String(rate),
    fetchedOn: today,
  }));
  await db().transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(exchangeRates)
        .values(row)
        .onConflictDoUpdate({
          target: [exchangeRates.base, exchangeRates.quote],
          set: { rate: row.rate, fetchedOn: row.fetchedOn },
        });
    }
  });
}
