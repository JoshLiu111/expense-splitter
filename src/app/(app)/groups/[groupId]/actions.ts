"use server";

import { refresh } from "next/cache";
import type { NewExpenseFields } from "@/domain";
import { requireUser } from "@/auth/session";
import { deleteExpense, saveExpense, type ExpenseResult } from "@/expenses/save-expense";
import {
  addMember,
  deleteGroup,
  removeMember,
  updateGroupDetails,
  type ManageResult,
} from "@/groups/manage-group";
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

const INVALID: ManageResult = { ok: false, errors: { form: "That request wasn't valid." } };

export async function updateUserGroup(groupId: string, fields: unknown): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID;
  const result = await updateGroupDetails(userGroupRepository(user), groupId, fields);
  if (result.ok) refresh();
  return result;
}

export async function addUserMember(groupId: string, name: unknown): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID;
  const result = await addMember(userGroupRepository(user), groupId, name);
  if (result.ok) refresh();
  return result;
}

export async function removeUserMember(groupId: string, memberId: string): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof memberId !== "string") return INVALID;
  const result = await removeMember(userGroupRepository(user), groupId, memberId);
  if (result.ok) refresh();
  return result;
}

/** The client navigates away on success, so there's nothing to refresh. */
export async function deleteUserGroup(groupId: string): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID;
  return deleteGroup(userGroupRepository(user), groupId, { userId: user.id });
}
