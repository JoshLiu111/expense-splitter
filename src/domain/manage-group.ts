import { computeLedger } from "./ledger";
import { parseNewGroup, type NewGroupFields, type ParseResult } from "./new-group";
import type { Expense, GroupSnapshot, Member } from "./types";

export const MAX_MEMBER_NAME_LENGTH = 60;

/** Why the Group Currency can't change, or `null` while it still can. */
export function currencyLock(group: GroupSnapshot): string | null {
  return group.expenses.length > 0 || group.settlements.length > 0
    ? "The Group Currency can't change once the Group has Expenses or Settlements."
    : null;
}

/**
 * Validates edits to a Group's name, description and Group Currency. The
 * Group Currency is fixed once the Group has any Expense or Settlement.
 */
export function parseGroupDetails(fields: NewGroupFields, group: GroupSnapshot): ParseResult {
  const parsed = parseNewGroup(fields);
  const lock = currencyLock(group);
  const currencyChanged = (parsed.ok ? parsed.value.currency : fields.currency.trim()) !== group.currency;
  if (!lock || !currencyChanged) return parsed;
  return { ok: false, errors: { ...(parsed.ok ? {} : parsed.errors), currency: lock } };
}

/** The Members taking part in the Group now, in Group order: not Former Members. */
export function currentMembers(group: GroupSnapshot): Member[] {
  return group.members.filter((m) => !m.former);
}

/**
 * The Members who can pay or share an Expense: current Members, plus, when
 * editing, any Former Members already on it. In Group order.
 */
export function selectableMembers(group: GroupSnapshot, expense: Expense | null | undefined): Member[] {
  const onExpense = new Set(expense ? [expense.payerId, ...expense.shares.map((s) => s.memberId)] : []);
  return group.members.filter((m) => !m.former || onExpense.has(m.id));
}

export type ParseMemberResult = { ok: true; value: { name: string } } | { ok: false; error: string };

/** Validates the name of a Name-only Member about to be added. */
export function parseNewMember(rawName: string, group: GroupSnapshot): ParseMemberResult {
  const name = rawName.trim();
  if (name === "") return { ok: false, error: "Enter the Member's name." };
  if (name.length > MAX_MEMBER_NAME_LENGTH)
    return { ok: false, error: `Keep the name to ${MAX_MEMBER_NAME_LENGTH} characters or fewer.` };
  const clash = currentMembers(group).find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (clash) return { ok: false, error: `${clash.name} is already a Member of this Group.` };
  return { ok: true, value: { name } };
}

/** A plausible email address: something@something.tld, no spaces. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParseEmailResult = { ok: true; value: string | undefined } | { ok: false; error: string };

/**
 * Validates the email a Member is added or linked by; blank means none.
 * Lower-cased so it matches a User's email. No two Members of a Group,
 * Former ones included, share an email, so one User is linked to at most
 * one Member per Group. `memberId` is the Member being given the email.
 */
export function parseMemberEmail(raw: string, group: GroupSnapshot, memberId?: string): ParseEmailResult {
  const email = raw.trim().toLowerCase();
  if (email === "") return { ok: true, value: undefined };
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Enter an email address like name@example.com." };
  const clash = group.members.find((m) => m.id !== memberId && m.email?.toLowerCase() === email);
  if (clash) return { ok: false, error: `${clash.name} already has that email in this Group.` };
  return { ok: true, value: email };
}

/**
 * Why a Member can't be given an email, or `null` if they can: Name-only
 * and Pending Members can; a Linked Member's email is their User's.
 */
export function memberEmailBlock(group: GroupSnapshot, memberId: string): string | null {
  const member = group.members.find((m) => m.id === memberId);
  if (!member) return "That Member isn't in this Group.";
  if (member.former) return `${member.name} has been removed from this Group.`;
  if (member.userId) return `${member.name} is already a Linked Member.`;
  return null;
}

/** Why a Member can't be removed from the Group, or `null` if they can. */
export function memberRemovalBlock(group: GroupSnapshot, memberId: string): string | null {
  const member = group.members.find((m) => m.id === memberId);
  if (!member) return "That Member isn't in this Group.";
  if (member.former) return `${member.name} has already been removed.`;
  if (member.userId && member.userId === group.creatorUserId)
    return `${member.name} is the Group Creator and can't be removed.`;
  if (currentMembers(group).length === 1) return "A Group needs at least one Member.";
  const balance = computeLedger(group).balances.find((b) => b.memberId === memberId)?.amount ?? 0;
  if (balance !== 0) return `${member.name} can't be removed until their Balance is zero.`;
  return null;
}

/**
 * Why the visitor can't delete the Group, or `null` if they can: only the
 * Group Creator may, and only once the Group is Settled Up.
 */
export function groupDeletionBlock(
  group: GroupSnapshot,
  visitor: { isCreator: boolean },
): string | null {
  if (!visitor.isCreator) {
    const creator = group.members.find((m) => m.userId && m.userId === group.creatorUserId);
    return creator
      ? `Only the Group Creator, ${creator.name}, can delete this Group.`
      : "Only the Group Creator can delete this Group.";
  }
  if (!computeLedger(group).settledUp)
    return "Everyone must be Settled Up before this Group can be deleted.";
  return null;
}
