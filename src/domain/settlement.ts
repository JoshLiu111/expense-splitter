import { formatMoney, isCurrencyCode, minorUnitRate, parseAmount } from "./currency";
import type { RateSnapshot } from "./exchange-rates";
import { computeLedger, settlementInGroupCurrency } from "./ledger";
import { isCalendarDate, lockRate } from "./new-expense";
import type { CalendarDate, CurrencyCode, GroupSnapshot, MinorUnits, Settlement } from "./types";

/** A Settlement someone wants to record, in Group Currency minor units. */
export interface ProposedSettlement {
  fromId: string;
  toId: string;
  amount: MinorUnits;
}

export type SettlementCheck =
  | { ok: true }
  | {
      ok: false;
      /** The form field the problem belongs to. */
      field: "fromId" | "toId" | "amount";
      error: string;
      /** When the amount is too big: the most that can be settled. */
      maxAmount?: MinorUnits;
    };

/**
 * The most `fromId` can pay `toId` in the Group Currency: the smaller of
 * what one owes and the other is owed, or 0 when either has nothing.
 */
export function settleableAmount(group: GroupSnapshot, fromId: string, toId: string): MinorUnits {
  const balances = new Map(computeLedger(group).balances.map((b) => [b.memberId, b.amount]));
  return Math.max(0, Math.min(-(balances.get(fromId) ?? 0), balances.get(toId) ?? 0));
}

/**
 * Validate Settlement: a Settlement must go from a Member who owes (negative
 * Balance) to one who is owed (positive Balance), and be no more than the
 * smaller of the two, so it can never settle a debt that doesn't exist. The
 * amount is the Settlement's in the Group Currency.
 */
export function validateSettlement(group: GroupSnapshot, proposed: ProposedSettlement): SettlementCheck {
  const from = group.members.find((m) => m.id === proposed.fromId);
  const to = group.members.find((m) => m.id === proposed.toId);
  if (!from) return { ok: false, field: "fromId", error: "Choose who paid." };
  if (!to) return { ok: false, field: "toId", error: "Choose who was paid." };
  if (from.id === to.id) return { ok: false, field: "toId", error: `Choose someone other than ${from.name}.` };

  const balances = new Map(computeLedger(group).balances.map((b) => [b.memberId, b.amount]));
  const owes = -(balances.get(from.id) ?? 0);
  const owed = balances.get(to.id) ?? 0;
  if (owes <= 0) return { ok: false, field: "fromId", error: `${from.name} doesn't owe anything.` };
  if (owed <= 0) return { ok: false, field: "toId", error: `${to.name} isn't owed anything.` };

  if (!Number.isSafeInteger(proposed.amount) || proposed.amount <= 0)
    return { ok: false, field: "amount", error: "Enter an amount greater than zero." };
  const maxAmount = Math.min(owes, owed);
  if (proposed.amount > maxAmount)
    return {
      ok: false,
      field: "amount",
      error: `${from.name} can pay at most ${formatMoney(maxAmount, group.currency)}.`,
      maxAmount,
    };
  return { ok: true };
}

/**
 * The Settlement Currency amount closest to `amount` (Group Currency) once
 * converted at `rate`, without the converted amount going over `max`; ties
 * go to the one nearest the exact conversion. Exact integer arithmetic, so
 * a prefilled amount never fails Validate Settlement by a rounding.
 * `null` when no amount above zero converts to at most `max`.
 */
export function settlementAmountFor({
  amount,
  max,
  currency,
  groupCurrency,
  rate,
}: {
  amount: MinorUnits;
  max: MinorUnits;
  currency: CurrencyCode;
  groupCurrency: CurrencyCode;
  rate: string;
}): MinorUnits | null {
  const target = BigInt(Math.min(amount, max));
  const { candidates, offExact } = amountsNear(target, max, currency, groupCurrency, rate);
  let best: (typeof candidates)[number] | undefined;
  for (const c of candidates) {
    const gap = abs(c.converted - target);
    const bestGap = best && abs(best.converted - target);
    if (!best || gap < bestGap! || (gap === bestGap && offExact(c.amount) < offExact(best.amount))) best = c;
  }
  return best ? Number(best.amount) : null;
}

/** The most that can be paid in `currency` at `rate` without going over `max` in the Group Currency. */
function largestSettlementAmount(
  max: MinorUnits,
  currency: CurrencyCode,
  groupCurrency: CurrencyCode,
  rate: string,
): MinorUnits | null {
  const { numerator: n, denominator: d } = minorUnitRate(currency, groupCurrency, rate);
  if (n === 0n) return null;
  // Rounding half up, x converts to at most max exactly when 2xn < (2max + 1)d.
  const bound = (2n * BigInt(max) + 1n) * d;
  const largest = (bound + 2n * n - 1n) / (2n * n) - 1n;
  return largest > 0n && (largest * n * 2n + d) / (d * 2n) > 0n ? Number(largest) : null;
}

/**
 * The Settlement Currency amounts around `target` (Group Currency) at
 * `rate`, ascending, each with its converted amount, kept only when that is
 * above zero and at most `max`. Conversion never decreases as the amount
 * grows, so the best amounts are always among these.
 */
function amountsNear(
  target: bigint,
  max: MinorUnits,
  currency: CurrencyCode,
  groupCurrency: CurrencyCode,
  rate: string,
) {
  // Group Currency minor units per Settlement Currency minor unit: n / d.
  const { numerator: n, denominator: d } = minorUnitRate(currency, groupCurrency, rate);
  // Distance from the exact conversion, scaled by d so it stays an integer.
  const offExact = (x: bigint) => abs(x * n - target * d);
  const candidates: { amount: bigint; converted: bigint }[] = [];
  if (n === 0n || target <= 0n) return { candidates, offExact };
  const estimate = (target * d) / n;
  for (let x = estimate - 2n; x <= estimate + 2n; x++) {
    if (x <= 0n) continue;
    const converted = (x * n * 2n + d) / (d * 2n);
    if (converted > 0n && converted <= BigInt(max)) candidates.push({ amount: x, converted });
  }
  return { candidates, offExact };
}

const abs = (x: bigint) => (x < 0n ? -x : x);

/** A Settlement about to be recorded; the repository assigns id and createdAt. */
export type NewSettlement = Omit<Settlement, "id" | "createdAt" | "recorderId">;

/** The Settlement form as the visitor filled it in. */
export interface NewSettlementFields {
  fromId: string;
  toId: string;
  /** In the Settlement Currency. */
  amount: string;
  /** The Settlement Currency's code. */
  currency: string;
  /**
   * A manual Locked Rate as typed (Group Currency units per one unit of
   * Settlement Currency); empty to use Today's Rate.
   */
  rate: string;
  date: string;
}

export type NewSettlementErrors = Partial<Record<keyof NewSettlementFields, string>>;

export type ParseSettlementResult =
  | { ok: true; value: NewSettlement }
  | { ok: false; errors: NewSettlementErrors };

/**
 * Validates the Settlement form against the Group's Balances now. The
 * Locked Rate is 1 in the Group Currency, else the rate typed (manual),
 * else Today's Rate from `rates`; Validate Settlement then checks the amount
 * converted at it, which must be at least one minor unit of Group Currency.
 */
export function parseNewSettlement(
  fields: NewSettlementFields,
  group: GroupSnapshot,
  rates: RateSnapshot | null | undefined,
): ParseSettlementResult {
  const errors: NewSettlementErrors = {};
  const currency: CurrencyCode = isCurrencyCode(fields.currency) ? fields.currency : group.currency;
  if (!isCurrencyCode(fields.currency)) errors.currency = "Choose a currency.";
  const amount = parseAmount(fields.amount, currency);
  const lock = lockRate({ typed: fields.rate, currency, group, rates });
  if (!lock.ok) errors.rate = lock.error;
  if (!isCalendarDate(fields.date)) errors.date = "Enter a real date, like 2026-01-31.";

  const groupAmount =
    amount.ok && lock.ok
      ? settlementInGroupCurrency({ amount: amount.amount, currency, lockedRate: lock.rate }, group.currency)
      : null;
  // An amount not known in the Group Currency is checked as 1 so the Members are still checked.
  const check = validateSettlement(group, { fromId: fields.fromId, toId: fields.toId, amount: groupAmount || 1 });
  if (!check.ok) {
    errors[check.field] = check.error;
    if (check.maxAmount !== undefined && lock.ok && currency !== group.currency) {
      const most = largestSettlementAmount(check.maxAmount, currency, group.currency, lock.rate);
      if (most !== null) errors.amount = `${check.error.slice(0, -1)} (${formatMoney(most, currency)} at this rate).`;
    }
  }
  if (!amount.ok) errors.amount = amount.error;
  else if (groupAmount === 0)
    errors.amount = `${formatMoney(amount.amount, currency)} is less than ${formatMoney(1, group.currency)} at this rate. Enter a larger amount.`;

  if (!amount.ok || !lock.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  const date: CalendarDate = fields.date;
  return {
    ok: true,
    value: {
      fromId: fields.fromId,
      toId: fields.toId,
      amount: amount.amount,
      currency,
      lockedRate: lock.rate,
      ...(lock.manual ? { manualRate: true } : {}),
      date,
    },
  };
}
