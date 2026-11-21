import {
  currencyChangeBlock,
  editingModeBlock,
  groupDeletionBlock,
  groupManagementBlock,
  isEditingMode,
  isPendingMember,
  memberEmailBlock,
  memberRemovalBlock,
  parseCurrencyChange,
  parseGroupDetails,
  parseMemberEmail,
  parseNewMember,
  type NewGroupFields,
} from "@/domain";
import type { CurrencyChangeFields, EditingMode, GroupDetails, Member, Visitor } from "@/domain";
import type { GroupRepository } from "./group-repository";
import type { MemberNotifier } from "./member-notifier";

/** What a Group management control shows after it acts. */
export type ManageResult =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<Record<keyof NewGroupFields | keyof NewMemberFields | "to" | "rate" | "form", string>>;
    };

/** What the Add Member form sends; a blank email adds a Name-only Member. */
export interface NewMemberFields {
  name: string;
  email: string;
}

const GROUP_GONE = "This Group is no longer available.";
const formError = (form: string): Extract<ManageResult, { ok: false }> => ({ ok: false, errors: { form } });

const text = (record: unknown, key: string): string => {
  const value = typeof record === "object" && record !== null ? (record as Record<string, unknown>)[key] : "";
  return typeof value === "string" ? value : "";
};

/**
 * Sends a Pending Member a new Invitation, recording it as sent once it is.
 * Sending can fail without undoing whatever came before, so a failure is
 * only reported, and the Pending Member shows its Invitation wasn't sent.
 * Answers whether it was sent, or `undefined` if none was due: the Member
 * isn't Pending, or there is no notifier (a Guest).
 */
async function invite(
  repo: GroupRepository,
  notify: MemberNotifier | undefined,
  group: { id: string; name: string },
  member: Member,
): Promise<boolean | undefined> {
  if (!notify || !member.email || !isPendingMember(member)) return undefined;
  try {
    const token = await repo.issueInvitation(group.id, member.id);
    if (!token) return false;
    await notify.invited({ groupId: group.id, groupName: group.name, email: member.email, token });
    await repo.recordInvitationSent(group.id, token);
    return true;
  } catch (error) {
    console.error(`Couldn't send an Invitation to Member ${member.id} of Group ${group.id}`, error);
    return false;
  }
}

/** On success, whether a Pending Member's Invitation was sent, when one was due. */
const invitationOutcome = (sent: boolean | undefined) => (sent === undefined ? {} : { invitationSent: sent });

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
  if (!notify || !member.email || !member.userId) return;
  try {
    await notify.added({ groupId: group.id, groupName: group.name, email: member.email });
  } catch (error) {
    console.error(`Couldn't tell ${member.email} they were added to Group ${group.id}`, error);
  }
}

/** Edits the Group's name and description. */
export async function updateGroupDetails(
  repo: GroupRepository,
  groupId: string,
  input: unknown,
  visitor: Visitor,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "edit-details");
  if (block) return formError(block);
  const parsed = parseGroupDetails({ name: text(input, "name"), description: text(input, "description") });
  if (!parsed.ok) return parsed;
  return (await repo.updateGroup(groupId, parsed.value)) ? { ok: true } : formError(GROUP_GONE);
}

/**
 * Changes the Group Currency, for its Group Creator only, converting every
 * Expense and Settlement at the one rate given: the rate the preview of the
 * new Balances was worked out with, so what is confirmed is what was shown.
 */
export async function changeCurrency(
  repo: GroupRepository,
  groupId: string,
  input: unknown,
  visitor: Visitor,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = currencyChangeBlock(group, visitor);
  if (block) return formError(block);
  const fields: CurrencyChangeFields = { from: text(input, "from"), to: text(input, "to"), rate: text(input, "rate") };
  const parsed = parseCurrencyChange(fields, group);
  if (!parsed.ok) return parsed;
  if (await repo.changeGroupCurrency(groupId, parsed.value)) return { ok: true };
  // Someone changed it in the meantime, or the Group has gone.
  const now = await repo.getGroup(groupId);
  const stale = now && parseCurrencyChange(fields, now);
  return stale && !stale.ok ? stale : formError(GROUP_GONE);
}

/**
 * What giving a Member an email answers: on success, when a Pending Member
 * was due an Invitation, whether it was sent, so a failure is told at once.
 */
export type SetMemberEmailResult = { ok: true; invitationSent?: boolean } | Extract<ManageResult, { ok: false }>;

/**
 * What adding a Member answers: on success, the name the Member is shown
 * under, which for a Linked Member is their User's, not the one typed, and,
 * as for giving one an email, whether a due Invitation was sent.
 */
export type AddMemberResult =
  | { ok: true; name: string; invitationSent?: boolean }
  | Extract<ManageResult, { ok: false }>;

/**
 * Adds a Member: Name-only, or by email, which links a User who has verified
 * it and otherwise makes a Pending Member. `notify` sends a Pending Member an
 * Invitation and tells a linked User they were added.
 */
export async function addMember(
  repo: GroupRepository,
  groupId: string,
  input: unknown,
  visitor: Visitor,
  notify?: MemberNotifier,
): Promise<AddMemberResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "add-member");
  if (block) return formError(block);
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
  const sent = await invite(repo, notify, group, added);
  await notifyAdded(notify, group, added);
  return { ok: true, name: added.name, ...invitationOutcome(sent) };
}

/**
 * Gives a Name-only or Pending Member an email, keeping their history; a
 * User who has verified it is linked straight away and `notify` tells them;
 * otherwise `notify` sends the Pending Member an Invitation.
 */
export async function setMemberEmail(
  repo: GroupRepository,
  groupId: string,
  memberId: string,
  rawEmail: unknown,
  visitor: Visitor,
  notify?: MemberNotifier,
): Promise<SetMemberEmailResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "set-member-email") ?? memberEmailBlock(group, memberId);
  if (block) return formError(block);
  const email = parseMemberEmail(typeof rawEmail === "string" ? rawEmail : "", group, memberId);
  if (!email.ok) return { ok: false, errors: { email: email.error } };
  if (!email.value) return { ok: false, errors: { email: "Enter the Member's email address." } };
  const updated = await repo.setMemberEmail(groupId, memberId, email.value);
  if (!updated) return formError(GROUP_GONE);
  const sent = await invite(repo, notify, group, updated);
  await notifyAdded(notify, group, updated);
  return { ok: true, ...invitationOutcome(sent) };
}

/**
 * Sends a Pending Member a new Invitation, so the link in any earlier one
 * stops working.
 */
export async function resendInvitation(
  repo: GroupRepository,
  groupId: string,
  memberId: string,
  visitor: Visitor,
  notify: MemberNotifier,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "resend-invitation");
  if (block) return formError(block);
  const member = group.members.find((m) => m.id === memberId);
  if (!member || !isPendingMember(member)) return formError("Only a Pending Member is sent an Invitation.");
  return (await invite(repo, notify, group, member))
    ? { ok: true }
    : formError("The Invitation couldn't be sent. Try again in a moment.");
}

/** Makes a Member with a zero Balance a Former Member. */
export async function removeMember(
  repo: GroupRepository,
  groupId: string,
  memberId: string,
  visitor: Visitor,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = groupManagementBlock(group, visitor, "remove-member") ?? memberRemovalBlock(group, memberId);
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
  const block = groupDeletionBlock(group, visitor);
  if (block) return formError(block);
  return (await repo.deleteGroup(groupId)) ? { ok: true } : formError(GROUP_GONE);
}

/**
 * Sets who may edit or delete the Group's Expenses and Settlements, for its
 * Group Creator only.
 */
export async function setEditingMode(
  repo: GroupRepository,
  groupId: string,
  mode: unknown,
  visitor: Visitor,
): Promise<ManageResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const block = editingModeBlock(group, visitor);
  if (block) return formError(block);
  if (!isEditingMode(mode)) return formError("Choose an Editing Mode.");
  return (await repo.setEditingMode(groupId, mode)) ? { ok: true } : formError(GROUP_GONE);
}

/** The Group management operations a Group page can call, bound to one Group. */
export interface GroupManagement {
  updateDetails(fields: GroupDetails): Promise<ManageResult>;
  changeCurrency(fields: CurrencyChangeFields): Promise<ManageResult>;
  addMember(fields: NewMemberFields): Promise<AddMemberResult>;
  /** Absent for Guests, who have no Users to link Members to by email. */
  setMemberEmail?: (memberId: string, email: string) => Promise<SetMemberEmailResult>;
  /** Absent for Guests, whose Pending Members are never sent an Invitation. */
  resendInvitation?: (memberId: string) => Promise<ManageResult>;
  removeMember(memberId: string): Promise<ManageResult>;
  setEditingMode(mode: EditingMode): Promise<ManageResult>;
  deleteGroup(): Promise<ManageResult>;
}
