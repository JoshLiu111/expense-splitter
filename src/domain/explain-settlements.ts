import { oldestFirst } from "./chronology";
import { computeLedger, inGroupCurrency, settlementInGroupCurrency } from "./ledger";
import type { SuggestedSettlement } from "./settle-up";
import type { CalendarDate, GroupSnapshot, MinorUnits } from "./types";

/** One Member owing another, in the Group Currency. */
export interface DebtEdge {
  fromId: string;
  toId: string;
  amount: MinorUnits;
}

/**
 * Part of what the paying Member owed, in the Group Currency: their Share of
 * an Expense someone else paid, or a Settlement they received.
 */
export interface SettlementSource {
  kind: "expense" | "settlement";
  /** The Expense's or Settlement's id. */
  id: string;
  /** The part of it this Suggested Settlement repays. */
  amount: MinorUnits;
  /** Everything the paying Member owed from it; `amount` when repaid whole. */
  full: MinorUnits;
}

export interface ExplainedSettlement extends SuggestedSettlement {
  /** Where the amount comes from; adds up to exactly `amount`. */
  sources: SettlementSource[];
}

export interface SettlementExplanation {
  /**
   * Before Debt Simplification: the net amount each Member owes each Member
   * they shared Expenses (or Settlements) with. Ordered by payer, then
   * recipient, in Group Member order.
   */
  before: DebtEdge[];
  /** After: Compute Ledger's Suggested Settlements, each with its sources. */
  suggestions: ExplainedSettlement[];
  /** Compute Ledger's Small Change, each with its sources. */
  smallChange: ExplainedSettlement[];
}

/**
 * Explain Settlements: why the Suggested Settlements are what they are.
 * Shows the pairwise debts Debt Simplification starts from, and traces each
 * payment back to the Expenses behind it.
 *
 * A paying Member's debts are their Shares of Expenses others paid (and any
 * Settlement they received). What they are owed in turn (Expenses they paid
 * for others, Settlements they made) first cancels the debts least related
 * to whom they now pay, oldest first. Each payment then takes from what is
 * left: debts to its recipient first, then the rest, largest first.
 */
export function explainSettlements(group: GroupSnapshot): SettlementExplanation {
  const ledger = computeLedger(group);
  const debts = debtsByMember(group);
  const payments = [...ledger.suggestions, ...ledger.smallChange];
  const sources = new Map<SuggestedSettlement, SettlementSource[]>();

  for (const debtor of new Set(payments.map((p) => p.fromId))) {
    const own = payments.filter((p) => p.fromId === debtor);
    const recipients = new Set(own.map((p) => p.toId));
    const { items, credit } = debts.get(debtor) ?? { items: [], credit: 0 };

    let left = credit;
    const cancelOrder = [
      ...items.filter((i) => !recipients.has(i.counterpartyId)),
      ...items.filter((i) => recipients.has(i.counterpartyId)),
    ];
    for (const item of cancelOrder) {
      const cancelled = Math.min(left, item.remaining);
      item.remaining -= cancelled;
      left -= cancelled;
    }

    for (const payment of own) {
      const order = [
        ...largestFirst(items.filter((i) => i.counterpartyId === payment.toId)),
        ...largestFirst(items.filter((i) => i.counterpartyId !== payment.toId)),
      ];
      let due = payment.amount;
      const taken: SettlementSource[] = [];
      for (const item of order) {
        if (due === 0) break;
        const amount = Math.min(due, item.remaining);
        if (amount === 0) continue;
        item.remaining -= amount;
        due -= amount;
        taken.push({ kind: item.kind, id: item.id, amount, full: item.full });
      }
      sources.set(payment, taken);
    }
  }

  const explain = (p: SuggestedSettlement) => ({ ...p, sources: sources.get(p) ?? [] });
  return {
    before: pairwiseDebts(group),
    suggestions: ledger.suggestions.map(explain),
    smallChange: ledger.smallChange.map(explain),
  };
}

interface DebtItem {
  kind: SettlementSource["kind"];
  id: string;
  /** Whom the debt is to: the Payer, or who paid the Settlement. */
  counterpartyId: string;
  full: MinorUnits;
  remaining: MinorUnits;
  date: CalendarDate;
  createdAt: string;
}

/** Per Member: what they owe others (oldest first), and what others owe them. */
function debtsByMember(group: GroupSnapshot): Map<string, { items: DebtItem[]; credit: MinorUnits }> {
  const result = new Map(group.members.map((m) => [m.id, { items: [] as DebtItem[], credit: 0 }]));
  const of = (id: string) => {
    if (!result.has(id)) result.set(id, { items: [], credit: 0 });
    return result.get(id)!;
  };

  for (const expense of group.expenses) {
    for (const line of inGroupCurrency(expense, group.currency).lines) {
      if (line.memberId === expense.payerId || line.groupAmount === 0) continue;
      of(line.memberId).items.push({
        kind: "expense",
        id: expense.id,
        counterpartyId: expense.payerId,
        full: line.groupAmount,
        remaining: line.groupAmount,
        date: expense.date,
        createdAt: expense.createdAt,
      });
      of(expense.payerId).credit += line.groupAmount;
    }
  }
  for (const settlement of group.settlements) {
    const amount = settlementInGroupCurrency(settlement, group.currency);
    of(settlement.toId).items.push({
      kind: "settlement",
      id: settlement.id,
      counterpartyId: settlement.fromId,
      full: amount,
      remaining: amount,
      date: settlement.date,
      createdAt: settlement.createdAt,
    });
    of(settlement.fromId).credit += amount;
  }

  for (const { items } of result.values()) items.sort(oldestFirst);
  return result;
}

function largestFirst(items: DebtItem[]): DebtItem[] {
  return [...items].sort((a, b) => b.remaining - a.remaining || oldestFirst(a, b));
}

/** Net debts between each pair of Members, from Shares and Settlements. */
function pairwiseDebts(group: GroupSnapshot): DebtEdge[] {
  // owed.get(from).get(to): what `from` owes `to`, before netting the pair.
  const owed = new Map<string, Map<string, MinorUnits>>();
  const add = (fromId: string, toId: string, amount: MinorUnits) => {
    const row = owed.get(fromId) ?? new Map<string, MinorUnits>();
    row.set(toId, (row.get(toId) ?? 0) + amount);
    owed.set(fromId, row);
  };
  for (const expense of group.expenses)
    for (const line of inGroupCurrency(expense, group.currency).lines)
      if (line.memberId !== expense.payerId) add(line.memberId, expense.payerId, line.groupAmount);
  // A Settlement repays what its payer owed the recipient.
  for (const s of group.settlements) add(s.toId, s.fromId, settlementInGroupCurrency(s, group.currency));

  const ids = group.members.map((m) => m.id);
  const edges: DebtEdge[] = [];
  for (const fromId of ids)
    for (const toId of ids) {
      const amount = (owed.get(fromId)?.get(toId) ?? 0) - (owed.get(toId)?.get(fromId) ?? 0);
      if (amount > 0) edges.push({ fromId, toId, amount });
    }
  return edges;
}
