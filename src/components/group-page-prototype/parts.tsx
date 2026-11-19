"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): throwaway, never merged to main.
// Pieces every direction shares: the ledger-style list, the filter button
// with chips, and the Expenses | Insights pair. The directions differ in
// layout and in how they present the settle-up hero, not in these.

import { useState } from "react";
import { ArrowRight, ArrowLeftRight, SlidersHorizontal, X } from "lucide-react";
import {
  categoryName,
  computeInsights,
  computeLedger,
  formatMoney,
  isFiltering,
  type ExpenseFilter,
  type GroupSnapshot,
  type TimelineEntry,
} from "@/domain";
import { MemberAvatar } from "@/components/member-avatar";
import { ExpenseFilters, SpendingInsights } from "@/components/spending";
import { Button } from "@/components/ui/button";
import { formatCalendarDate, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function nameOf(group: GroupSnapshot, id: string) {
  return group.members.find((m) => m.id === id)?.name ?? "Unknown";
}

export function memberOf(group: GroupSnapshot, id: string) {
  return group.members.find((m) => m.id === id)!;
}

/** Signed Balance figure with arrow word, never colour alone. */
export function SignedFigure({
  amount,
  group,
  className,
}: {
  amount: number;
  group: GroupSnapshot;
  className?: string;
}) {
  const word = amount > 0 ? "gets back" : amount < 0 ? "owes" : "settled up";
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-2",
        amount > 0 && "text-owed",
        amount < 0 && "text-owe",
        amount === 0 && "text-text-secondary",
        className,
      )}
    >
      <span className="text-sm font-semibold">{word}</span>
      <span className="amount font-semibold">{formatSignedMoney(amount, group.currency)}</span>
    </span>
  );
}

/** Ledger rows grouped by date: amounts right-aligned, whole row opens the editor. */
export function LedgerList({ group, timeline }: { group: GroupSnapshot; timeline: TimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-input p-6 text-text-secondary">
        No Expenses yet. Add the first one and Balances appear here.
      </div>
    );
  }
  const byDate = new Map<string, TimelineEntry[]>();
  for (const entry of timeline) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);

  return (
    <div className="flex flex-col">
      {[...byDate].map(([date, entries]) => (
        <section key={date}>
          <h3 className="sticky top-0 z-10 border-b border-border bg-bg-primary py-2 text-sm font-semibold text-text-secondary">
            <time dateTime={date}>{formatCalendarDate(date)}</time>
          </h3>
          <ul className="divide-y divide-border-subtle">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-bg-tertiary/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                >
                  {entry.kind === "expense" ? (
                    <>
                      <MemberAvatar member={memberOf(group, entry.expense.payerId)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold break-words">{entry.expense.description}</span>
                        <span className="block text-sm text-text-secondary">
                          {nameOf(group, entry.expense.payerId)} paid ·{" "}
                          {categoryName(group, entry.expense.category)}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="amount block font-semibold">
                          {formatMoney(entry.groupAmount, group.currency)}
                        </span>
                        {entry.expense.currency !== group.currency && (
                          <span className="amount block text-xs text-text-secondary">
                            {formatMoney(entry.expense.amount, entry.expense.currency)}
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border-input text-text-secondary">
                        <ArrowLeftRight aria-hidden className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold break-words">
                          {nameOf(group, entry.settlement.fromId)}{" "}
                          <ArrowRight aria-label="paid" className="inline size-4" />{" "}
                          {nameOf(group, entry.settlement.toId)}
                        </span>
                        <span className="block text-sm text-text-secondary">Settlement</span>
                      </span>
                      <span className="amount font-semibold text-text-secondary">
                        {formatMoney(entry.settlement.amount, group.currency)}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function chipsFor(group: GroupSnapshot, filter: ExpenseFilter) {
  const chips: { key: keyof ExpenseFilter; label: string }[] = [];
  if (filter.category) chips.push({ key: "category", label: categoryName(group, filter.category) });
  if (filter.memberId) chips.push({ key: "memberId", label: nameOf(group, filter.memberId) });
  if (filter.from) chips.push({ key: "from", label: `From ${formatCalendarDate(filter.from)}` });
  if (filter.to) chips.push({ key: "to", label: `To ${formatCalendarDate(filter.to)}` });
  return chips;
}

/**
 * Expenses | Insights as two views of one filtered set; filters sit behind
 * one button with removable chips.
 */
export function ExpensesAndInsights({
  group,
  view,
  onView,
  showSwitch = true,
}: {
  group: GroupSnapshot;
  view: "expenses" | "insights";
  onView?: (view: "expenses" | "insights") => void;
  /** Direction C drives the view from its own tabs. */
  showSwitch?: boolean;
}) {
  const [filter, setFilter] = useState<ExpenseFilter>({});
  const [open, setOpen] = useState(false);
  const ledger = computeLedger(group);
  const insights = computeInsights(group, filter);
  const filtering = isFiltering(filter);
  const timeline = filtering ? insights.expenses : ledger.timeline;
  const chips = chipsFor(group, filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {showSwitch && onView && (
          <div role="tablist" className="inline-flex rounded-md border border-border-input bg-surface p-0.5">
            {(["expenses", "insights"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => onView(v)}
                className={cn(
                  "min-h-11 rounded px-4 text-sm font-semibold capitalize",
                  view === v ? "bg-accent-subtle text-accent" : "text-text-secondary hover:bg-bg-tertiary",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {ledger.expenseCount > 0 && (
          <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            <SlidersHorizontal aria-hidden /> Filter{chips.length > 0 && ` (${chips.length})`}
          </Button>
        )}
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setFilter({ ...filter, [chip.key]: undefined })}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border-input bg-accent-subtle px-3 text-sm font-semibold"
          >
            {chip.label} <X aria-label="Remove filter" className="size-4" />
          </button>
        ))}
      </div>
      {open && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <ExpenseFilters group={group} insights={insights} filter={filter} onChange={setFilter} />
        </div>
      )}
      {filtering && view === "expenses" && (
        <p className="text-sm text-text-secondary">Settlements are hidden while filtering.</p>
      )}
      {view === "expenses" ? (
        <LedgerList group={group} timeline={timeline} />
      ) : ledger.expenseCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border-input p-6 text-text-secondary">
          Insights appear once there are Expenses.
        </p>
      ) : (
        <SpendingInsights group={group} insights={insights} balances={ledger.balances} filtering={filtering} />
      )}
    </div>
  );
}
