import { oldestFirst, type Recorded } from "./chronology";
import { inGroupCurrency } from "./ledger";
import { leftoverCentMembers } from "./split";
import type { CalendarDate, Expense, GroupSnapshot, MinorUnits, Settlement } from "./types";

export type StatementLine =
  | {
      kind: "expense";
      id: string;
      date: CalendarDate;
      expense: Expense;
      /** What the Member paid, in the Group Currency: the Expense's rounded lines if they were the Payer, else 0. */
      paid: MinorUnits;
      /** Their Share converted at the Locked Rate and rounded on its own line (ADR 0001); 0 if they had none or it rounds to zero. */
      share: MinorUnits;
      /** Their Share in the Expense Currency. */
      expenseShare: MinorUnits;
      /** True when their Share received the Split's Leftover Cent (a leftover yen for JPY). */
      leftoverCent: boolean;
      /** `paid − share`: this line's effect on the Balance. */
      net: MinorUnits;
    }
  | {
      kind: "settlement";
      id: string;
      date: CalendarDate;
      settlement: Settlement;
      /** "made": the Member paid it; "received": they were paid. */
      direction: "made" | "received";
      /** The other Member in the Settlement. */
      counterpartId: string;
      /** +amount when made, −amount when received. */
      net: MinorUnits;
    };

export interface MemberStatement {
  memberId: string;
  /** Oldest first (by date, then creation time), so it reads down to the Balance. */
  lines: StatementLine[];
  /** The lines summed by kind, all positive: `paid − shares + settlementsMade − settlementsReceived` is the Balance. */
  totals: {
    paid: MinorUnits;
    shares: MinorUnits;
    settlementsMade: MinorUnits;
    settlementsReceived: MinorUnits;
  };
  /** Sum of the lines' nets: exactly the Member's Balance. */
  balance: MinorUnits;
}

/**
 * Member Statement: the itemised account of one Member's Balance (a Former
 * Member's too). One line per Expense they paid for or have a Share in, and
 * per Settlement they made or received, all in the Group Currency at each
 * Expense's Locked Rate. Derived like the Ledger (ADR 0004), with the same
 * per-line rounding, so the lines total exactly the Balance.
 */
export function memberStatement(group: GroupSnapshot, memberId: string): MemberStatement {
  const lines: { line: StatementLine; recorded: Recorded }[] = [];

  for (const expense of group.expenses) {
    const converted = inGroupCurrency(expense, group.currency);
    const own = converted.lines.find((l) => l.memberId === memberId);
    const isPayer = expense.payerId === memberId;
    // A Share counts even when it rounds to zero in the Group Currency.
    if (!isPayer && !own?.amount) continue;
    const paid = isPayer ? converted.groupAmount : 0;
    const share = own?.groupAmount ?? 0;
    lines.push({
      recorded: expense,
      line: {
        kind: "expense",
        id: expense.id,
        date: expense.date,
        expense,
        paid,
        share,
        expenseShare: own?.amount ?? 0,
        leftoverCent: leftoverCentMembers(expense).has(memberId),
        net: paid - share,
      },
    });
  }

  for (const settlement of group.settlements) {
    const made = settlement.fromId === memberId;
    if (!made && settlement.toId !== memberId) continue;
    lines.push({
      recorded: settlement,
      line: {
        kind: "settlement",
        id: settlement.id,
        date: settlement.date,
        settlement,
        direction: made ? "made" : "received",
        counterpartId: made ? settlement.toId : settlement.fromId,
        net: made ? settlement.amount : -settlement.amount,
      },
    });
  }

  lines.sort((x, y) => oldestFirst(x.recorded, y.recorded));
  const ordered = lines.map(({ line }) => line);
  const totals = { paid: 0, shares: 0, settlementsMade: 0, settlementsReceived: 0 };
  for (const line of ordered) {
    if (line.kind === "expense") {
      totals.paid += line.paid;
      totals.shares += line.share;
    } else if (line.direction === "made") {
      totals.settlementsMade += line.settlement.amount;
    } else {
      totals.settlementsReceived += line.settlement.amount;
    }
  }
  return { memberId, lines: ordered, totals, balance: ordered.reduce((sum, line) => sum + line.net, 0) };
}
