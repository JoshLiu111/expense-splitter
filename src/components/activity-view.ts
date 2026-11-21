import {
  categoryName,
  inGroupCurrency,
  memberLabel,
  formatMoney,
  SPLIT_TYPE_LABELS,
  changedExpenseFields,
  EDITING_MODE_LABELS,
  groupCurrenciesThen,
  type ActivityChange,
  type ActivityEntry,
  type Expense,
  type ExpenseField,
  type GroupSnapshot,
  type Member,
  type Share,
} from "@/domain";
import { formatCalendarDate, formatSettlementAmount } from "@/lib/format";

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
  /** The Member who made the change, for their avatar; absent for the Guest or a Member no longer in the Group. */
  actorMember?: Member;
  /** What kind of change it was. */
  kind: ActivityChange["kind"];
  /** What was changed: an Expense, Settlement, Member or Custom Category, or the Group itself. */
  subject: { kind: "expense" | "settlement" | "member" | "category" | "group"; id: string };
  /**
   * The entry as one sentence: the actor, `action`, the `title` (shown
   * strong; empty when there is none) and then `rest`, e.g. "Alex added the
   * Expense Dinner" or "Alex removed Sam from the Group".
   */
  action: string;
  /**
   * The Expense's description, who paid whom for a Settlement, the Member's
   * or Custom Category's name as it was, or the new Group Currency or
   * Editing Mode.
   */
  title: string;
  /** What follows the title, if anything. */
  rest?: string;
  /** What an added or deleted item was. */
  details: { label: string; value: string; money?: true }[];
  /** For an edit: only the fields that changed. */
  changes: FieldChange[];
}

/** What each change reads as between the actor and the title, and after it. */
const SENTENCES: { [K in ActivityChange["kind"]]: (change: Extract<ActivityChange, { kind: K }>) => [action: string, rest?: string] } = {
  "expense-added": () => ["added the Expense"],
  "expense-edited": () => ["edited the Expense"],
  "expense-deleted": () => ["deleted the Expense"],
  "settlement-added": () => ["recorded a Settlement:"],
  "settlement-deleted": () => ["deleted a Settlement:"],
  "member-added": () => ["added", "to the Group"],
  "member-invited": (c) => ["sent", `${c.resent ? "a new" : "an"} Invitation at ${c.email}`],
  "member-joined": () => ["joined the Group"],
  "member-email-set": (c) => ["gave", `the email ${c.email}`],
  "member-removed": () => ["removed", "from the Group"],
  "group-details-edited": () => ["edited the Group’s details"],
  "currency-changed": (c) => [`changed the Group Currency from ${c.from} to`, `at 1 ${c.from} = ${c.rate} ${c.to}`],
  "category-added": () => ["added the Category"],
  "category-renamed": (c) => ["renamed the Category", `to ${c.after.name}`],
  "category-deleted": () => ["deleted the Category"],
  "editing-mode-changed": (c) => [`changed the Editing Mode from ${EDITING_MODE_LABELS[c.before]} to`],
};

function sentence(change: ActivityChange): { action: string; rest?: string } {
  const [action, rest] = (SENTENCES[change.kind] as (c: ActivityChange) => [string, string?])(change);
  return rest ? { action, rest } : { action };
}

/** Who made the Guest's own changes. */
const GUEST_ACTOR = "You";

/**
 * Shows Activity entries, given newest first as `listActivity` lists them.
 * Each entry's amounts are read in the Group Currency it was recorded in,
 * which a later Group Currency change doesn't rewrite (ADR 0010).
 */
export function activityItems(entries: readonly ActivityEntry[], current: GroupSnapshot): ActivityItem[] {
  const actorOf = (memberId: string | undefined) => {
    if (memberId === undefined) return { actor: GUEST_ACTOR };
    const member = current.members.find((m) => m.id === memberId);
    return member ? { actor: memberLabel(member), actorMember: member } : { actor: "Unknown member" };
  };
  const currencies = groupCurrenciesThen(entries, current.currency);
  return entries.map((entry, index): ActivityItem => {
    const { change } = entry;
    // The Group as this entry's Locked Rates convert into.
    const group = { ...current, currency: currencies[index] };
    const shown = {
      id: entry.id,
      at: entry.at,
      ...actorOf(entry.actorMemberId),
      kind: change.kind,
      ...sentence(change),
    };
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
            // Both amounts in another Settlement Currency: "¥4,478 ≈ $30.00".
            { label: "Amount", value: formatSettlementAmount(change.settlement, group.currency), money: true },
            ...(change.settlement.currency !== group.currency
              ? [{ label: "Locked Rate", value: rateText(change.settlement) }]
              : []),
            { label: "Date", value: formatCalendarDate(change.settlement.date) },
          ],
          changes: [],
        };
      case "member-joined":
      case "member-added":
      case "member-invited":
      case "member-email-set":
      case "member-removed":
        return {
          ...shown,
          subject: { kind: "member", id: change.member.id },
          // Named as they were then, so a later rename doesn't rewrite the
          // past; whoever joined is the actor, so names no one else.
          title: change.kind === "member-joined" ? "" : change.member.name,
          details: [],
          changes: [],
        };
      case "group-details-edited":
        return {
          ...shown,
          subject: { kind: "group", id: group.id },
          title: "",
          details: [],
          changes: [
            ...(change.before.name !== change.after.name
              ? [{ label: "Name", before: change.before.name, after: change.after.name }]
              : []),
            ...(change.before.description !== change.after.description
              ? [{ label: "Description", before: change.before.description || "None", after: change.after.description || "None" }]
              : []),
          ],
        };
      case "currency-changed":
        return { ...shown, subject: { kind: "group", id: group.id }, title: change.to, details: [], changes: [] };
      case "editing-mode-changed":
        return {
          ...shown,
          subject: { kind: "group", id: group.id },
          title: EDITING_MODE_LABELS[change.after],
          details: [],
          changes: [],
        };
      case "category-added":
      case "category-deleted":
        return { ...shown, subject: { kind: "category", id: change.category.id }, title: change.category.name, details: [], changes: [] };
      case "category-renamed":
        // Named as it was, then as it became: a later rename doesn't rewrite either.
        return { ...shown, subject: { kind: "category", id: change.before.id }, title: change.before.name, details: [], changes: [] };
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

/** A Locked Rate as shown, marked when typed by hand. */
function rateText(record: Pick<Expense, "lockedRate" | "manualRate">): string {
  return record.manualRate ? `${record.lockedRate} (manual)` : record.lockedRate;
}

/** How each changed field shows, keyed by the domain's list. */
const FIELDS: Record<Exclude<ExpenseField, "shares">, [label: string, show: Show, money?: true]> = {
  description: ["Description", (e) => e.description],
  amount: ["Amount", (e) => formatMoney(e.amount, e.currency), true],
  lockedRate: ["Locked Rate", rateText],
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
