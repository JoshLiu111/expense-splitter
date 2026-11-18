import type { Expense, GroupSnapshot, Member, NewExpense, NewGroup } from "@/domain";

/**
 * Persistence for the Groups one visitor can see: a Guest's session Groups,
 * or a User's Groups in Postgres. Balances are never stored (ADR 0004).
 */
export interface GroupRepository {
  /** Groups visible to this visitor, oldest first. */
  listGroups(): Promise<GroupSnapshot[]>;
  /** The Group, or `null` if it doesn't exist or isn't visible here. */
  getGroup(id: string): Promise<GroupSnapshot | null>;
  /** Creates a Group whose only Member is the visitor creating it. */
  createGroup(input: NewGroup): Promise<GroupSnapshot>;
  /** Records an Expense; `null` if the Group isn't visible here. */
  addExpense(groupId: string, expense: NewExpense): Promise<Expense | null>;
  /**
   * Replaces an Expense's fields and Shares, keeping its id and creation
   * time; `null` if the Expense isn't in that visible Group.
   */
  updateExpense(groupId: string, expenseId: string, expense: NewExpense): Promise<Expense | null>;
  /** Deletes an Expense; `false` if it isn't in that visible Group. */
  deleteExpense(groupId: string, expenseId: string): Promise<boolean>;
  /** Replaces a Group's name, description and Group Currency; `null` if not visible. */
  updateGroup(id: string, details: NewGroup): Promise<GroupSnapshot | null>;
  /**
   * Adds a Name-only Member at the end of the Group, with an avatar colour
   * of its own; `null` if the Group isn't visible here.
   */
  addMember(groupId: string, name: string): Promise<Member | null>;
  /** Makes a Member a Former Member; `false` if they aren't in that visible Group. */
  removeMember(groupId: string, memberId: string): Promise<boolean>;
  /** Deletes a Group and everything in it; `false` if it isn't visible here. */
  deleteGroup(id: string): Promise<boolean>;
}

/**
 * The avatar colour for a new Member: the first palette colour no Member of
 * the Group has yet, cycling once the palette runs out. Stored with the
 * Member, so their colour stays the same everywhere.
 */
export function nextAvatarColor(members: readonly Pick<Member, "avatarColor">[]): string {
  const used = new Set(members.map((m) => m.avatarColor.toUpperCase()));
  return (
    AVATAR_COLORS.find((color) => !used.has(color)) ??
    AVATAR_COLORS[members.length % AVATAR_COLORS.length]
  );
}

/** Colours for new Members' initials avatars, from the sample data palette. */
export const AVATAR_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#EF4444",
  "#14B8A6",
  "#6366F1",
  "#A855F7",
  "#F43F5E",
] as const;
