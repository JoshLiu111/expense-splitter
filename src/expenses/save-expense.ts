import { parseNewExpense, type NewExpenseErrors, type NewExpenseFields } from "@/domain";
import type { GroupRepository } from "@/groups/group-repository";

/** What the Expense form shows after a save or delete. */
export type ExpenseResult =
  | { ok: true }
  | { ok: false; errors: NewExpenseErrors & { form?: string } };

/** Saves the Expense form: adds a new Expense, or edits `expenseId`. */
export type SaveExpense = (
  expenseId: string | null,
  fields: NewExpenseFields,
) => Promise<ExpenseResult>;

export type DeleteExpense = (expenseId: string) => Promise<ExpenseResult>;

/**
 * The form fields from an untrusted caller (a Server Action can be called
 * with anything): non-strings become empty, so validation reports them.
 */
export function expenseFields(input: unknown): NewExpenseFields {
  const record = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : "");
  const ids = Array.isArray(record.participantIds)
    ? record.participantIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    amount: text("amount"),
    description: text("description"),
    date: text("date"),
    category: text("category"),
    payerId: text("payerId"),
    participantIds: [...new Set(ids)],
    notes: text("notes"),
  };
}

const EXPENSE_GONE = "This Expense no longer exists. It may have been deleted.";

const formError = (form: string): ExpenseResult => ({ ok: false, errors: { form } });

/**
 * Validates the form against the Group as it is now (so the Payer and
 * participants must still be its Members), then records it.
 */
export async function saveExpense(
  repo: GroupRepository,
  groupId: string,
  expenseId: string | null,
  fields: NewExpenseFields,
): Promise<ExpenseResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError("This Group is no longer available.");
  const parsed = parseNewExpense(expenseFields(fields), group);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const saved = expenseId
    ? await repo.updateExpense(groupId, expenseId, parsed.value)
    : await repo.addExpense(groupId, parsed.value);
  return saved ? { ok: true } : formError(EXPENSE_GONE);
}

export async function deleteExpense(
  repo: GroupRepository,
  groupId: string,
  expenseId: string,
): Promise<ExpenseResult> {
  return (await repo.deleteExpense(groupId, expenseId))
    ? { ok: true }
    : formError(EXPENSE_GONE);
}
