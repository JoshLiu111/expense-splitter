"use client";

import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  computeInsights,
  isFiltering,
  type ExpenseFilter,
  type GroupSnapshot,
  type Ledger,
  type TimelineEntry,
} from "@/domain";
import { ExportCsvButton } from "@/components/export-csv-button";
import { filterChips } from "@/components/filter-chips";
import { SectionToggle } from "@/components/section-toggle";
import { ExpenseFilters, SpendingInsights } from "@/components/spending";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";

/**
 * Expenses, then Insights: two sections below the hero, each collapsed
 * behind a Show/Hide toggle (as Balances and "Why these payments?" are)
 * and not remembered between visits. Expenses carries the filters, behind
 * one Filter button and as removable chips; Insights follows them. Hiding
 * Expenses drops its filters, so Insights is never narrowed by filters out
 * of sight. While filtering, the ledger hides Settlements. Once open,
 * Insights offers Export CSV, which takes the whole Group, filters or not.
 */
export function ExpensesAndInsights({
  group,
  ledger,
  headingRef,
  renderLedger,
}: {
  group: GroupSnapshot;
  ledger: Ledger;
  /** The ledger's visually hidden heading, focused after a deletion. */
  headingRef: Ref<HTMLHeadingElement>;
  /** The dated ledger for these entries. */
  renderLedger: (timeline: TimelineEntry[]) => ReactNode;
}) {
  const id = useId();
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [filter, setFilter] = useState<ExpenseFilter>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const expensesToggle = useRef<HTMLButtonElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const chipList = useRef<HTMLUListElement>(null);

  const insights = computeInsights(group, filter);
  const filtering = isFiltering(filter);
  const chips = filterChips(group, filter);
  const timeline = filtering ? insights.expenses : ledger.timeline;
  const filtersId = `${id}-filters`;
  // Nothing between the heading row and the ledger: the ledger's top rule lies on the row's.
  const ledgerMeetsHeading = !filtersOpen && !filtering;

  function toggleExpenses() {
    if (expensesOpen) {
      setFilter({});
      setFiltersOpen(false);
    }
    setExpensesOpen(!expensesOpen);
  }

  // A removed chip takes keyboard focus with it: hand it to the chip now in
  // its place, or to the Filter button once no filter is left.
  function removeFilter(next: ExpenseFilter, index: number) {
    setFilter(next);
    const left = filterChips(group, next).length;
    requestAnimationFrame(() => {
      const target =
        left > 0 ? chipList.current?.querySelectorAll("button")[Math.min(index, left - 1)] : filterButton.current;
      (target ?? expensesToggle.current)?.focus();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${id}-expenses-heading`} className="flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border">
          <h2 id={`${id}-expenses-heading`} className="text-lg font-extrabold">
            Expenses
          </h2>
          <div className="-mr-3 flex items-center">
            {expensesOpen && ledger.expenseCount > 0 && (
              <Button
                ref={filterButton}
                variant="quiet"
                aria-expanded={filtersOpen}
                aria-controls={filtersId}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal aria-hidden />
                <span>
                  Filter
                  {chips.length > 0 && (
                    <>
                      {" "}
                      ({chips.length}
                      <span className="sr-only"> active</span>)
                    </>
                  )}
                </span>
              </Button>
            )}
            <SectionToggle
              ref={expensesToggle}
              section="Expenses"
              open={expensesOpen}
              controls={`${id}-expenses-panel`}
              onToggle={toggleExpenses}
            />
          </div>
        </div>

        <div id={`${id}-expenses-panel`} hidden={!expensesOpen}>
          {expensesOpen && (
            <>
              <div id={filtersId} hidden={!filtersOpen} className="mt-3">
                {filtersOpen && (
                  <ExpenseFilters group={group} insights={insights} filter={filter} onChange={setFilter} />
                )}
              </div>

              {chips.length > 0 && (
                <ul ref={chipList} aria-label="Active filters" className="mt-3 flex flex-wrap items-center gap-2">
                  {chips.map((chip, index) => (
                    <li key={chip.key}>
                      <button
                        type="button"
                        aria-label={`Remove filter: ${chip.label}`}
                        onClick={() => removeFilter(chip.without, index)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent bg-accent-subtle py-1 pr-3 pl-4 text-sm font-semibold text-text-primary transition-colors duration-(--duration-fast) outline-none hover:bg-bg-tertiary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {chip.label}
                        <X aria-hidden className="size-4 text-text-secondary" />
                      </button>
                    </li>
                  ))}
                  <li>
                    <Button variant="quiet" onClick={() => removeFilter({}, 0)}>
                      Clear all
                    </Button>
                  </li>
                </ul>
              )}

              {/* Live, so the count is read out as filters change. */}
              <div aria-live="polite" className="empty:hidden">
                {filtering && (
                  <p className="mt-3 text-sm text-text-secondary">
                    Showing {pluralize(insights.expenses.length, "matching Expense")} of {ledger.expenseCount}; Settlements
                    are hidden while filtering.
                  </p>
                )}
              </div>

              <section aria-labelledby={`${id}-ledger-heading`} className={ledgerMeetsHeading ? "-mt-px" : "mt-3"}>
                {/* The ledger needs no visible heading; this one names the region and takes focus after a deletion. */}
                <h3 id={`${id}-ledger-heading`} ref={headingRef} tabIndex={-1} className="sr-only">
                  Expenses and Settlements
                </h3>
                {timeline.length === 0 && filtering ? (
                  <p className="rounded-lg border border-dashed border-border-input p-6 text-text-secondary">
                    No Expenses match these filters.
                  </p>
                ) : (
                  renderLedger(timeline)
                )}
              </section>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby={`${id}-insights-heading`} className="flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border">
          <h2 id={`${id}-insights-heading`} className="text-lg font-extrabold">
            Insights
          </h2>
          <div className="-mr-3 flex items-center">
            {insightsOpen && <ExportCsvButton group={group} />}
            <SectionToggle
              section="Insights"
              open={insightsOpen}
              controls={`${id}-insights-panel`}
              onToggle={() => setInsightsOpen(!insightsOpen)}
            />
          </div>
        </div>
        <div id={`${id}-insights-panel`} hidden={!insightsOpen} className="mt-5">
          {/* Rendered only when open, so the charts load when Insights is first shown. */}
          {insightsOpen &&
            (ledger.expenseCount === 0 ? (
              <p className="rounded-lg border border-dashed border-border-input p-6 text-text-secondary">
                Insights appear once there are Expenses.
              </p>
            ) : (
              <>
                {filtering && (
                  <p className="mb-4 text-sm text-text-secondary">
                    Showing {pluralize(insights.expenses.length, "matching Expense")} of {ledger.expenseCount}, filtered
                    in Expenses.
                  </p>
                )}
                <SpendingInsights group={group} insights={insights} balances={ledger.balances} filtering={filtering} />
              </>
            ))}
        </div>
      </section>
    </div>
  );
}
