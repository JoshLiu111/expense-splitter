import type {
  ActivityEntry,
  CustomCategory,
  Expense,
  GroupSnapshot,
  Member,
  NewExpense,
  NewGroup,
  NewSettlement,
  Settlement,
} from "@/domain";

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
  /** Records a Settlement; `null` if the Group isn't visible here. */
  addSettlement(groupId: string, settlement: NewSettlement): Promise<Settlement | null>;
  /** Deletes a Settlement; `false` if it isn't in that visible Group. */
  deleteSettlement(groupId: string, settlementId: string): Promise<boolean>;
  /** Replaces a Group's name, description and Group Currency; `null` if not visible. */
  updateGroup(id: string, details: NewGroup): Promise<GroupSnapshot | null>;
  /**
   * Adds a Member at the end of the Group, with an avatar colour of its own;
   * `null` if the Group isn't visible here. Without an email it is Name-only;
   * with one, it is linked to the User who has verified that email, or else
   * a Pending Member.
   */
  addMember(groupId: string, member: NewMember): Promise<Member | null>;
  /**
   * Gives a Member a (lower-cased) email, linking them as `addMember` does
   * and keeping their history; `null` if they aren't in that visible Group.
   */
  setMemberEmail(groupId: string, memberId: string, email: string): Promise<Member | null>;
  /** Makes a Member a Former Member; `false` if they aren't in that visible Group. */
  removeMember(groupId: string, memberId: string): Promise<boolean>;
  /** Adds a Custom Category at the end of the Group's; `null` if the Group isn't visible here. */
  addCategory(groupId: string, name: string): Promise<CustomCategory | null>;
  /**
   * Renames a Custom Category; Expenses keep it, under the new name. `null`
   * if it isn't in that visible Group.
   */
  renameCategory(groupId: string, categoryId: string, name: string): Promise<CustomCategory | null>;
  /** Deletes a Custom Category; `false` if it isn't in that visible Group. */
  deleteCategory(groupId: string, categoryId: string): Promise<boolean>;
  /**
   * The Group's Activity, newest first; `null` if the Group isn't visible
   * here. Every change above to an Expense or Settlement records an entry.
   */
  listActivity(groupId: string): Promise<ActivityEntry[] | null>;
  /** Deletes a Group and everything in it, Activity too; `false` if it isn't visible here. */
  deleteGroup(id: string): Promise<boolean>;
}

/** A Member about to be added; `email` is already validated and lower-cased. */
export interface NewMember {
  name: string;
  email?: string;
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
