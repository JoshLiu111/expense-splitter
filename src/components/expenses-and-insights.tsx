"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  computeInsights,
  isFiltering,
  type ExpenseFilter,
  type GroupSnapshot,
  type Ledger,
  type TimelineEntry,
} from "@/domain";
import { filterChips } from "@/components/filter-chips";
import { ExpenseFilters, SpendingInsights } from "@/components/spending";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "expenses", label: "Expenses" },
  { id: "insights", label: "Insights" },
] as const;
type View = (typeof VIEWS)[number]["id"];

/**
 * Expenses and Insights as two views of one filtered set, switched by
 * underline tabs. The filters sit behind one Filter button and show as
 * removable chips; switching views keeps them. While filtering, the
 * Expenses view hides Settlements.
 */
export function ExpensesAndInsights({
  group,
  ledger,
  headingRef,
  renderLedger,
}: {
  group: GroupSnapshot;
  ledger: Ledger;
  /** The Expenses view's visually hidden heading, focused after a deletion. */
  headingRef: Ref<HTMLHeadingElement>;
  /** The dated ledger for these entries. */
  renderLedger: (timeline: TimelineEntry[]) => ReactNode;
}) {
  const id = useId();
  const [view, setView] = useState<View>("expenses");
  const [filter, setFilter] = useState<ExpenseFilter>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tabs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});

  const insights = computeInsights(group, filter);
  const filtering = isFiltering(filter);
  const chips = filterChips(group, filter);
  const timeline = filtering ? insights.expenses : ledger.timeline;
  const tabId = (v: View) => `${id}-${v}-tab`;
  const panelId = (v: View) => `${id}-${v}-panel`;
  const filtersId = `${id}-filters`;

  // The ARIA tabs pattern: arrows, Home and End move between the tabs and select them.
  function onTabKeyDown(event: KeyboardEvent) {
    const index = VIEWS.findIndex((v) => v.id === view);
    const next = {
      ArrowRight: (index + 1) % VIEWS.length,
      ArrowLeft: (index - 1 + VIEWS.length) % VIEWS.length,
      Home: 0,
      End: VIEWS.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setView(VIEWS[next].id);
    tabs.current[VIEWS[next].id]?.focus();
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border">
        <div role="tablist" aria-label="Expenses and Insights" className="-mb-px flex gap-6">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              ref={(el) => {
                tabs.current[v.id] = el;
              }}
              id={tabId(v.id)}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              aria-controls={panelId(v.id)}
              tabIndex={view === v.id ? 0 : -1}
              onClick={() => setView(v.id)}
              onKeyDown={onTabKeyDown}
              className={cn(
                "min-h-11 rounded-t-sm border-b-2 text-base font-semibold transition-colors duration-(--duration-fast) outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                view === v.id
                  ? "border-text-primary text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {ledger.expenseCount > 0 && (
          <Button
            variant="quiet"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="-mr-3"
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
      </div>

      <div id={filtersId} hidden={!filtersOpen} className="mt-3">
        {filtersOpen && <ExpenseFilters group={group} insights={insights} filter={filter} onChange={setFilter} />}
      </div>

      {chips.length > 0 && (
        <ul aria-label="Active filters" className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                aria-label={`Remove filter: ${chip.label}`}
                onClick={() => setFilter(chip.without)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent bg-accent-subtle py-1 pr-3 pl-4 text-sm font-semibold text-text-primary transition-colors duration-(--duration-fast) outline-none hover:bg-bg-tertiary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {chip.label}
                <X aria-hidden className="size-4 text-text-secondary" />
              </button>
            </li>
          ))}
          <li>
            <Button variant="quiet" onClick={() => setFilter({})}>
              Clear all
            </Button>
          </li>
        </ul>
      )}

      {/* Live, so the count is read out as filters change, in either view. */}
      <div aria-live="polite" className="empty:hidden">
        {filtering && (
          <p className="mt-3 text-sm text-text-secondary">
            Showing {pluralize(insights.expenses.length, "matching Expense")} of {ledger.expenseCount}
            {view === "expenses" && "; Settlements are hidden while filtering"}.
          </p>
        )}
      </div>

      {VIEWS.map((v) => (
        <div
          key={v.id}
          id={panelId(v.id)}
          role="tabpanel"
          aria-labelledby={tabId(v.id)}
          hidden={view !== v.id}
          // Insights holds nothing focusable, so its panel takes focus itself.
          tabIndex={v.id === "insights" ? 0 : undefined}
          // Nothing between the tabs and the ledger: the tab row's rule is the ledger's top rule.
          className={cn(
            "rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            v.id === "insights"
              ? "mt-5"
              : !filtersOpen && !filtering
                ? "[&>section>ol>li:first-child]:border-t-0"
                : "mt-3",
          )}
        >
          {/* Only the selected view renders, so the charts load when Insights is first opened. */}
          {view === v.id &&
            (v.id === "expenses" ? (
              <section aria-labelledby={`${id}-ledger-heading`}>
                {/* The ledger needs no visible heading; this one names the region and takes focus after a deletion. */}
                <h2 id={`${id}-ledger-heading`} ref={headingRef} tabIndex={-1} className="sr-only">
                  Expenses and Settlements
                </h2>
                {timeline.length === 0 && filtering ? (
                  <p className="rounded-lg border border-dashed border-border-input p-6 text-text-secondary">
                    No Expenses match these filters.
                  </p>
                ) : (
                  renderLedger(timeline)
                )}
              </section>
            ) : ledger.expenseCount === 0 ? (
              <p className="rounded-lg border border-dashed border-border-input p-6 text-text-secondary">
                Insights appear once there are Expenses.
              </p>
            ) : (
              <SpendingInsights group={group} insights={insights} balances={ledger.balances} filtering={filtering} />
            ))}
        </div>
      ))}
    </div>
  );
}
