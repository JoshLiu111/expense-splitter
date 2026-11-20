import {
  categoryName,
  inGroupCurrency,
  memberLabel,
  formatMoney,
  SPLIT_TYPE_LABELS,
  changedExpenseFields,
  type ActivityChange,
  type ActivityEntry,
  type Expense,
  type ExpenseField,
  type GroupSnapshot,
  type Share,
} from "@/domain";
import { formatCalendarDate } from "@/lib/format";

/** One field an edit changed, as shown. */
export interface FieldChange {
  label: string;
  before: string;
  after: string;
  /** A monetary figure, shown in the Amount style. */
  money?: true;
  /** Whose Share, percentage or ratio it is: names alone can repeat. */
  memberId?: string;
}

/** An Activity entry as shown. */
export interface ActivityItem {
  id: string;
  /** ISO timestamp of the change. */
  at: string;
  actor: string;
  /** What kind of change it was. */
  kind: ActivityChange["kind"];
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
    const shown = { id: entry.id, at: entry.at, actor: actorOf(entry.actorMemberId), kind: change.kind };
    switch (change.kind) {
      case "expense-added":
      case "expense-deleted":
        return {
          ...shown,
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
          subject: { kind: "expense", id: change.after.id },
          title: change.after.description,
          details: [],
          changes: expenseChanges(change.before, change.after, group),
        };
      case "settlement-added":
      case "settlement-deleted":
        return {
          ...shown,
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
 * The fields an edit changed (`changedExpenseFields`), in the Expense form's
 * order, then each Member whose Share changed, in Group order. Shares are in
 * Group Currency at each version's Locked Rate, so a new rate shows as the
 * Shares it moved. Beside a Member's Share go the percentage or ratio typed
 * for it, so a Split retyped to the same Shares still shows.
 */
function expenseChanges(before: Expense, after: Expense, group: GroupSnapshot): FieldChange[] {
  const changed = changedExpenseFields(before, after);
  const fields = changed.flatMap((field): FieldChange[] => {
    if (field === "shares") return [];
    const [label, show, money] = FIELDS[field];
    return [{ label, before: show(before, group), after: show(after, group), ...(money ? { money } : {}) }];
  });
  return [...fields, ...shareChanges(before, after, group, changed.includes("shares"))];
}

type Show = (e: Expense, group: GroupSnapshot) => string;

/** How each changed field shows, keyed by the domain's list. */
const FIELDS: Record<Exclude<ExpenseField, "shares">, [label: string, show: Show, money?: true]> = {
  description: ["Description", (e) => e.description],
  amount: ["Amount", (e) => formatMoney(e.amount, e.currency), true],
  lockedRate: ["Locked Rate", (e) => (e.manualRate ? `${e.lockedRate} (manual)` : e.lockedRate)],
  payer: ["Payer", (e, group) => nameOf(group, e.payerId)],
  splitType: ["Split Type", (e) => SPLIT_TYPE_LABELS[e.splitType]],
  date: ["Date", (e) => formatCalendarDate(e.date)],
  category: ["Category", (e, group) => categoryName(group, e.category)],
  notes: ["Notes", (e) => e.notes || "None"],
};

function shareChanges(before: Expense, after: Expense, group: GroupSnapshot, sharesChanged: boolean): FieldChange[] {
  const inGroup = (e: Expense) => inGroupCurrency(e, group.currency).lines;
  const [beforeLines, afterLines] = [inGroup(before), inGroup(after)];
  const shareOf = (e: Expense, memberId: string) => e.shares.find((s) => s.memberId === memberId);
  return group.members.flatMap((m): FieldChange[] => {
    const rows: FieldChange[] = [];
    const groupAmount = (lines: typeof beforeLines) => lines.find((l) => l.memberId === m.id)?.groupAmount ?? 0;
    const share = { before: shareOf(before, m.id), after: shareOf(after, m.id) };
    const [was, now] = [groupAmount(beforeLines), groupAmount(afterLines)];
    if (was !== now) {
      rows.push(money(`${m.name}’s Share`, formatMoney(was, group.currency), formatMoney(now, group.currency)));
    } else if (sharesChanged && (share.before?.amount ?? 0) !== (share.after?.amount ?? 0)) {
      // Moved in the Expense Currency by less than rounds to a Group minor unit.
      rows.push(
        money(
          `${m.name}’s Share`,
          formatMoney(share.before?.amount ?? 0, before.currency),
          formatMoney(share.after?.amount ?? 0, after.currency),
        ),
      );
    }
    if (sharesChanged) {
      const typed = (label: string, read: (s: Share | undefined) => string | undefined, suffix = "") => {
        const [b, a] = [read(share.before), read(share.after)];
        if (b !== a) rows.push({ label: `${m.name}’s ${label}`, before: b ? b + suffix : "None", after: a ? a + suffix : "None" });
      };
      typed("Percentage", (s) => s?.percentage, "%");
      typed("Ratio", (s) => s?.ratio);
    }
    return rows.map((row) => ({ ...row, memberId: m.id }));
  });
}

function money(label: string, before: string, after: string): FieldChange {
  return { label, before, after, money: true };
}

// Former Members stay in the Group, so every id resolves.
function nameOf(group: GroupSnapshot, memberId: string): string {
  return group.members.find((m) => m.id === memberId)?.name ?? "Unknown member";
}
