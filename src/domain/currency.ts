import type { CurrencyCode, MinorUnits } from "./types";

/** Number of minor-unit digits per currency (ISO 4217). */
const EXPONENTS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  CAD: 2,
  AUD: 2,
  CHF: 2,
  CNY: 2,
  INR: 2,
  MXN: 2,
};

/** Every supported currency, in display order. */
export const CURRENCY_CODES = Object.keys(EXPONENTS) as CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(EXPONENTS, value);
}

export function exponentOf(currency: CurrencyCode): number {
  return EXPONENTS[currency];
}

/** Converts a JSON major-unit amount (e.g. 236.5) to integer minor units. */
export function toMinorUnits(major: number, currency: CurrencyCode): MinorUnits {
  const minor = Math.round(major * 10 ** exponentOf(currency));
  if (Math.abs(minor - major * 10 ** exponentOf(currency)) > 1e-6) {
    throw new Error(`${major} has more decimals than ${currency} allows`);
  }
  return minor;
}

const PLAIN_DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/**
 * Converts an amount from one currency into another with a decimal rate,
 * rounding half up to the target's minor unit. Integer arithmetic only.
 */
export function convert(
  amount: MinorUnits,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: string,
): MinorUnits {
  const match = PLAIN_DECIMAL.exec(rate);
  if (!match) throw new Error(`Invalid exchange rate "${rate}"`);
  const fraction = match[2] ?? "";
  const rateNumerator = BigInt(match[1] + fraction);
  const numerator =
    BigInt(Math.abs(amount)) * rateNumerator * 10n ** BigInt(exponentOf(to));
  const denominator =
    10n ** BigInt(fraction.length) * 10n ** BigInt(exponentOf(from));
  const rounded = (numerator * 2n + denominator) / (denominator * 2n);
  return Math.sign(amount) * Number(rounded);
}

const formatters = new Map<CurrencyCode, Intl.NumberFormat>();

/** Formats minor units for display, e.g. `$1,234.56` or `¥123,456`. */
export function formatMoney(amount: MinorUnits, currency: CurrencyCode): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    const digits = exponentOf(currency);
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(currency, formatter);
  }
  return formatter.format(amount / 10 ** exponentOf(currency));
}
