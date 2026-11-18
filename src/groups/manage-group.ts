import {
  groupDeletionBlock,
  memberRemovalBlock,
  parseGroupDetails,
  parseNewMember,
  type NewGroupFields,
} from "@/domain";
import type { GroupRepository } from "./group-repository";

/** What a Group management control shows after it acts. */
export type ManageResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof NewGroupFields | "form", string>> };

/** Who is acting: a signed-in User, or a Guest (`userId` undefined). */
export interface Visitor {
  userId: string | undefined;
}

/**
 * The Group Creator is the User who created the Group. A Guest's session
 * Groups have no Group Creator User, so the Guest counts as theirs.
 */
export function isGroupCreator(group: { creatorUserId?: string }, visitor: Visitor): boolean {
  return group.creatorUserId === visitor.userId;
}

const GROUP_GONE = "This Group is no longer available.";
const formError = (form: string): ManageResult => ({ ok: false, errors: { form } });

const text = (record: unknown, key: string): string => {
  const value = typeof record === "object" && record !== null ? (record as Record<string, unknown>)[key] : "";
  return typeof value === "string" ? value : "";
};

// Each operation re-checks its domain rule against the Group as stored now,
// so a stale or hand-crafted request can't get round what the UI hides.

/** Edits name, description and (while nothing is recorded) Group Currency. */
export async function updateGroupDetails(
  repo: GroupRepository,
  groupId: string,
  input: unknown,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const fields = { name: text(input, "name"), description: text(input, "description"), currency: text(input, "currency") };
  const parsed = parseGroupDetails(fields, group);
  if (!parsed.ok) return parsed;
  return (await repo.updateGroup(groupId, parsed.value)) ? { ok: true } : formError(GROUP_GONE);
}

/** Adds a Name-only Member. */
export async function addMember(repo: GroupRepository, groupId: string, name: unknown): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const parsed = parseNewMember(typeof name === "string" ? name : "", group);
  if (!parsed.ok) return { ok: false, errors: { name: parsed.error } };
  return (await repo.addMember(groupId, parsed.value.name)) ? { ok: true } : formError(GROUP_GONE);
}

/** Makes a Member with a zero Balance a Former Member. */
export async function removeMember(
  repo: GroupRepository,
  groupId: string,
  memberId: string,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = memberRemovalBlock(group, memberId);
  if (block) return formError(block);
  return (await repo.removeMember(groupId, memberId)) ? { ok: true } : formError(GROUP_GONE);
}

/** Deletes a Settled Up Group, for its Group Creator only. */
export async function deleteGroup(
  repo: GroupRepository,
  groupId: string,
  visitor: Visitor,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupDeletionBlock(group, { isCreator: isGroupCreator(group, visitor) });
  if (block) return formError(block);
  return (await repo.deleteGroup(groupId)) ? { ok: true } : formError(GROUP_GONE);
}

/** The Group management operations a Group page can call, bound to one Group. */
export interface GroupManagement {
  updateDetails(fields: NewGroupFields): Promise<ManageResult>;
  addMember(name: string): Promise<ManageResult>;
  removeMember(memberId: string): Promise<ManageResult>;
  deleteGroup(): Promise<ManageResult>;
}
