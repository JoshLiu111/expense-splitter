import type { Expense, Settlement } from "./types";

/**
 * One change to a Group's Expenses or Settlements. Edits keep the Expense as
 * it was before and after; nothing here is a Balance or Suggested
 * Settlement (ADR 0004), which are always derived from the Group.
 */
export type ActivityChange =
  | { kind: "expense-added"; expense: Expense }
  | { kind: "expense-edited"; before: Expense; after: Expense }
  | { kind: "expense-deleted"; expense: Expense }
  | { kind: "settlement-added"; settlement: Settlement }
  | { kind: "settlement-deleted"; settlement: Settlement };

/** An Activity entry: read-only once recorded. */
export interface ActivityEntry {
  id: string;
  /** ISO timestamp of the change. */
  at: string;
  /** The acting User's Linked Member; absent when the Guest made the change. */
  actorMemberId?: string;
  change: ActivityChange;
}

/**
 * Whether two versions of an Expense record the same thing, so saving one
 * over the other changed nothing worth an Activity entry.
 */
export function isSameExpense(a: Expense, b: Expense): boolean {
  const comparable = (e: Expense) =>
    JSON.stringify([
      e.description,
      e.amount,
      e.currency,
      e.lockedRate,
      e.manualRate ?? false,
      e.payerId,
      e.splitType,
      e.date,
      e.category,
      e.notes ?? "",
      e.shares.map((s) => [s.memberId, s.amount, s.percentage ?? null, s.ratio ?? null]),
    ]);
  return comparable(a) === comparable(b);
}
