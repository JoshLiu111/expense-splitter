import type { Ledger } from "./ledger";
import type { MinorUnits } from "./types";

/**
 * Where a Group stands on settling up, as the Settle up hero shows it.
 * - `empty`: nothing recorded yet (Settlements left after deleting every
 *   Expense still count as recorded).
 * - `settled`: the Group is Settled Up.
 * - `small`: only Small Change is left; `total` is its sum.
 * - `open`: `payments` Suggested Settlements are left; `total` is their sum.
 */
export type SettleUpStatus =
  | { state: "empty" }
  | { state: "settled" }
  | { state: "small"; total: MinorUnits }
  | { state: "open"; payments: number; total: MinorUnits };

export function settleUpStatus(ledger: Ledger): SettleUpStatus {
  const sum = (payments: { amount: MinorUnits }[]) => payments.reduce((s, p) => s + p.amount, 0);
  if (ledger.timeline.length === 0) return { state: "empty" };
  if (ledger.settledUp) return { state: "settled" };
  if (ledger.suggestions.length === 0) return { state: "small", total: sum(ledger.smallChange) };
  return { state: "open", payments: ledger.suggestions.length, total: sum(ledger.suggestions) };
}
