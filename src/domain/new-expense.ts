import { parseAmount } from "./currency";
import { selectableMembers } from "./manage-group";
import { computeSplit } from "./split";
import type { CalendarDate, Expense, GroupSnapshot, SplitType } from "./types";

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

const SPLIT_TYPES: readonly SplitType[] = ["equal", "exact", "percentage", "shares"];

export function isSplitType(value: string): value is SplitType {
  return (SPLIT_TYPES as readonly string[]).includes(value);
}

/**
 * Validates an Expense for a Group and computes its Shares by its Split
 * Type. The Expense is recorded in the Group Currency, so its Locked Rate
 * is 1. Former Members can't join a new Expense, but stay on an `existing`
 * one being edited.
 */
export function parseNewExpense(
  fields: NewExpenseFields,
  group: GroupSnapshot,
  existing?: Expense,
): ParseExpenseResult {
  const currency = group.currency;
  const memberIds = selectableMembers(group, existing).map((m) => m.id);
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

  if (!amount.ok || !split?.ok || !isSplitType(splitType) || Object.keys(errors).length > 0) {
    const splitValueErrors = split && !split.ok ? split.memberErrors : undefined;
    return { ok: false, errors, ...(splitValueErrors ? { splitValueErrors } : {}) };
  }

  return {
    ok: true,
    value: {
      description,
      amount: amount.amount,
      currency,
      lockedRate: "1",
      payerId: fields.payerId,
      splitType,
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
export function isCalendarDate(value: string): value is CalendarDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
