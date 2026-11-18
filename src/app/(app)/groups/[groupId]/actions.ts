"use server";

import { refresh } from "next/cache";
import type { NewExpenseFields } from "@/domain";
import { requireUser } from "@/auth/session";
import { deleteExpense, saveExpense, type ExpenseResult } from "@/expenses/save-expense";
import { userGroupRepository } from "@/groups/user-groups";

// Server Actions are public endpoints: each one re-checks the session, and the
// repository only reaches Groups the User is a Linked Member of.

export async function saveUserExpense(
  groupId: string,
  expenseId: string | null,
  fields: NewExpenseFields,
): Promise<ExpenseResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || (expenseId !== null && typeof expenseId !== "string")) {
    return { ok: false, errors: { form: "That request wasn't valid." } };
  }
  const result = await saveExpense(userGroupRepository(user), groupId, expenseId, fields);
  if (result.ok) refresh();
  return result;
}

export async function deleteUserExpense(groupId: string, expenseId: string): Promise<ExpenseResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof expenseId !== "string") {
    return { ok: false, errors: { form: "That request wasn't valid." } };
  }
  const result = await deleteExpense(userGroupRepository(user), groupId, expenseId);
  if (result.ok) refresh();
  return result;
}
