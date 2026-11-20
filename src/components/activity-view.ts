import {
  categoryName,
  inGroupCurrency,
  memberLabel,
  formatMoney,
  SPLIT_TYPE_LABELS,
  type ActivityEntry,
  type Expense,
  type GroupSnapshot,
} from "@/domain";
import { formatCalendarDate } from "@/lib/format";

/** One field an edit changed, as shown. */
export interface FieldChange {
  label: string;
  before: string;
  after: string;
  /** A monetary figure, shown in the Amount style. */
  money?: true;
}

/** An Activity entry as shown. */
export interface ActivityItem {
  id: string;
  /** ISO timestamp of the change. */
  at: string;
  actor: string;
  action: "added" | "edited" | "deleted";
  /** The Expense or Settlement changed. */
  subject: { kind: "expense" | "settlement"; id: string };
  /** The Expense's description, or who paid whom for a Settlement. */
  title: string;
  /** What an added or deleted item was. */
  details: { label: string; value: string; money?: true }[];
  /** For an edit: only the fields that changed. */
  changes: FieldChange[];
}

/** Who made the Guest's own changes. */
const GUEST_ACTOR = "You";

/** Shows Activity entries, in the order given. */
export function activityItems(entries: readonly ActivityEntry[], group: GroupSnapshot): ActivityItem[] {
  const actorOf = (memberId: string | undefined) => {
    if (memberId === undefined) return GUEST_ACTOR;
    const member = group.members.find((m) => m.id === memberId);
    return member ? memberLabel(member) : "Unknown member";
  };
  return entries.map((entry): ActivityItem => {
    const { change } = entry;
    const shown = { id: entry.id, at: entry.at, actor: actorOf(entry.actorMemberId) };
    switch (change.kind) {
      case "expense-added":
      case "expense-deleted":
        return {
          ...shown,
          action: change.kind === "expense-added" ? "added" : "deleted",
          subject: { kind: "expense", id: change.expense.id },
          title: change.expense.description,
          details: [
            { label: "Amount", value: formatMoney(change.expense.amount, change.expense.currency), money: true },
            { label: "Payer", value: nameOf(group, change.expense.payerId) },
            { label: "Date", value: formatCalendarDate(change.expense.date) },
          ],
          changes: [],
        };
      case "expense-edited":
        return {
          ...shown,
          action: "edited",
          subject: { kind: "expense", id: change.after.id },
          title: change.after.description,
          details: [],
          changes: expenseChanges(change.before, change.after, group),
        };
      case "settlement-added":
      case "settlement-deleted":
        return {
          ...shown,
          action: change.kind === "settlement-added" ? "added" : "deleted",
          subject: { kind: "settlement", id: change.settlement.id },
          title: `${nameOf(group, change.settlement.fromId)} paid ${nameOf(group, change.settlement.toId)}`,
          details: [
            // Always in the Group Currency (ADR 0003).
            { label: "Amount", value: formatMoney(change.settlement.amount, group.currency), money: true },
            { label: "Date", value: formatCalendarDate(change.settlement.date) },
          ],
          changes: [],
        };
    }
  });
}

/**
 * The fields an edit changed, in the Expense form's order, then each Member
 * whose Share changed, in Group order: Shares are in Group Currency at each
 * version's Locked Rate, so a new rate shows as the Shares it moved.
 */
function expenseChanges(before: Expense, after: Expense, group: GroupSnapshot): FieldChange[] {
  type Field = [label: string, show: (e: Expense) => string, money?: true];
  const fields: Field[] = [
    ["Description", (e) => e.description],
    ["Amount", (e) => formatMoney(e.amount, e.currency), true],
    ["Locked Rate", (e) => e.lockedRate],
    ["Payer", (e) => nameOf(group, e.payerId)],
    ["Split Type", (e) => SPLIT_TYPE_LABELS[e.splitType]],
    ["Date", (e) => formatCalendarDate(e.date)],
    ["Category", (e) => categoryName(group, e.category)],
    ["Notes", (e) => e.notes || "None"],
  ];
  const shareOf = (expense: Expense, memberId: string) =>
    inGroupCurrency(expense, group.currency).lines.find((l) => l.memberId === memberId)?.groupAmount ?? 0;
  const shares: Field[] = group.members.map((m) => [
    `${m.name}’s Share`,
    (e) => formatMoney(shareOf(e, m.id), group.currency),
    true,
  ]);
  return [...fields, ...shares]
    .map(([label, show, money]): FieldChange => ({
      label,
      before: show(before),
      after: show(after),
      ...(money ? { money } : {}),
    }))
    .filter((c) => c.before !== c.after);
}

// Former Members stay in the Group, so every id resolves.
function nameOf(group: GroupSnapshot, memberId: string): string {
  return group.members.find((m) => m.id === memberId)?.name ?? "Unknown member";
}
