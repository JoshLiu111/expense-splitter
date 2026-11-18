import { formatMoney } from "./currency";
import type { CurrencyCode, MinorUnits, Share, SplitType } from "./types";

export interface SplitInput {
  /** The Expense amount in the Expense Currency's minor unit. */
  amount: MinorUnits;
  currency: CurrencyCode;
  splitType: SplitType;
  /** Members sharing the Expense. */
  participantIds: string[];
  /** Every Member id in Group order; breaks Leftover Cent ties. */
  memberOrder: string[];
}

export type SplitResult = { ok: true; shares: Share[] } | { ok: false; error: string };

/**
 * Compute Split: divides an Expense amount into Shares that always sum
 * exactly to the amount. Amounts are already whole minor units, so JPY is
 * split in whole yen. Leftover Cents go to the largest fractional remainder,
 * ties broken by Member order in the Group.
 */
export function computeSplit(input: SplitInput): SplitResult {
  if (input.splitType !== "equal") {
    return { ok: false, error: `${input.splitType} Splits aren't supported yet.` };
  }
  const participants = input.memberOrder.filter((id) => input.participantIds.includes(id));
  if (participants.length === 0) {
    return { ok: false, error: "Choose at least one member to split with." };
  }
  return { ok: true, shares: apportion(input.amount, participants.map((id) => ({ id, weight: 1 }))) };
}

/** Largest-remainder apportionment of `amount` by integer weights. */
function apportion(amount: MinorUnits, parts: { id: string; weight: number }[]): Share[] {
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const lines = parts.map((p, order) => ({
    memberId: p.id,
    order,
    amount: Math.floor((amount * p.weight) / totalWeight),
    remainder: (amount * p.weight) % totalWeight,
  }));
  let leftover = amount - lines.reduce((sum, l) => sum + l.amount, 0);
  const byRemainder = [...lines].sort((x, y) => y.remainder - x.remainder || x.order - y.order);
  for (const line of byRemainder) {
    if (leftover === 0) break;
    line.amount += 1;
    leftover -= 1;
  }
  return lines.map(({ memberId, amount }) => ({ memberId, amount }));
}

/** The live preview of an Equal Split, e.g. "$60.00 split 3 ways = $20.00 each". */
export function describeEqualSplit(
  amount: MinorUnits,
  currency: CurrencyCode,
  shares: Share[],
): string {
  const total = formatMoney(amount, currency);
  if (shares.length === 1) return `${total} for 1 member`;
  const amounts = shares.map((s) => s.amount);
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const each =
    low === high
      ? formatMoney(low, currency)
      : `${formatMoney(low, currency)} to ${formatMoney(high, currency)}`;
  return `${total} split ${shares.length} ways = ${each} each`;
}
