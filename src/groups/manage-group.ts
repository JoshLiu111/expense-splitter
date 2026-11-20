import {
  groupDeletionBlock,
  memberEmailBlock,
  memberRemovalBlock,
  parseGroupDetails,
  parseMemberEmail,
  parseNewMember,
  type NewGroupFields,
} from "@/domain";
import type { Member } from "@/domain";
import type { GroupRepository } from "./group-repository";
import type { MemberNotifier } from "./member-notifier";

/** What a Group management control shows after it acts. */
export type ManageResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof NewGroupFields | keyof NewMemberFields | "form", string>> };

/** What the Add Member form sends; a blank email adds a Name-only Member. */
export interface NewMemberFields {
  name: string;
  email: string;
}

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
const formError = (form: string): Extract<ManageResult, { ok: false }> => ({ ok: false, errors: { form } });

const text = (record: unknown, key: string): string => {
  const value = typeof record === "object" && record !== null ? (record as Record<string, unknown>)[key] : "";
  return typeof value === "string" ? value : "";
};

// Each operation re-checks its domain rule against the Group as stored now,
// so a stale or hand-crafted request can't get round what the UI hides.

/**
 * Tells the person behind a Member just given an email that they were added:
 * a Linked Member's User gets the "added" notification. Sending can fail
 * without undoing the add, so a failure is only reported.
 */
async function notifyAdded(
  notify: MemberNotifier | undefined,
  group: { id: string; name: string },
  member: Member,
): Promise<void> {
  if (!notify?.added || !member.email || !member.userId) return;
  try {
    await notify.added({ groupId: group.id, groupName: group.name, email: member.email, inviterName: notify.inviterName });
  } catch (error) {
    console.error(`Couldn't tell ${member.email} they were added to Group ${group.id}`, error);
  }
}

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

/**
 * What adding a Member answers: on success, the name the Member is shown
 * under, which for a Linked Member is their User's, not the one typed.
 */
export type AddMemberResult = { ok: true; name: string } | Extract<ManageResult, { ok: false }>;

/**
 * Adds a Member: Name-only, or by email, which links a User who has verified
 * it and otherwise makes a Pending Member. `notify` tells a linked User they
 * were added.
 */
export async function addMember(
  repo: GroupRepository,
  groupId: string,
  input: unknown,
  notify?: MemberNotifier,
): Promise<AddMemberResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const name = parseNewMember(text(input, "name"), group);
  const email = parseMemberEmail(text(input, "email"), group);
  if (!name.ok || !email.ok)
    return {
      ok: false,
      errors: { ...(name.ok ? {} : { name: name.error }), ...(email.ok ? {} : { email: email.error }) },
    };
  const added = await repo.addMember(groupId, {
    name: name.value.name,
    ...(email.value ? { email: email.value } : {}),
  });
  if (!added) return formError(GROUP_GONE);
  await notifyAdded(notify, group, added);
  return { ok: true, name: added.name };
}

/**
 * Gives a Name-only or Pending Member an email, keeping their history; a
 * User who has verified it is linked straight away, and `notify` tells them.
 */
export async function setMemberEmail(
  repo: GroupRepository,
  groupId: string,
  memberId: string,
  rawEmail: unknown,
  notify?: MemberNotifier,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = memberEmailBlock(group, memberId);
  if (block) return formError(block);
  const email = parseMemberEmail(typeof rawEmail === "string" ? rawEmail : "", group, memberId);
  if (!email.ok) return { ok: false, errors: { email: email.error } };
  if (!email.value) return { ok: false, errors: { email: "Enter the Member's email address." } };
  const updated = await repo.setMemberEmail(groupId, memberId, email.value);
  if (!updated) return formError(GROUP_GONE);
  await notifyAdded(notify, group, updated);
  return { ok: true };
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
  addMember(fields: NewMemberFields): Promise<AddMemberResult>;
  /** Absent for Guests, who have no Users to link Members to by email. */
  setMemberEmail?: (memberId: string, email: string) => Promise<ManageResult>;
  removeMember(memberId: string): Promise<ManageResult>;
  deleteGroup(): Promise<ManageResult>;
}
