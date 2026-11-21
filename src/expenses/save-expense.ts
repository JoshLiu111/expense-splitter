import {
  parseNewExpense,
  recordChangeBlock,
  type Visitor,
  type NewExpenseErrors,
  type NewExpenseFields,
  type TodaysRates,
} from "@/domain";
import type { GroupRepository } from "@/groups/group-repository";

/** What the Expense form shows after a save or delete. */
export type ExpenseResult =
  | { ok: true }
  | {
      ok: false;
      errors: NewExpenseErrors & { form?: string };
      /** Problems with individual Members' Split values, by Member id. */
      splitValueErrors?: Record<string, string>;
    };

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
  const values =
    typeof record.splitValues === "object" && record.splitValues !== null
      ? Object.entries(record.splitValues).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        )
      : [];
  return {
    amount: text("amount"),
    currency: text("currency"),
    rate: text("rate"),
    description: text("description"),
    date: text("date"),
    category: text("category"),
    payerId: text("payerId"),
    participantIds: [...new Set(ids)],
    notes: text("notes"),
    splitType: text("splitType"),
    splitValues: Object.fromEntries(values),
  };
}

const GROUP_GONE = "This Group is no longer available.";
const EXPENSE_GONE = "This Expense no longer exists. It may have been deleted.";

const formError = (form: string): ExpenseResult => ({ ok: false, errors: { form } });


/**
 * Validates the form against the Group as it is now (so the Payer and
 * participants must still be its current Members, or already on the
 * Expense being edited, and the Editing Mode must let `visitor` edit it),
 * then records it. A foreign-currency Expense gets Today's Rate from
 * `rates` as its Locked Rate, unless it keeps one.
 */
export async function saveExpense(
  repo: GroupRepository,
  groupId: string,
  expenseId: string | null,
  input: NewExpenseFields,
  rates: TodaysRates,
  visitor: Visitor,
): Promise<ExpenseResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  // Former Members already on an edited Expense stay selectable for it.
  const existing = expenseId ? group.expenses.find((e) => e.id === expenseId) : undefined;
  if (expenseId && !existing) return formError(EXPENSE_GONE);
  const block = existing && recordChangeBlock(group, visitor, "edit-expense", existing);
  if (block) return formError(block);
  const fields = expenseFields(input);
  const foreign = fields.currency !== group.currency;
  const parsed = parseNewExpense(fields, group, existing, foreign ? await rates() : null);
  if (!parsed.ok) return parsed;
  const saved = expenseId
    ? await repo.updateExpense(groupId, expenseId, parsed.value)
    : await repo.addExpense(groupId, parsed.value);
  return saved ? { ok: true } : formError(EXPENSE_GONE);
}

/** Deletes an Expense, if the Editing Mode lets `visitor` delete it. */
export async function deleteExpense(
  repo: GroupRepository,
  groupId: string,
  expenseId: string,
  visitor: Visitor,
): Promise<ExpenseResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const existing = group.expenses.find((e) => e.id === expenseId);
  if (!existing) return formError(EXPENSE_GONE);
  const block = recordChangeBlock(group, visitor, "delete-expense", existing);
  if (block) return formError(block);
  return (await repo.deleteExpense(groupId, expenseId))
    ? { ok: true }
    : formError(EXPENSE_GONE);
}
