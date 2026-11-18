import type { GroupSnapshot, MinorUnits } from "./types";

/** A Settlement the app proposes, always in the Group Currency (ADR 0003). */
export interface SuggestedSettlement {
  fromId: string;
  toId: string;
  amount: MinorUnits;
  /**
   * Whether the two Members were both on some Expense (as Payer or with a
   * Share). Debt Simplification works on Balances only, so it can route a
   * Settlement between Members who never shared one.
   */
  sharedAnExpense: boolean;
}

/**
 * Debt Simplification: greedily matches the largest creditor with the
 * largest debtor until every Balance is zero. Each Settlement zeroes at least
 * one Balance, so there are at most n−1. Ties keep Group Member order.
 */
export function simplifyDebts(
  group: GroupSnapshot,
  balances: readonly { memberId: string; amount: MinorUnits }[],
): SuggestedSettlement[] {
  const remaining = balances.map((b) => ({ ...b }));
  const largest = (sign: 1 | -1) =>
    remaining
      .filter((b) => Math.sign(b.amount) === sign)
      .reduce<(typeof remaining)[number] | undefined>(
        (best, b) =>
          !best || Math.abs(b.amount) > Math.abs(best.amount) ? b : best,
        undefined,
      );

  const shared = sharedPairs(group);
  const suggested: SuggestedSettlement[] = [];
  for (;;) {
    const creditor = largest(1);
    const debtor = largest(-1);
    if (!creditor || !debtor) return suggested;
    const amount = Math.min(creditor.amount, -debtor.amount);
    creditor.amount -= amount;
    debtor.amount += amount;
    suggested.push({
      fromId: debtor.memberId,
      toId: creditor.memberId,
      amount,
      sharedAnExpense: shared.has(pairKey(debtor.memberId, creditor.memberId)),
    });
  }
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/** Every pair of Members who were both on at least one Expense. */
function sharedPairs(group: GroupSnapshot): Set<string> {
  const pairs = new Set<string>();
  for (const expense of group.expenses) {
    const ids = [
      ...new Set([
        expense.payerId,
        ...expense.shares.filter((s) => s.amount !== 0).map((s) => s.memberId),
      ]),
    ];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) pairs.add(pairKey(ids[i], ids[j]));
  }
  return pairs;
}
