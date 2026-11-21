import type { CurrencyChange } from "./change-currency";
import type { EditingMode } from "./editing-mode";
import type { GroupDetails } from "./manage-group";
import type { CurrencyCode, CustomCategory, Expense, Settlement } from "./types";

/**
 * A Member as an Activity entry names them: the name they were shown under
 * when it was recorded, which stays even if that name later changes.
 */
export interface ActivityMember {
  id: string;
  name: string;
}

/**
 * One change to a Group: to its Expenses, Settlements or Members, its name
 * and description, Group Currency, Custom Categories or Editing Mode. Edits
 * keep what was changed as it was before and after; nothing here is a
 * Balance or Suggested Settlement (ADR 0004), which are always derived from
 * the Group.
 */
export type ActivityChange =
  | { kind: "expense-added"; expense: Expense }
  | { kind: "expense-edited"; before: Expense; after: Expense }
  | { kind: "expense-deleted"; expense: Expense }
  | { kind: "settlement-added"; settlement: Settlement }
  | { kind: "settlement-deleted"; settlement: Settlement }
  | { kind: "member-added"; member: ActivityMember }
  /** An Invitation emailed to a Pending Member; `resent` when an earlier one was too. */
  | { kind: "member-invited"; member: ActivityMember; email: string; resent: boolean }
  /** A Pending Member claimed: recorded under that Member, as the User who claimed it. */
  | { kind: "member-joined"; member: ActivityMember }
  | { kind: "member-email-set"; member: ActivityMember; email: string }
  | { kind: "member-removed"; member: ActivityMember }
  /** The Group's name or description, or both, changed. */
  | { kind: "group-details-edited"; before: GroupDetails; after: GroupDetails }
  /** Every Locked Rate was converted from `from` to `to` at `rate` (ADR 0010). */
  | ({ kind: "currency-changed" } & CurrencyChange)
  | { kind: "category-added"; category: CustomCategory }
  | { kind: "category-renamed"; before: CustomCategory; after: CustomCategory }
  | { kind: "category-deleted"; category: CustomCategory }
  | { kind: "editing-mode-changed"; before: EditingMode; after: EditingMode };

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
 * What an edit can change on an Expense, in the Expense form's order, each
 * read in a form that compares equal exactly when nothing changed. Recording
 * (`isSameExpense`) and showing (`changedExpenseFields`) share this list, so
 * a field added here is both recorded and shown.
 */
const EXPENSE_FIELDS = {
  description: (e) => e.description,
  amount: (e) => [e.amount, e.currency],
  lockedRate: (e) => [e.lockedRate, e.manualRate ?? false],
  payer: (e) => e.payerId,
  splitType: (e) => e.splitType,
  date: (e) => e.date,
  category: (e) => e.category,
  notes: (e) => e.notes ?? "",
  // By Member: a Share's order means nothing, and a zero Share with nothing
  // typed for it is no Share.
  shares: (e) =>
    e.shares
      .filter((s) => s.amount !== 0 || s.percentage !== undefined || s.ratio !== undefined)
      .map((s) => [s.memberId, s.amount, s.percentage ?? null, s.ratio ?? null])
      .sort(([a], [b]) => (String(a) < String(b) ? -1 : 1)),
} satisfies Record<string, (e: Expense) => unknown>;

/** One thing an edit can change on an Expense. */
export type ExpenseField = keyof typeof EXPENSE_FIELDS;

/** What an edit changed on an Expense, in the Expense form's order. */
export function changedExpenseFields(before: Expense, after: Expense): ExpenseField[] {
  return (Object.keys(EXPENSE_FIELDS) as ExpenseField[]).filter(
    (field) => JSON.stringify(EXPENSE_FIELDS[field](before)) !== JSON.stringify(EXPENSE_FIELDS[field](after)),
  );
}

/**
 * Whether two versions of an Expense record the same thing, so saving one
 * over the other changed nothing worth an Activity entry.
 */
export function isSameExpense(a: Expense, b: Expense): boolean {
  return changedExpenseFields(a, b).length === 0;
}

/** What an edit changed of a Group's name and description, in Group settings' order. */
export function changedGroupDetails(before: GroupDetails, after: GroupDetails): (keyof GroupDetails)[] {
  return (["name", "description"] as const).filter((field) => before[field] !== after[field]);
}

/**
 * The Group Currency each entry was recorded in, given entries newest first
 * and the Group Currency now: an entry older than a Group Currency change
 * was recorded in that change's old one, so its Locked Rates convert into
 * it (ADR 0010). Entries themselves are never rewritten.
 */
export function groupCurrenciesThen(
  entries: readonly Pick<ActivityEntry, "change">[],
  current: CurrencyCode,
): CurrencyCode[] {
  let then = current;
  return entries.map(({ change }) => {
    const recordedIn = then;
    if (change.kind === "currency-changed") then = change.from;
    return recordedIn;
  });
}
