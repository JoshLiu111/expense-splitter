"use server";

import { refresh } from "next/cache";
import type { NewExpenseFields } from "@/domain";
import { requireUser } from "@/auth/session";
import {
  addCategory,
  deleteCategory,
  renameCategory,
  type CategoryResult,
} from "@/categories/manage-categories";
import { deleteExpense, saveExpense, type ExpenseResult } from "@/expenses/save-expense";
import {
  addMember,
  deleteGroup,
  removeMember,
  resendInvitation,
  setEditingMode,
  setMemberEmail,
  updateGroupDetails,
  type AddMemberResult,
  type ManageResult,
  type SetMemberEmailResult,
} from "@/groups/manage-group";
import { emailMemberNotifier } from "@/groups/email-member-notifier";
import { userGroupRepository } from "@/groups/user-groups";
import { todaysRates } from "@/rates/todays-rates";
import {
  clearSmallChange,
  deleteSettlement,
  recordSettlement,
  type SettlementResult,
} from "@/settlements/settle-up";

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
  const result = await saveExpense(userGroupRepository(user), groupId, expenseId, fields, todaysRates, {
    userId: user.id,
  });
  if (result.ok) refresh();
  return result;
}

export async function deleteUserExpense(groupId: string, expenseId: string): Promise<ExpenseResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof expenseId !== "string") {
    return { ok: false, errors: { form: "That request wasn't valid." } };
  }
  const result = await deleteExpense(userGroupRepository(user), groupId, expenseId, { userId: user.id });
  if (result.ok) refresh();
  return result;
}

const INVALID: Extract<ManageResult, { ok: false }> = { ok: false, errors: { form: "That request wasn't valid." } };

export async function updateUserGroup(groupId: string, fields: unknown): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID;
  const result = await updateGroupDetails(userGroupRepository(user), groupId, fields);
  if (result.ok) refresh();
  return result;
}

export async function addUserMember(groupId: string, fields: unknown): Promise<AddMemberResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID;
  const result = await addMember(userGroupRepository(user), groupId, fields, emailMemberNotifier(user));
  if (result.ok) refresh();
  return result;
}

export async function setUserMemberEmail(
  groupId: string,
  memberId: string,
  email: unknown,
): Promise<SetMemberEmailResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof memberId !== "string") return INVALID;
  const result = await setMemberEmail(userGroupRepository(user), groupId, memberId, email, emailMemberNotifier(user));
  if (result.ok) refresh();
  return result;
}

export async function resendUserInvitation(groupId: string, memberId: string): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof memberId !== "string") return INVALID;
  const result = await resendInvitation(userGroupRepository(user), groupId, memberId, emailMemberNotifier(user));
  // Refreshed either way: a failed send shows on the Member as not sent.
  refresh();
  return result;
}

export async function removeUserMember(groupId: string, memberId: string): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof memberId !== "string") return INVALID;
  const result = await removeMember(userGroupRepository(user), groupId, memberId);
  if (result.ok) refresh();
  return result;
}

export async function setUserEditingMode(groupId: string, mode: unknown): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}/settings`);
  if (typeof groupId !== "string") return INVALID;
  const result = await setEditingMode(userGroupRepository(user), groupId, mode, { userId: user.id });
  if (result.ok) refresh();
  return result;
}

/** The client navigates away on success, so there's nothing to refresh. */
export async function deleteUserGroup(groupId: string): Promise<ManageResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID;
  return deleteGroup(userGroupRepository(user), groupId, { userId: user.id });
}

const INVALID_SETTLEMENT: SettlementResult = { ok: false, errors: { form: "That request wasn't valid." } };

export async function recordUserSettlement(groupId: string, fields: unknown): Promise<SettlementResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID_SETTLEMENT;
  const result = await recordSettlement(userGroupRepository(user), groupId, fields);
  if (result.ok) refresh();
  return result;
}

export async function deleteUserSettlement(groupId: string, settlementId: string): Promise<SettlementResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof settlementId !== "string") return INVALID_SETTLEMENT;
  const result = await deleteSettlement(userGroupRepository(user), groupId, settlementId, { userId: user.id });
  if (result.ok) refresh();
  return result;
}

export async function clearUserSmallChange(groupId: string, date: unknown): Promise<SettlementResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID_SETTLEMENT;
  const result = await clearSmallChange(userGroupRepository(user), groupId, date);
  if (result.ok) refresh();
  return result;
}

const INVALID_CATEGORY: CategoryResult = { ok: false, errors: { form: "That request wasn't valid." } };

export async function addUserCategory(groupId: string, fields: unknown): Promise<CategoryResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string") return INVALID_CATEGORY;
  const result = await addCategory(userGroupRepository(user), groupId, fields);
  if (result.ok) refresh();
  return result;
}

export async function renameUserCategory(groupId: string, categoryId: string, fields: unknown): Promise<CategoryResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof categoryId !== "string") return INVALID_CATEGORY;
  const result = await renameCategory(userGroupRepository(user), groupId, categoryId, fields);
  if (result.ok) refresh();
  return result;
}

export async function deleteUserCategory(groupId: string, categoryId: string): Promise<CategoryResult> {
  const user = await requireUser(`/groups/${groupId}`);
  if (typeof groupId !== "string" || typeof categoryId !== "string") return INVALID_CATEGORY;
  const result = await deleteCategory(userGroupRepository(user), groupId, categoryId);
  if (result.ok) refresh();
  return result;
}
