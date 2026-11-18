import type { GroupSnapshot, NewGroup } from "@/domain";

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
