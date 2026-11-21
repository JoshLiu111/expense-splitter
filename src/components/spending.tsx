"use client";

import dynamic from "next/dynamic";
import { useId } from "react";
import {
  categoryOptions,
  filterMonth,
  formatMoney,
  memberLabel,
  membersInBalances,
  monthRange,
  type ExpenseFilter,
  type GroupSnapshot,
  type Insights,
  type MemberBalance,
} from "@/domain";
import { chartColor } from "@/lib/chart";
import { formatMonth, pluralize } from "@/lib/format";

// Recharts is heavy, so the charts load on their own once a Group is open.
const InsightsCharts = dynamic(() => import("@/components/insights-charts"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-text-secondary">
      Loading charts…
    </p>
  ),
});

const selectClass =
  "min-h-11 w-full rounded-md border border-border-input bg-surface px-3 py-2 text-base text-text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

/**
 * Filters on the Group's Expenses by Category, month or date range, and
 * Member (paid or included); they combine freely. Clearing them is the
 * caller's: the active filters show as removable chips.
 */
export function ExpenseFilters({
  group,
  insights,
  filter,
  onChange,
}: {
  group: GroupSnapshot;
  insights: Insights;
  filter: ExpenseFilter;
  onChange: (filter: ExpenseFilter) => void;
}) {
  const id = useId();
  const ids = {
    category: `${id}-category`,
    member: `${id}-member`,
    month: `${id}-month`,
    from: `${id}-from`,
    to: `${id}-to`,
  };
  const set = (patch: Partial<ExpenseFilter>) => {
    const next = { ...filter, ...patch };
    for (const key of Object.keys(next) as (keyof ExpenseFilter)[]) if (!next[key]) delete next[key];
    onChange(next);
  };
  // The month whose dates the range covers exactly, if it is one of the options.
  const covered = filterMonth(filter);
  const month = covered && insights.months.includes(covered) ? covered : "";

  return (
    <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Filter Expenses</legend>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.category} className="text-sm font-semibold">
          Filter by Category
        </label>
        <select
          id={ids.category}
          value={filter.category ?? ""}
          onChange={(e) => set({ category: e.target.value })}
          className={selectClass}
        >
          <option value="">All Categories</option>
          {categoryOptions(group).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.member} className="text-sm font-semibold">
          Filter by Member (paid or included)
        </label>
        <select
          id={ids.member}
          value={filter.memberId ?? ""}
          onChange={(e) => set({ memberId: e.target.value })}
          className={selectClass}
        >
          <option value="">Everyone</option>
          {group.members.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={ids.month} className="text-sm font-semibold">
          Filter by month
        </label>
        <select
          id={ids.month}
          value={month}
          onChange={(e) =>
            set(e.target.value ? monthRange(e.target.value) : { from: undefined, to: undefined })
          }
          className={selectClass}
        >
          <option value="">{filter.from || filter.to ? "Custom dates" : "Any month"}</option>
          {insights.months.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.from} className="text-sm font-semibold">
          From date
        </label>
        <input
          id={ids.from}
          type="date"
          value={filter.from ?? ""}
          max={filter.to}
          onChange={(e) => set({ from: e.target.value })}
          className={selectClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.to} className="text-sm font-semibold">
          To date
        </label>
        <input
          id={ids.to}
          type="date"
          value={filter.to ?? ""}
          min={filter.from}
          onChange={(e) => set({ to: e.target.value })}
          className={selectClass}
        />
      </div>
    </fieldset>
  );
}

/**
 * Where the (filtered) money went: what was spent in each Expense Currency
 * (when any differs from the Group Currency), each Category's total and percentage,
 * then charts of Category share, spending over time and Balance per Member.
 */
export function SpendingInsights({
  group,
  insights,
  balances,
  filtering,
}: {
  group: GroupSnapshot;
  insights: Insights;
  balances: MemberBalance[];
  filtering: boolean;
}) {
  const money = (amount: number) => formatMoney(amount, group.currency);
  const members = new Map(group.members.map((m) => [m.id, m]));
  const inBalances = new Set(membersInBalances(group).map((m) => m.id));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">Spending by Category</h3>
        <p className="text-sm text-text-secondary">
          <span className="amount text-text-primary">{money(insights.total)}</span> across{" "}
          {filtering ? pluralize(insights.expenses.length, "matching expense") : pluralize(insights.expenses.length, "expense")}
        </p>
        {insights.byCurrency.some((s) => s.currency !== group.currency) && (
          <ul aria-label="Spent per currency" className="mt-1 flex flex-wrap gap-x-4 text-sm text-text-secondary">
            {insights.byCurrency.map((subtotal) => (
              <li key={subtotal.currency}>
                Spent in {subtotal.currency}:{" "}
                <span className="amount text-text-primary">{formatMoney(subtotal.amount, subtotal.currency)}</span>
                {subtotal.currency !== group.currency && (
                  <>
                    {" "}
                    ≈ <span className="amount">{money(subtotal.groupAmount)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {insights.breakdown.length === 0 ? (
          <p className="mt-2 text-text-secondary">No Expenses to break down.</p>
        ) : (
          <ul aria-label="Spending by Category" className="mt-2 flex flex-col gap-2">
            {insights.breakdown.map((c, i) => (
              <li key={c.category} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="flex items-center gap-2 font-semibold break-words">
                    <span
                      aria-hidden
                      className="inline-block size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: chartColor(i) }}
                    />
                    {c.name}
                  </span>
                  <span>
                    <span className="amount">{money(c.amount)}</span>{" "}
                    <span className="amount text-sm text-text-secondary">{c.percentage}%</span>
                  </span>
                </div>
                <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.percentage}%`, backgroundColor: chartColor(i) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {insights.expenses.length > 0 && (
        <InsightsCharts
          currency={group.currency}
          breakdown={insights.breakdown}
          byMonth={insights.byMonth}
          balances={balances
            .filter((b) => inBalances.has(b.memberId))
            .map((b) => {
              const member = members.get(b.memberId);
              return { name: member ? memberLabel(member) : "Unknown member", amount: b.amount };
            })}
        />
      )}
    </div>
  );
}
