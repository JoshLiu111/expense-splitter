import { parseAmount } from "./currency";
import { computeSplit } from "./split";
import type { CalendarDate, Expense, GroupSnapshot } from "./types";

/** The nine predefined Categories shared by all Groups. */
export const CATEGORIES = [
  "Food & Drink",
  "Transport",
  "Accommodation",
  "Housing",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Groceries",
  "Other",
] as const;

export const MAX_EXPENSE_DESCRIPTION_LENGTH = 120;
export const MAX_EXPENSE_NOTES_LENGTH = 1000;

/** An Expense about to be recorded; the repository assigns id and createdAt. */
export type NewExpense = Omit<Expense, "id" | "createdAt">;

/** The Expense form as the visitor filled it in. */
export interface NewExpenseFields {
  amount: string;
  description: string;
  date: string;
  category: string;
  payerId: string;
  participantIds: string[];
  notes: string;
}

export type NewExpenseErrors = Partial<
  Record<Exclude<keyof NewExpenseFields, "participantIds"> | "participants", string>
>;

export type ParseExpenseResult =
  | { ok: true; value: NewExpense }
  | { ok: false; errors: NewExpenseErrors };

/**
 * Validates an Equal Expense for a Group and computes its Shares. The
 * Expense is recorded in the Group Currency, so its Locked Rate is 1.
 */
export function parseNewExpense(fields: NewExpenseFields, group: GroupSnapshot): ParseExpenseResult {
  const currency = group.currency;
  const memberIds = group.members.map((m) => m.id);
  const description = fields.description.trim();
  const notes = fields.notes.trim();
  const errors: NewExpenseErrors = {};

  const amount = parseAmount(fields.amount, currency);
  if (!amount.ok) errors.amount = amount.error;

  if (description === "") errors.description = "Describe what the Expense was for.";
  else if (description.length > MAX_EXPENSE_DESCRIPTION_LENGTH)
    errors.description = `Keep the description to ${MAX_EXPENSE_DESCRIPTION_LENGTH} characters or fewer.`;

  if (!isCalendarDate(fields.date)) errors.date = "Enter a real date, like 2026-01-31.";

  if (!isCategory(fields.category)) errors.category = "Choose one of the Categories.";

  if (!memberIds.includes(fields.payerId)) errors.payerId = "Choose who paid.";

  if (fields.participantIds.some((id) => !memberIds.includes(id)))
    errors.participants = "Only members of this Group can share an Expense.";
  else if (fields.participantIds.length === 0)
    errors.participants = "Choose at least one member to split with.";

  if (notes.length > MAX_EXPENSE_NOTES_LENGTH)
    errors.notes = `Keep notes to ${MAX_EXPENSE_NOTES_LENGTH} characters or fewer.`;

  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors };

  const split = computeSplit({
    amount: amount.amount,
    currency,
    splitType: "equal",
    participantIds: fields.participantIds,
    memberOrder: memberIds,
  });
  if (!split.ok) return { ok: false, errors: { participants: split.error } };

  return {
    ok: true,
    value: {
      description,
      amount: amount.amount,
      currency,
      lockedRate: "1",
      payerId: fields.payerId,
      splitType: "equal",
      shares: split.shares,
      date: fields.date,
      category: fields.category,
      ...(notes ? { notes } : {}),
    },
  };
}

function isCategory(value: string): boolean {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** A real `YYYY-MM-DD` calendar date (rejects 2026-02-30). */
function isCalendarDate(value: string): value is CalendarDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
