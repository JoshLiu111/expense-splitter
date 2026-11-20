import { exponentOf, formatMoney } from "./currency";
import type { CurrencyCode, Expense, MinorUnits, Share, SplitType } from "./types";

export interface SplitInput {
  /** The Expense amount in the Expense Currency's minor unit. */
  amount: MinorUnits;
  currency: CurrencyCode;
  splitType: SplitType;
  /** Members sharing the Expense. */
  participantIds: string[];
  /** Every Member id in Group order; breaks Leftover Cent ties. */
  memberOrder: string[];
  /**
   * What was typed for each Member in the Split: their Share for Exact, their
   * percentage for Percentage, their ratio for Shares. Blank means zero.
   */
  values?: Record<string, string>;
}

export type SplitResult =
  | { ok: true; shares: Share[] }
  | {
      ok: false;
      /** What is wrong with the Split as a whole. */
      error: string;
      /** Problems with individual Members' values, by Member id. */
      memberErrors?: Record<string, string>;
    };

/**
 * Compute Split: divides an Expense amount into Shares that always sum
 * exactly to the amount. Amounts are already whole minor units, so JPY is
 * split in whole yen. Leftover Cents go to the largest fractional remainder,
 * ties broken by Member order in the Group.
 */
export function computeSplit(input: SplitInput): SplitResult {
  const participants = input.memberOrder.filter((id) => input.participantIds.includes(id));
  if (participants.length === 0) {
    return { ok: false, error: "Choose at least one member to split with." };
  }
  if (input.splitType === "equal") {
    return { ok: true, shares: apportion(input.amount, participants.map((id) => ({ id, weight: 1 }))) };
  }
  const kind = KINDS[input.splitType];
  const digits = input.splitType === "exact" ? exponentOf(input.currency) : 2;
  const values: { memberId: string; value: number }[] = [];
  const memberErrors: Record<string, string> = {};
  for (const memberId of participants) {
    let parsed: number | DecimalProblem | "too-large" = parseDecimal(input.values?.[memberId] ?? "", digits);
    if (typeof parsed === "number" && kind.max !== undefined && parsed >= kind.max) {
      parsed = "too-large";
    }
    if (typeof parsed === "number") values.push({ memberId, value: parsed });
    else memberErrors[memberId] = kind.problem(parsed, input.currency);
  }
  if (Object.keys(memberErrors).length > 0) {
    return { ok: false, error: `Fix the highlighted ${kind.plural}.`, memberErrors };
  }
  if (input.splitType === "exact") return computeExact(input.amount, input.currency, values);
  if (input.splitType === "percentage") return computePercentage(input.amount, values);
  return computeShares(input.amount, values);
}

/** How each advanced Split Type names its values and their problems. */
const KINDS: Record<
  Exclude<SplitType, "equal">,
  {
    plural: string;
    /** Values must stay below this (scaled) limit. */
    max?: number;
    problem: (p: DecimalProblem | "too-large", currency: CurrencyCode) => string;
  }
> = {
  exact: {
    plural: "Shares",
    problem: (p, currency) =>
      p === "negative"
        ? "Enter an amount of zero or more."
        : p === "not-a-number"
          ? "Enter the amount as a number, like 12.50."
          : exponentOf(currency) === 0
            ? `${currency} amounts must be whole numbers.`
            : `${currency} amounts can have at most ${exponentOf(currency)} decimal places.`,
  },
  percentage: {
    plural: "percentages",
    problem: (p) =>
      p === "negative"
        ? "Enter a percentage of zero or more."
        : p === "not-a-number"
          ? "Enter a percentage as a number, like 25."
          : "Percentages can have at most 2 decimal places.",
  },
  shares: {
    plural: "ratios",
    max: 1_000_000_00,
    problem: (p) =>
      p === "too-large"
        ? "Keep each ratio under 1,000,000."
        : p === "negative"
        ? "Enter a ratio of zero or more."
        : p === "not-a-number"
          ? "Enter a ratio as a number, like 2."
          : "Ratios can have at most 2 decimal places.",
  },
};

/** Hundredths of a percent in 100%. */
const WHOLE = 100_00;

function computePercentage(
  amount: MinorUnits,
  values: { memberId: string; value: number }[],
): SplitResult {
  const total = values.reduce((sum, v) => sum + v.value, 0);
  if (total !== WHOLE) {
    return {
      ok: false,
      error: `Percentages must add up to 100%. Currently: ${hundredthsText(total)}%`,
    };
  }
  const shares = apportion(amount, values.map((v) => ({ id: v.memberId, weight: v.value })));
  return {
    ok: true,
    shares: shares.map((share, i) => ({ ...share, percentage: hundredthsText(values[i].value) })),
  };
}

function computeShares(
  amount: MinorUnits,
  values: { memberId: string; value: number }[],
): SplitResult {
  if (values.every((v) => v.value === 0)) {
    return { ok: false, error: "Give at least one member a ratio above zero." };
  }
  const shares = apportion(amount, values.map((v) => ({ id: v.memberId, weight: v.value })));
  return {
    ok: true,
    shares: shares.map((share, i) => ({ ...share, ratio: hundredthsText(values[i].value) })),
  };
}

/** 9550 → "95.5": a value in hundredths as the shortest decimal text. */
function hundredthsText(value: number): string {
  const whole = Math.floor(value / 100);
  const fraction = String(value % 100).padStart(2, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function computeExact(
  amount: MinorUnits,
  currency: CurrencyCode,
  values: { memberId: string; value: number }[],
): SplitResult {
  const total = values.reduce((sum, v) => sum + v.value, 0);
  if (total !== amount) {
    const gap = formatMoney(Math.abs(amount - total), currency);
    return {
      ok: false,
      error:
        `Shares must add up to ${formatMoney(amount, currency)}. ` +
        `Currently: ${formatMoney(total, currency)} ` +
        (total < amount ? `(${gap} left to assign).` : `(${gap} too much).`),
    };
  }
  return { ok: true, shares: values.map(({ memberId, value }) => ({ memberId, amount: value })) };
}

type DecimalProblem = "negative" | "not-a-number" | "too-precise";

/**
 * Reads a non-negative decimal typed by a person as an integer scaled by
 * `10 ** digits`, without floating point; blank is zero.
 */
function parseDecimal(text: string, digits: number): number | DecimalProblem {
  const cleaned = text.replace(/[\s,]/g, "");
  if (cleaned === "") return 0;
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (match[2] === "" && !match[3])) return "not-a-number";
  const [, sign, whole, fraction = ""] = match;
  const significant = fraction.replace(/0+$/, "");
  if (significant.length > digits) return "too-precise";
  const value = Number((whole || "0") + significant.padEnd(digits, "0"));
  if (sign === "-" && value !== 0) return "negative";
  return value;
}

/**
 * Largest-remainder apportionment of `amount` by integer weights, ties
 * broken by the order of `parts`. BigInt, so amount × weight can't lose
 * precision.
 */
function apportion(amount: MinorUnits, parts: { id: string; weight: number }[]): Share[] {
  const total = BigInt(parts.reduce((sum, p) => sum + p.weight, 0));
  const lines = parts.map((p, order) => {
    const product = BigInt(amount) * BigInt(p.weight);
    return { memberId: p.id, order, amount: Number(product / total), remainder: product % total };
  });
  let leftover = amount - lines.reduce((sum, l) => sum + l.amount, 0);
  const byRemainder = [...lines].sort(
    (x, y) => (y.remainder > x.remainder ? 1 : y.remainder < x.remainder ? -1 : x.order - y.order),
  );
  for (const line of byRemainder) {
    if (leftover === 0) break;
    line.amount += 1;
    leftover -= 1;
  }
  return lines.map(({ memberId, amount }) => ({ memberId, amount }));
}

/**
 * The Members whose Share received a Leftover Cent: more than the floor of
 * their exact portion, by the weights the Split was computed from (equal, or
 * the percentages or ratios typed). An Exact Split has none: its Shares were
 * typed. A Share missing its percentage or ratio is never marked.
 */
export function leftoverCentMembers(
  expense: Pick<Expense, "amount" | "splitType" | "shares">,
): Set<string> {
  if (expense.splitType === "exact") return new Set();
  const weights = expense.shares.map((share) => {
    if (expense.splitType === "equal") return 1;
    const typed = expense.splitType === "percentage" ? share.percentage : share.ratio;
    const parsed = typed === undefined ? null : parseDecimal(typed, 2);
    return typeof parsed === "number" ? parsed : null;
  });
  if (weights.some((w) => w === null)) return new Set();
  const total = BigInt(weights.reduce<number>((sum, w) => sum + w!, 0));
  if (total === 0n) return new Set();
  return new Set(
    expense.shares
      .filter((share, i) => BigInt(share.amount) * total > BigInt(expense.amount) * BigInt(weights[i]!))
      .map((share) => share.memberId),
  );
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
