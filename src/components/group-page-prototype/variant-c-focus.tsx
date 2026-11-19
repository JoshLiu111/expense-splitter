"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): Direction C, Focus.
// Overview / Expenses / Insights tabs. Overview is about one thing: where the
// Group stands and the next payment. Balances are a diverging bar chart.

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Settings } from "lucide-react";
import { computeLedger, formatMoney, type GroupSnapshot } from "@/domain";
import { Button } from "@/components/ui/button";
import { formatSignedMoney, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExpensesAndInsights, LedgerList, nameOf } from "./parts";
import { heroKind, personalAction, smallChangeTotal } from "./prototype-data";

export const name = "Focus";

type Tab = "overview" | "expenses" | "insights";

export function VariantC({ group, youId }: { group: GroupSnapshot; youId?: string }) {
  const ledger = computeLedger(group);
  const kind = heroKind(ledger);
  const mine = personalAction(group, ledger, youId);
  const [tab, setTab] = useState<Tab>("overview");
  const money = (n: number) => formatMoney(n, group.currency);
  // Floor of $100 so Small Change does not draw a full bar.
  const max = Math.max(10000, ...ledger.balances.map((b) => Math.abs(b.amount)));

  const headline = {
    open: `${pluralize(ledger.suggestions.length, "payment")} settle this Group`,
    small: "Only Small Change left",
    settled: "Settled Up",
    empty: "No Expenses yet",
  }[kind];

  return (
    <div className="mx-auto flex max-w-content flex-col pb-28">
      <header>
        <Link href="/guest" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
          <ArrowLeft aria-hidden className="size-4" /> All Groups
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-extrabold break-words">{group.name}</h1>
          <Button variant="ghost" size="icon" aria-label="Group settings">
            <Settings aria-hidden />
          </Button>
        </div>
      </header>

      <div role="tablist" className="sticky top-0 z-20 mt-3 flex border-b border-border bg-bg-primary">
        {(["overview", "expenses", "insights"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "min-h-12 flex-1 border-b-2 text-sm font-semibold capitalize sm:flex-none sm:px-6",
              tab === t ? "border-accent text-accent" : "border-transparent text-text-secondary",
            )}
          >
            {t}
            {t === "expenses" && ledger.expenseCount > 0 && (
              <span className="ml-1 text-text-tertiary">{ledger.expenseCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {tab === "overview" ? (
          <div className="flex flex-col gap-8">
            <section aria-label="Settle up" className="text-center">
              {kind === "settled" && (
                <Check aria-hidden className="mx-auto mb-2 size-10 rounded-full bg-owed-subtle p-2 text-success" />
              )}
              <p className="text-2xl font-extrabold sm:text-3xl">{headline}</p>
              <p className="mt-1 text-text-secondary">
                {kind === "empty" ? (
                  "Add one and the Balances appear here."
                ) : (
                  <>
                    <span className="amount text-text-primary">{money(ledger.totalSpent)}</span> spent across{" "}
                    {pluralize(ledger.expenseCount, "expense")}
                    {kind === "small" && (
                      <>
                        {" "}
                        · <span className="amount">{money(smallChangeTotal(ledger))}</span> of Small Change
                      </>
                    )}
                  </>
                )}
              </p>

              {kind === "open" && (
                <div className="mx-auto mt-6 max-w-md rounded-lg border border-border bg-surface p-4 text-left">
                  {mine && mine.tone !== "settled" ? (
                    <>
                      <p className="text-sm font-semibold text-text-secondary">Your next step</p>
                      <p className={cn("mt-1 text-lg font-extrabold", mine.tone === "owe" ? "text-owe" : "text-owed")}>
                        {mine.text}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-text-secondary">Suggested payments</p>
                  )}
                  <ol className="mt-3 flex flex-col gap-1 text-sm">
                    {ledger.suggestions.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 break-words">
                          {nameOf(group, s.fromId)} <ArrowRight aria-label="pays" className="inline size-3" />{" "}
                          {nameOf(group, s.toId)}
                        </span>
                        <span className="amount font-semibold">{money(s.amount)}</span>
                      </li>
                    ))}
                  </ol>
                  <Button className="mt-4 w-full">Record a payment</Button>
                </div>
              )}
              {kind === "small" && (
                <Button variant="outline" className="mt-4">
                  Clear Small Change
                </Button>
              )}
              {kind === "empty" && (
                <Button className="mt-4">
                  <Plus aria-hidden /> Add the first Expense
                </Button>
              )}
            </section>

            {kind !== "empty" && (
              <section aria-labelledby="c-balances">
                <h2 id="c-balances" className="text-sm font-semibold text-text-secondary">
                  Balances
                </h2>
                <ul className="mt-2 flex flex-col gap-3">
                  {ledger.balances.map((b) => {
                    const pct = (Math.abs(b.amount) / max) * 50;
                    return (
                      <li key={b.memberId}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                          <span className="min-w-0 font-semibold break-words">
                            {b.memberId === youId ? "You" : nameOf(group, b.memberId)}
                          </span>
                          <span
                            className={cn(
                              "amount font-semibold",
                              b.amount > 0 && "text-owed",
                              b.amount < 0 && "text-owe",
                              b.amount === 0 && "text-text-secondary",
                            )}
                          >
                            {b.amount > 0 ? "gets back " : b.amount < 0 ? "owes " : "settled "}
                            {formatSignedMoney(b.amount, group.currency)}
                          </span>
                        </div>
                        <div aria-hidden className="relative mt-1 h-2 rounded-full bg-bg-tertiary">
                          <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border-input" />
                          <span
                            className={cn("absolute inset-y-0 rounded-full", b.amount < 0 ? "bg-owe" : "bg-owed")}
                            style={
                              b.amount < 0
                                ? { right: "50%", width: `${pct}%` }
                                : { left: "50%", width: `${pct}%` }
                            }
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {kind !== "empty" && (
              <section aria-labelledby="c-latest">
                <div className="flex items-center justify-between">
                  <h2 id="c-latest" className="text-sm font-semibold text-text-secondary">
                    Latest
                  </h2>
                  <Button variant="link" onClick={() => setTab("expenses")}>
                    All {ledger.expenseCount} Expenses
                  </Button>
                </div>
                <LedgerList group={group} timeline={ledger.timeline.slice(0, 3)} />
              </section>
            )}
          </div>
        ) : (
          <ExpensesAndInsights group={group} view={tab} showSwitch={false} />
        )}
      </div>

      <div data-proto-fab className="fixed inset-x-0 bottom-16 z-30 px-3 md:inset-x-auto md:right-6 md:bottom-20 md:px-0">
        <Button className="w-full shadow-lg md:w-auto">
          <Plus aria-hidden /> Add Expense
        </Button>
      </div>
    </div>
  );
}
