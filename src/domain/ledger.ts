import { oldestFirst, type Recorded } from "./chronology";
import { convert, exponentOf } from "./currency";
import { simplifyDebts, type SuggestedSettlement } from "./settle-up";
import type {
  CalendarDate,
  CurrencyCode,
  Expense,
  GroupSnapshot,
  MinorUnits,
  Settlement,
} from "./types";

export interface MemberBalance {
  memberId: string;
  /** Group Currency minor units; positive means others owe this Member. */
  amount: MinorUnits;
}

export interface OwingLine {
  memberId: string;
  /** The Share in the Expense Currency. */
  amount: MinorUnits;
  /** The Share converted with the Locked Rate and rounded on its own line. */
  groupAmount: MinorUnits;
}

export type TimelineEntry =
  | {
      kind: "expense";
      id: string;
      date: CalendarDate;
      expense: Expense;
      /** Sum of the rounded owing lines, in the Group Currency. */
      groupAmount: MinorUnits;
      /** Members with a non-zero Share, in Share order. */
      owing: OwingLine[];
    }
  | {
      kind: "settlement";
      id: string;
      date: CalendarDate;
      settlement: Settlement;
      /** The Settlement in the Group Currency, at its Locked Rate. */
      groupAmount: MinorUnits;
    };

export interface Ledger {
  /** One entry per Member, in Group Member order. */
  balances: MemberBalance[];
  /** True only when every Balance is exactly zero. */
  settledUp: boolean;
  /** Expenses and Settlements, newest first (by date, then creation time). */
  timeline: TimelineEntry[];
  expenseCount: number;
  /** Total of all Expenses in the Group Currency. */
  totalSpent: MinorUnits;
  /**
   * Suggested Settlements from Debt Simplification, in the order found;
   * under one unit of Group Currency only when it involves a Member whose
   * Balance is one unit or more and who has no suggestion of one unit or
   * more (paying or receiving).
   */
  suggestions: SuggestedSettlement[];
  /**
   * The payments that clear Small Change: Debt Simplification's Settlements
   * under one unit of Group Currency that are not suggested. Recording them
   * once every suggestion is recorded leaves the Group Settled Up.
   */
  smallChange: SuggestedSettlement[];
}

/**
 * Compute Ledger: derives Balances from a Group's Expenses and Settlements
 * (ADR 0004). Each Share is converted to the Group Currency with the
 * Expense's Locked Rate and rounded on its own line (ADR 0001); the Payer is
 * credited the sum of those rounded lines, so Balances always sum to zero.
 * A Settlement moves its Group Currency amount (`settlementInGroupCurrency`)
 * from one Member to the other, so it keeps that sum too.
 */
export function computeLedger(group: GroupSnapshot): Ledger {
  const totals = new Map<string, MinorUnits>(
    group.members.map((m) => [m.id, 0]),
  );
  const add = (memberId: string, delta: MinorUnits) =>
    totals.set(memberId, (totals.get(memberId) ?? 0) + delta);

  const entries: { entry: TimelineEntry; recorded: Recorded }[] = [];
  let totalSpent = 0;

  for (const expense of group.expenses) {
    const { lines, groupAmount } = inGroupCurrency(expense, group.currency);
    const owing: OwingLine[] = [];
    for (const line of lines) {
      add(line.memberId, -line.groupAmount);
      if (line.amount !== 0) owing.push(line);
    }
    add(expense.payerId, groupAmount);
    totalSpent += groupAmount;
    entries.push({
      recorded: expense,
      entry: {
        kind: "expense",
        id: expense.id,
        date: expense.date,
        expense,
        groupAmount,
        owing,
      },
    });
  }

  for (const settlement of group.settlements) {
    const groupAmount = settlementInGroupCurrency(settlement, group.currency);
    add(settlement.fromId, groupAmount);
    add(settlement.toId, -groupAmount);
    entries.push({
      recorded: settlement,
      entry: {
        kind: "settlement",
        id: settlement.id,
        date: settlement.date,
        settlement,
        groupAmount,
      },
    });
  }

  // Newest first.
  entries.sort((x, y) => oldestFirst(y.recorded, x.recorded));

  const balances = group.members.map((m) => ({
    memberId: m.id,
    amount: totals.get(m.id) ?? 0,
  }));

  const simplified = simplifyDebts(group, balances);
  const oneUnit = 10 ** exponentOf(group.currency);
  // Small Change is a Balance under one unit. A payment under one unit is
  // still suggested when it involves a Member whose Balance is one unit or
  // more and who has no suggestion of one unit or more (paying or receiving),
  // so that Balance never passes for Small Change.
  const largeBalance = new Set(balances.filter((b) => Math.abs(b.amount) >= oneUnit).map((b) => b.memberId));
  const covered = new Set(simplified.filter((p) => p.amount >= oneUnit).flatMap((p) => [p.fromId, p.toId]));
  const uncovered = (memberId: string) => largeBalance.has(memberId) && !covered.has(memberId);
  const suggested = (p: SuggestedSettlement) => p.amount >= oneUnit || uncovered(p.fromId) || uncovered(p.toId);

  return {
    balances,
    settledUp: balances.every((b) => b.amount === 0),
    timeline: entries.map(({ entry }) => entry),
    expenseCount: group.expenses.length,
    totalSpent,
    suggestions: simplified.filter(suggested),
    smallChange: simplified.filter((p) => !suggested(p)),
  };
}

/**
 * A Settlement's amount in the Group Currency: converted from its Settlement
 * Currency with its Locked Rate and rounded once (ADR 0009). Balances, Debts
 * and Member Statements all count a Settlement as this amount.
 */
export function settlementInGroupCurrency(
  settlement: Pick<Settlement, "amount" | "currency" | "lockedRate">,
  groupCurrency: CurrencyCode,
): MinorUnits {
  return convert(settlement.amount, settlement.currency, groupCurrency, settlement.lockedRate);
}

/**
 * An Expense's Shares converted to the Group Currency with its Locked Rate,
 * each rounded on its own line (ADR 0001), and their sum.
 */
export function inGroupCurrency(
  expense: Pick<Expense, "shares" | "currency" | "lockedRate">,
  groupCurrency: CurrencyCode,
): { lines: OwingLine[]; groupAmount: MinorUnits } {
  const lines = expense.shares.map((share) => ({
    memberId: share.memberId,
    amount: share.amount,
    groupAmount: convert(share.amount, expense.currency, groupCurrency, expense.lockedRate),
  }));
  return { lines, groupAmount: lines.reduce((sum, line) => sum + line.groupAmount, 0) };
}
