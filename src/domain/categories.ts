import type { GroupSnapshot } from "./types";

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

export const MAX_CATEGORY_NAME_LENGTH = 40;

/**
 * A Category an Expense in a Group can have. `id` is what the Expense
 * stores: a predefined Category's name, or a Custom Category's id.
 */
export interface CategoryOption {
  id: string;
  name: string;
  custom: boolean;
}

/** The nine predefined Categories, then the Group's Custom Categories. */
export function categoryOptions(group: Pick<GroupSnapshot, "customCategories">): CategoryOption[] {
  return [
    ...CATEGORIES.map((name) => ({ id: name, name, custom: false })),
    ...(group.customCategories ?? []).map((c) => ({ id: c.id, name: c.name, custom: true })),
  ];
}

/** Whether an Expense in this Group can have this Category. */
export function isCategoryOf(group: Pick<GroupSnapshot, "customCategories">, category: string): boolean {
  return categoryOptions(group).some((o) => o.id === category);
}

/** The name to show for an Expense's Category: a Custom Category's current name. */
export function categoryName(group: Pick<GroupSnapshot, "customCategories">, category: string): string {
  return group.customCategories?.find((c) => c.id === category)?.name ?? category;
}

export type ParseCategoryResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validates the name of a Custom Category being added, or renamed when
 * `categoryId` is given. No two Categories in a Group may share a name,
 * ignoring case.
 */
export function parseCategoryName(
  raw: string,
  group: Pick<GroupSnapshot, "customCategories">,
  categoryId?: string,
): ParseCategoryResult {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name === "") return { ok: false, error: "Enter the Category's name." };
  if (name.length > MAX_CATEGORY_NAME_LENGTH)
    return { ok: false, error: `Keep the name to ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.` };
  const clash = categoryOptions(group).find(
    (o) => o.id !== categoryId && o.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) return { ok: false, error: `${clash.name} is already a Category.` };
  return { ok: true, value: name };
}

/** Why a Custom Category can't be deleted, or `null` while no Expense uses it. */
export function categoryDeletionBlock(group: GroupSnapshot, categoryId: string): string | null {
  const used = group.expenses.filter((e) => e.category === categoryId).length;
  if (used === 0) return null;
  const name = categoryName(group, categoryId);
  return used === 1
    ? `1 Expense uses ${name}. Move it to another Category first.`
    : `${used} Expenses use ${name}. Move them to another Category first.`;
}
