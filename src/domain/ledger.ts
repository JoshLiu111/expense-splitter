import { convert, exponentOf } from "./currency";
import { simplifyDebts, type SuggestedSettlement } from "./settle-up";
import type {
  CalendarDate,
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
   * never under one unit of Group Currency.
   */
  suggestions: SuggestedSettlement[];
  /**
   * Small Change: Debt Simplification's Settlements under one unit of Group
   * Currency. Never suggested, but recording them clears the rest.
   */
  smallChange: SuggestedSettlement[];
}

/**
 * Compute Ledger: derives Balances from a Group's Expenses and Settlements
 * (ADR 0004). Each Share is converted to the Group Currency with the
 * Expense's Locked Rate and rounded on its own line (ADR 0001); the Payer is
 * credited the sum of those rounded lines, so Balances always sum to zero.
 */
export function computeLedger(group: GroupSnapshot): Ledger {
  const totals = new Map<string, MinorUnits>(
    group.members.map((m) => [m.id, 0]),
  );
  const add = (memberId: string, delta: MinorUnits) =>
    totals.set(memberId, (totals.get(memberId) ?? 0) + delta);

  const entries: { entry: TimelineEntry; createdAt: string }[] = [];
  let totalSpent = 0;

  for (const expense of group.expenses) {
    const owing: OwingLine[] = [];
    let groupAmount = 0;
    for (const share of expense.shares) {
      const line = convert(
        share.amount,
        expense.currency,
        group.currency,
        expense.lockedRate,
      );
      add(share.memberId, -line);
      groupAmount += line;
      if (share.amount !== 0) {
        owing.push({ memberId: share.memberId, amount: share.amount, groupAmount: line });
      }
    }
    add(expense.payerId, groupAmount);
    totalSpent += groupAmount;
    entries.push({
      createdAt: expense.createdAt,
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
    add(settlement.fromId, settlement.amount);
    add(settlement.toId, -settlement.amount);
    entries.push({
      createdAt: settlement.createdAt,
      entry: {
        kind: "settlement",
        id: settlement.id,
        date: settlement.date,
        settlement,
      },
    });
  }

  entries.sort(
    (x, y) =>
      compare(y.entry.date, x.entry.date) || compare(y.createdAt, x.createdAt),
  );

  const balances = group.members.map((m) => ({
    memberId: m.id,
    amount: totals.get(m.id) ?? 0,
  }));

  const simplified = simplifyDebts(group, balances);
  const oneUnit = 10 ** exponentOf(group.currency);

  return {
    balances,
    settledUp: balances.every((b) => b.amount === 0),
    timeline: entries.map(({ entry }) => entry),
    expenseCount: group.expenses.length,
    totalSpent,
    suggestions: simplified.filter((p) => p.amount >= oneUnit),
    smallChange: simplified.filter((p) => p.amount < oneUnit),
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
