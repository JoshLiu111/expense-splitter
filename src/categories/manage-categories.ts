import { categoryDeletionBlock, groupManagementBlock, parseCategoryName, type GroupSnapshot, type Visitor } from "@/domain";
import type { GroupRepository } from "@/groups/group-repository";

/** What a Custom Category control shows after it acts. */
export type CategoryResult = { ok: true } | { ok: false; errors: { name?: string; form?: string } };

/** What the Custom Category form sends. */
export interface CategoryFields {
  name: string;
}

const GROUP_GONE = "This Group is no longer available.";
const CATEGORY_GONE = "That Category is no longer available.";
const formError = (form: string): CategoryResult => ({ ok: false, errors: { form } });

const nameOf = (input: unknown): string => {
  const name = typeof input === "object" && input !== null ? (input as Record<string, unknown>).name : "";
  return typeof name === "string" ? name : "";
};

const isCustom = (group: GroupSnapshot, categoryId: string) =>
  group.customCategories?.some((c) => c.id === categoryId) ?? false;

// Each operation re-checks its domain rule against the Group as stored now,
// so a stale or hand-crafted request can't get round what the UI hides.

/** Adds a Custom Category, visible only in this Group. */
export async function addCategory(
  repo: GroupRepository,
  groupId: string,
  input: unknown,
  visitor: Visitor,
): Promise<CategoryResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "add-category");
  if (block) return formError(block);
  const name = parseCategoryName(nameOf(input), group);
  if (!name.ok) return { ok: false, errors: { name: name.error } };
  return (await repo.addCategory(groupId, name.value)) ? { ok: true } : formError(GROUP_GONE);
}

/** Renames a Custom Category; its Expenses show the new name. */
export async function renameCategory(
  repo: GroupRepository,
  groupId: string,
  categoryId: string,
  input: unknown,
  visitor: Visitor,
): Promise<CategoryResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "rename-category");
  if (block) return formError(block);
  if (!isCustom(group, categoryId)) return formError(CATEGORY_GONE);
  const name = parseCategoryName(nameOf(input), group, categoryId);
  if (!name.ok) return { ok: false, errors: { name: name.error } };
  return (await repo.renameCategory(groupId, categoryId, name.value)) ? { ok: true } : formError(CATEGORY_GONE);
}

/** Deletes a Custom Category no Expense uses. */
export async function deleteCategory(
  repo: GroupRepository,
  groupId: string,
  categoryId: string,
  visitor: Visitor,
): Promise<CategoryResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "delete-category");
  if (block) return formError(block);
  if (!isCustom(group, categoryId)) return formError(CATEGORY_GONE);
  const inUse = categoryDeletionBlock(group, categoryId);
  if (inUse) return formError(inUse);
  return (await repo.deleteCategory(groupId, categoryId)) ? { ok: true } : formError(CATEGORY_GONE);
}

/** The Custom Category operations a Group page can call, bound to one Group. */
export interface CategoryManagement {
  add(fields: CategoryFields): Promise<CategoryResult>;
  rename(categoryId: string, fields: CategoryFields): Promise<CategoryResult>;
  delete(categoryId: string): Promise<CategoryResult>;
}
