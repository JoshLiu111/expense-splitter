import { categoryName, categoryOptions } from "./categories";
import { computeLedger, type TimelineEntry } from "./ledger";
import type { CalendarDate, GroupSnapshot, MinorUnits } from "./types";

/**
 * Filters on a Group's Expenses; each one set narrows the list, and they
 * combine freely. Dates are calendar dates, compared with no time zone.
 */
export interface ExpenseFilter {
  /** A predefined Category's name or a Custom Category's id. */
  category?: string;
  /** First calendar date included. */
  from?: CalendarDate;
  /** Last calendar date included. */
  to?: CalendarDate;
  /** A Member who paid the Expense or has a non-zero Share in it. */
  memberId?: string;
}

/** One Category's part of the filtered spending. */
export interface CategoryTotal {
  /** What Expenses store: a predefined name or a Custom Category id. */
  category: string;
  name: string;
  /** In the Group Currency. */
  amount: MinorUnits;
  /** Share of the filtered total to one decimal place, e.g. "86.0"; all add up to 100. */
  percentage: string;
}

/** Spending in one calendar month, `YYYY-MM`. */
export interface MonthTotal {
  month: string;
  /** In the Group Currency. */
  amount: MinorUnits;
}

export type ExpenseEntry = Extract<TimelineEntry, { kind: "expense" }>;

export interface Insights {
  /** The Expenses matching the filter, newest first. */
  expenses: ExpenseEntry[];
  /** Their total in the Group Currency. */
  total: MinorUnits;
  /** Per Category, largest first (ties in Category order). */
  breakdown: CategoryTotal[];
  /** Per calendar month from the first to the last, oldest first. */
  byMonth: MonthTotal[];
  /** Every month any Expense of the Group falls in, newest first (ignores the filter). */
  months: string[];
}

/** Whether any filter narrows the Expenses. */
export function isFiltering(filter: ExpenseFilter): boolean {
  return Boolean(filter.category || filter.from || filter.to || filter.memberId);
}

/** The calendar dates of a month, `YYYY-MM`, as a filter. */
export function monthRange(month: string): { from: CalendarDate; to: CalendarDate } {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** The month, `YYYY-MM`, whose dates a filter's range covers exactly, if any. */
export function filterMonth(filter: ExpenseFilter): string | undefined {
  const month = filter.from?.slice(0, 7);
  if (!month) return undefined;
  const range = monthRange(month);
  return range.from === filter.from && range.to === filter.to ? month : undefined;
}

/**
 * Compute Insights: the Group's Expenses narrowed by a filter, with their
 * Category breakdown and spending per month, all in the Group Currency at
 * each Expense's Locked Rate (amounts as in Compute Ledger).
 */
export function computeInsights(group: GroupSnapshot, filter: ExpenseFilter): Insights {
  const all = computeLedger(group).timeline.filter((e): e is ExpenseEntry => e.kind === "expense");
  const expenses = all.filter((entry) => matches(entry, filter));
  const total = expenses.reduce((sum, e) => sum + e.groupAmount, 0);

  const perCategory = new Map<string, MinorUnits>();
  for (const e of expenses)
    perCategory.set(e.expense.category, (perCategory.get(e.expense.category) ?? 0) + e.groupAmount);
  const order = categoryOptions(group).map((o) => o.id);
  const rank = (category: string) => {
    const i = order.indexOf(category);
    return i === -1 ? order.length : i;
  };
  const categories = [...perCategory.entries()].sort(
    ([a, x], [b, y]) => y - x || rank(a) - rank(b),
  );
  const tenths = percentagesInTenths(categories.map(([, amount]) => amount));
  const breakdown = categories.map(([category, amount], i) => ({
    category,
    name: categoryName(group, category),
    amount,
    percentage: (tenths[i] / 10).toFixed(1),
  }));

  return {
    expenses,
    total,
    breakdown,
    byMonth: monthTotals(expenses),
    months: [...new Set(all.map((e) => e.date.slice(0, 7)))].sort().reverse(),
  };
}

function matches({ expense }: ExpenseEntry, filter: ExpenseFilter): boolean {
  if (filter.category && expense.category !== filter.category) return false;
  if (filter.from && expense.date < filter.from) return false;
  if (filter.to && expense.date > filter.to) return false;
  if (
    filter.memberId &&
    expense.payerId !== filter.memberId &&
    !expense.shares.some((s) => s.memberId === filter.memberId && s.amount !== 0)
  )
    return false;
  return true;
}

/**
 * Each amount's percentage of their sum in tenths of a percent, rounded by
 * largest remainder so they add up to exactly 100.0 (ties to the earlier).
 */
function percentagesInTenths(amounts: MinorUnits[]): number[] {
  const total = amounts.reduce((sum, a) => sum + a, 0);
  if (total === 0) return amounts.map(() => 0);
  const exact = amounts.map((a) => (a * 1000) / total);
  const floors = exact.map(Math.floor);
  let left = 1000 - floors.reduce((sum, f) => sum + f, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, remainder: x - floors[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left-- <= 0) break;
    floors[i] += 1;
  }
  return floors;
}

function monthTotals(expenses: readonly ExpenseEntry[]): MonthTotal[] {
  if (expenses.length === 0) return [];
  const perMonth = new Map<string, MinorUnits>();
  for (const e of expenses) {
    const month = e.date.slice(0, 7);
    perMonth.set(month, (perMonth.get(month) ?? 0) + e.groupAmount);
  }
  const months = [...perMonth.keys()].sort();
  const result: MonthTotal[] = [];
  for (let month = months[0]; month <= months.at(-1)!; month = nextMonth(month))
    result.push({ month, amount: perMonth.get(month) ?? 0 });
  return result;
}

function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}
