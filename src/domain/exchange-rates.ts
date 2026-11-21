import type { CalendarDate, CurrencyCode } from "./types";

/**
 * The exchange rates available right now: today's cached rates, or the last
 * cached ones when the rate service couldn't be reached (`stale`).
 */
export interface RateSnapshot {
  /** Units of each currency per one US dollar. */
  perUsd: Partial<Record<CurrencyCode, number>>;
  /** The day these rates were fetched. */
  fetchedOn: CalendarDate;
  /** True when these are the last cached rates, not today's: "rates may be outdated". */
  stale: boolean;
}

/** Today's exchange rates (perhaps outdated), or `null` if none were ever cached. */
export type TodaysRates = () => Promise<RateSnapshot | null>;

const SIGNIFICANT_DIGITS = 6;

/**
 * Today's Rate as a Locked Rate: Group Currency units per one unit of
 * Expense Currency, to six significant digits, as a plain decimal string.
 * `undefined` when there are no rates for either currency.
 */
export function todaysRate(
  rates: RateSnapshot | null | undefined,
  from: CurrencyCode,
  to: CurrencyCode,
): string | undefined {
  if (from === to) return "1";
  const fromPerUsd = rates?.perUsd[from];
  const toPerUsd = rates?.perUsd[to];
  if (!fromPerUsd || !toPerUsd || !(fromPerUsd > 0) || !(toPerUsd > 0)) return undefined;
  return decimalText(toPerUsd / fromPerUsd);
}

/** A positive number rounded to six significant digits, with no exponent. */
function decimalText(value: number): string {
  const magnitude = Math.floor(Math.log10(value));
  const decimals = Math.min(20, Math.max(0, SIGNIFICANT_DIGITS - 1 - magnitude));
  const text = value.toFixed(decimals);
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}
