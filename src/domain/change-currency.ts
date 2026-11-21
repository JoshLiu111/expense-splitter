import { isCurrencyCode } from "./currency";
import { MAX_RATE_DECIMALS, parseRate } from "./new-expense";
import type { CurrencyCode, Expense, GroupSnapshot, Settlement } from "./types";
import { groupCreatorPhrase, isGroupCreator, type Visitor } from "./visitor";

/**
 * A Group Currency change: every Expense and Settlement is converted from
 * the Group Currency `from` into `to` at one `rate`, units of `to` per one
 * unit of `from`. `from` is the Group Currency the change was worked out
 * against, so a change made twice, or after someone else's, converts nothing.
 */
export interface CurrencyChange {
  from: CurrencyCode;
  to: CurrencyCode;
  /** A plain decimal string, as a Locked Rate is. */
  rate: string;
}

/** What the Group Currency form sends. */
export interface CurrencyChangeFields {
  /** The Group Currency the visitor saw, so a stale change is refused. */
  from: string;
  to: string;
  rate: string;
}

export type ParseCurrencyChangeResult =
  | { ok: true; value: CurrencyChange }
  | { ok: false; errors: Partial<Record<"to" | "rate" | "form", string>> };

/** Why the visitor can't change the Group Currency, or `null` if they can: only the Group Creator may, in any Editing Mode. */
export function currencyChangeBlock(group: GroupSnapshot, visitor: Visitor): string | null {
  if (isGroupCreator(group, visitor)) return null;
  return `Only ${groupCreatorPhrase(group)} can change the Group Currency.`;
}

/** Whether a Group has anything for a Group Currency change to convert. */
export const hasRecords = (group: GroupSnapshot): boolean =>
  group.expenses.length > 0 || group.settlements.length > 0;

/**
 * Validates a Group Currency change against the Group as it is now. A Group
 * with nothing recorded has nothing to convert, so needs no rate.
 */
export function parseCurrencyChange(fields: CurrencyChangeFields, group: GroupSnapshot): ParseCurrencyChangeResult {
  if (fields.from !== group.currency)
    return {
      ok: false,
      errors: { form: "The Group Currency has changed since this page loaded. Check the new Balances again." },
    };
  const to = fields.to.trim();
  if (!isCurrencyCode(to)) return { ok: false, errors: { to: "Choose one of the supported currencies." } };
  if (to === group.currency) return { ok: false, errors: { to: `The Group Currency is already ${to}.` } };
  if (!hasRecords(group)) return { ok: true, value: { from: group.currency, to, rate: "1" } };
  const rate = parseRate(fields.rate);
  if (!rate.ok) return { ok: false, errors: { rate: rate.error } };
  const change = { from: group.currency, to, rate: rate.rate };
  const converted = changeGroupCurrency(group, change);
  if ([...converted.expenses, ...converted.settlements].some((r) => /^0(\.0*)?$/.test(r.lockedRate)))
    return { ok: false, errors: { rate: "That rate is too small to convert every Expense and Settlement." } };
  return { ok: true, value: change };
}

/**
 * A record's Locked Rate once the Group Currency changes: exactly 1 when it
 * is in the new Group Currency, otherwise its old Locked Rate times the
 * change's rate, rounded half up to the decimals a typed rate may have, so
 * it can still be edited. Whether it was manual is kept, except at 1.
 */
export function convertedRate(
  record: Pick<Expense | Settlement, "currency" | "lockedRate" | "manualRate">,
  change: Pick<CurrencyChange, "to" | "rate">,
): { lockedRate: string; manualRate: boolean } {
  if (record.currency === change.to) return { lockedRate: "1", manualRate: false };
  return { lockedRate: multiplyRates(record.lockedRate, change.rate), manualRate: record.manualRate ?? false };
}

/**
 * Change Group Currency: the Group in `change.to`, with every Expense's and
 * Settlement's Locked Rate converted (`convertedRate`). Balances are never
 * stored (ADR 0004), so they follow: each Share is still rounded on its own
 * line (ADR 0001) and its Payer credited their sum, so every Balance scales
 * by about the rate and they still sum to zero.
 */
export function changeGroupCurrency(group: GroupSnapshot, change: CurrencyChange): GroupSnapshot {
  const convert = <R extends Expense | Settlement>(record: R): R => {
    const { lockedRate, manualRate } = convertedRate(record, change);
    const converted: R = { ...record, lockedRate };
    if (manualRate) converted.manualRate = true;
    else delete converted.manualRate;
    return converted;
  };
  return {
    ...group,
    currency: change.to,
    expenses: group.expenses.map(convert),
    settlements: group.settlements.map(convert),
  };
}

const PLAIN_DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/**
 * The product of two plain decimal rates, rounded half up to
 * MAX_RATE_DECIMALS decimals, as a plain decimal string. Exact: no
 * floating point.
 */
export function multiplyRates(a: string, b: string): string {
  const [x, y] = [a, b].map((rate) => {
    const match = PLAIN_DECIMAL.exec(rate);
    if (!match) throw new Error(`Invalid exchange rate "${rate}"`);
    const fraction = match[2] ?? "";
    return { digits: BigInt(match[1] + fraction), decimals: fraction.length };
  });
  const decimals = x.decimals + y.decimals;
  let product = x.digits * y.digits;
  if (decimals > MAX_RATE_DECIMALS) {
    const scale = 10n ** BigInt(decimals - MAX_RATE_DECIMALS);
    product = (product * 2n + scale) / (scale * 2n);
  }
  const kept = Math.min(decimals, MAX_RATE_DECIMALS);
  const text = product.toString().padStart(kept + 1, "0");
  if (kept === 0) return text;
  const whole = text.slice(0, -kept);
  const fraction = text.slice(-kept).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
