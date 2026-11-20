import { isCategoryOf } from "./categories";
import { isCurrencyCode, parseAmount } from "./currency";
import { todaysRate, type RateSnapshot } from "./exchange-rates";
import { selectableMembers } from "./manage-group";
import { computeSplit } from "./split";
import type { CalendarDate, CurrencyCode, Expense, GroupSnapshot, SplitType } from "./types";

export { CATEGORIES } from "./categories";

export const MAX_EXPENSE_DESCRIPTION_LENGTH = 120;
export const MAX_EXPENSE_NOTES_LENGTH = 1000;

/** An Expense about to be recorded; the repository assigns id and createdAt. */
export type NewExpense = Omit<Expense, "id" | "createdAt" | "recorderId">;

/** The Expense form as the visitor filled it in. */
export interface NewExpenseFields {
  /** In the Expense Currency. */
  amount: string;
  /** The Expense Currency's code. */
  currency: string;
  /**
   * A manual Locked Rate as typed (Group Currency units per one unit of
   * Expense Currency); empty to use Today's Rate.
   */
  rate: string;
  description: string;
  date: string;
  category: string;
  payerId: string;
  participantIds: string[];
  notes: string;
  splitType: string;
  /**
   * What was typed per Member for an Exact, Percentage or Shares Split;
   * kept for every Member so switching Split Type loses nothing.
   */
  splitValues: Record<string, string>;
}

export type NewExpenseErrors = Partial<
  Record<
    | Exclude<keyof NewExpenseFields, "participantIds" | "splitValues">
    | "participants"
    | "split",
    string
  >
>;

export type ParseExpenseResult =
  | { ok: true; value: NewExpense }
  | {
      ok: false;
      errors: NewExpenseErrors;
      /** Problems with individual Members' Split values, by Member id. */
      splitValueErrors?: Record<string, string>;
    };

/** Each Split Type's name as shown, in the order offered. */
export const SPLIT_TYPE_LABELS: Readonly<Record<SplitType, string>> = {
  equal: "Equal",
  exact: "Exact",
  percentage: "Percentage",
  shares: "Shares",
};

const SPLIT_TYPES = Object.keys(SPLIT_TYPE_LABELS) as readonly SplitType[];

export function isSplitType(value: string): value is SplitType {
  return (SPLIT_TYPES as readonly string[]).includes(value);
}

/**
 * Validates an Expense for a Group and computes its Shares by its Split
 * Type, in the Expense Currency. Former Members can't join a new Expense,
 * but stay on an `existing` one being edited.
 *
 * The Locked Rate is 1 in the Group Currency. Otherwise it is the rate
 * typed (a manual rate); else the `existing` Expense's automatic Locked
 * Rate while its Expense Currency is unchanged; else Today's Rate
 * from `rates`.
 */
export function parseNewExpense(
  fields: NewExpenseFields,
  group: GroupSnapshot,
  existing?: Expense,
  rates?: RateSnapshot | null,
): ParseExpenseResult {
  const currency: CurrencyCode = isCurrencyCode(fields.currency) ? fields.currency : group.currency;
  const memberIds = selectableMembers(group, existing).map((m) => m.id);
  const description = fields.description.trim();
  const notes = fields.notes.trim();
  const errors: NewExpenseErrors = {};

  if (!isCurrencyCode(fields.currency)) errors.currency = "Choose a currency.";

  const amount = parseAmount(fields.amount, currency);
  if (!amount.ok) errors.amount = amount.error;

  const lock = lockRate({ typed: fields.rate, currency, group, existing, rates });
  if (!lock.ok) errors.rate = lock.error;

  if (description === "") errors.description = "Describe what the Expense was for.";
  else if (description.length > MAX_EXPENSE_DESCRIPTION_LENGTH)
    errors.description = `Keep the description to ${MAX_EXPENSE_DESCRIPTION_LENGTH} characters or fewer.`;

  if (!isCalendarDate(fields.date)) errors.date = "Enter a real date, like 2026-01-31.";

  if (!isCategoryOf(group, fields.category)) errors.category = "Choose one of the Categories.";

  if (!memberIds.includes(fields.payerId)) errors.payerId = "Choose who paid.";

  if (fields.participantIds.some((id) => !memberIds.includes(id)))
    errors.participants = "Only members of this Group can share an Expense.";
  else if (fields.participantIds.length === 0)
    errors.participants = "Choose at least one member to split with.";

  if (notes.length > MAX_EXPENSE_NOTES_LENGTH)
    errors.notes = `Keep notes to ${MAX_EXPENSE_NOTES_LENGTH} characters or fewer.`;

  const splitType = fields.splitType;
  if (!isSplitType(splitType)) errors.splitType = "Choose how to split the Expense.";

  let split: ReturnType<typeof computeSplit> | null = null;
  if (amount.ok && isSplitType(splitType) && !errors.participants) {
    split = computeSplit({
      amount: amount.amount,
      currency,
      splitType,
      participantIds: fields.participantIds,
      memberOrder: group.members.map((m) => m.id),
      values: fields.splitValues,
    });
    if (!split.ok) errors.split = split.error;
  }

  if (
    !amount.ok ||
    !split?.ok ||
    !lock.ok ||
    !isSplitType(splitType) ||
    Object.keys(errors).length > 0
  ) {
    const splitValueErrors = split && !split.ok ? split.memberErrors : undefined;
    return { ok: false, errors, ...(splitValueErrors ? { splitValueErrors } : {}) };
  }

  return {
    ok: true,
    value: {
      description,
      amount: amount.amount,
      currency,
      lockedRate: lock.rate,
      ...(lock.manual ? { manualRate: true } : {}),
      payerId: fields.payerId,
      splitType,
      shares: split.shares,
      date: fields.date,
      category: fields.category,
      ...(notes ? { notes } : {}),
    },
  };
}

export type LockResult =
  | {
      ok: true;
      rate: string;
      manual: boolean;
      /** True when an edited Expense keeps the Locked Rate it already had. */
      kept: boolean;
    }
  | { ok: false; error: string };

/**
 * The Locked Rate an Expense in `currency` gets: 1 in the Group Currency;
 * else the rate typed (manual); else, while an `existing` Expense's currency
 * is unchanged, its automatic Locked Rate; else Today's Rate.
 */
export function lockRate({
  typed,
  currency,
  group,
  existing,
  rates,
}: {
  typed: string;
  currency: CurrencyCode;
  group: GroupSnapshot;
  existing?: Expense;
  rates?: RateSnapshot | null;
}): LockResult {
  if (currency === group.currency) return { ok: true, rate: "1", manual: false, kept: false };
  if (typed.trim() !== "") {
    const manual = parseRate(typed);
    return manual.ok ? { ok: true, rate: manual.rate, manual: true, kept: false } : manual;
  }
  // Edits keep the Locked Rate, so past Balances never change; a cleared
  // manual rate goes back to the current one.
  if (existing && existing.currency === currency && !existing.manualRate) {
    return { ok: true, rate: existing.lockedRate, manual: false, kept: true };
  }
  const rate = todaysRate(rates, currency, group.currency);
  if (rate === undefined) {
    return { ok: false, error: "Exchange rates are unavailable right now. Enter the rate yourself." };
  }
  return { ok: true, rate, manual: false, kept: false };
}

/** Reads a typed rate as a plain decimal string, e.g. " 0.00670 " → "0.0067". */
function parseRate(text: string): { ok: true; rate: string } | { ok: false; error: string } {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text.replace(/[\s,]/g, ""));
  if (!match || (match[1] === "" && !match[2])) {
    return { ok: false, error: "Enter the rate as a number, like 0.0067." };
  }
  const whole = match[1].replace(/^0+/, "") || "0";
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > MAX_RATE_DECIMALS) {
    return { ok: false, error: `Use at most ${MAX_RATE_DECIMALS} decimal places in the rate.` };
  }
  if (whole.length > MAX_RATE_WHOLE_DIGITS) return { ok: false, error: "That rate is too large." };
  if (/^0*$/.test(whole + fraction)) return { ok: false, error: "Enter a rate greater than zero." };
  return { ok: true, rate: fraction ? `${whole}.${fraction}` : whole };
}

const MAX_RATE_DECIMALS = 12;
const MAX_RATE_WHOLE_DIGITS = 9;

/** A real `YYYY-MM-DD` calendar date (rejects 2026-02-30). */
export function isCalendarDate(value: string): value is CalendarDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
