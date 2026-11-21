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

/** Amounts must stay below this many major units. */
const MAX_MAJOR_UNITS = 10_000_000_000;

export type ParseAmountResult = { ok: true; amount: MinorUnits } | { ok: false; error: string };

/**
 * Reads an amount typed by a person ("1,234.56") as exact minor units,
 * without going through floating point.
 */
export function parseAmount(text: string, currency: CurrencyCode): ParseAmountResult {
  const cleaned = text.replace(/[\s,]/g, "");
  if (cleaned === "") return { ok: false, error: "Enter an amount." };
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (match[2] === "" && !match[3])) {
    return { ok: false, error: "Enter the amount as a number, like 12.50." };
  }
  const [, sign, whole, fraction = ""] = match;
  const digits = exponentOf(currency);
  const significant = fraction.replace(/0+$/, "");
  if (significant.length > digits) {
    return {
      ok: false,
      error:
        digits === 0
          ? `${currency} amounts must be whole numbers.`
          : `${currency} amounts can have at most ${digits} decimal places.`,
    };
  }
  const amount = Number((whole || "0") + significant.padEnd(digits, "0"));
  if (sign === "-" || amount === 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  const max = MAX_MAJOR_UNITS * 10 ** digits;
  if (amount >= max) {
    return { ok: false, error: `Enter an amount under ${formatMoney(max, currency)}.` };
  }
  return { ok: true, amount };
}

const PLAIN_DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/**
 * Minor units of `to` per minor unit of `from` at a decimal rate, as an
 * exact fraction.
 */
export function minorUnitRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rate: string,
): { numerator: bigint; denominator: bigint } {
  const match = PLAIN_DECIMAL.exec(rate);
  if (!match) throw new Error(`Invalid exchange rate "${rate}"`);
  const fraction = match[2] ?? "";
  return {
    numerator: BigInt(match[1] + fraction) * 10n ** BigInt(exponentOf(to)),
    denominator: 10n ** BigInt(fraction.length) * 10n ** BigInt(exponentOf(from)),
  };
}

/** Minor units converted at a `minorUnitRate`, rounding half up. */
export function convertAtRate(
  amount: bigint,
  { numerator, denominator }: { numerator: bigint; denominator: bigint },
): bigint {
  return (amount * numerator * 2n + denominator) / (denominator * 2n);
}

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
  return Math.sign(amount) * Number(convertAtRate(BigInt(Math.abs(amount)), minorUnitRate(from, to, rate)));
}

/** Minor units as plain text a person can edit, e.g. 6000 USD → "60.00". */
export function amountText(amount: MinorUnits, currency: CurrencyCode): string {
  const digits = exponentOf(currency);
  if (digits === 0) return String(amount);
  const text = String(Math.abs(amount)).padStart(digits + 1, "0");
  const sign = amount < 0 ? "-" : "";
  return `${sign}${text.slice(0, -digits)}.${text.slice(-digits)}`;
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
