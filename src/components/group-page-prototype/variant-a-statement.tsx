"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): Direction A, Statement.
// One column. A large reconciliation summary on top reads like the foot of
// a bank statement; the ledger-style Expense list runs below it.

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Plus, Settings } from "lucide-react";
import { computeLedger, formatMoney, type GroupSnapshot } from "@/domain";
import { Button } from "@/components/ui/button";
import { formatSignedMoney, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExpensesAndInsights, nameOf, SignedFigure } from "./parts";
import { heroKind, outstanding, personalAction, smallChangeTotal } from "./prototype-data";

export const name = "Statement";

export function VariantA({ group, youId }: { group: GroupSnapshot; youId?: string }) {
  const ledger = computeLedger(group);
  const kind = heroKind(ledger);
  const mine = personalAction(group, ledger, youId);
  const [view, setView] = useState<"expenses" | "insights">("expenses");
  const money = (n: number) => formatMoney(n, group.currency);

  const figure =
    kind === "open" ? outstanding(ledger) : kind === "small" ? smallChangeTotal(ledger) : 0;
  const caption = {
    open: `to settle in ${pluralize(ledger.suggestions.length, "payment")}`,
    small: "of Small Change left; nothing worth a payment",
    settled: "outstanding. Everyone is Settled Up",
    empty: "outstanding. No Expenses yet",
  }[kind];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 pb-28">
      <header>
        <Link href="/guest" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
          <ArrowLeft aria-hidden className="size-4" /> All Groups
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-extrabold break-words">{group.name}</h1>
          <Button variant="ghost" size="icon" aria-label="Group settings">
            <Settings aria-hidden />
          </Button>
        </div>
        <p className="text-sm text-text-secondary">
          {pluralize(ledger.expenseCount, "expense")} ·{" "}
          <span className="amount text-text-primary">{money(ledger.totalSpent)}</span> spent · in{" "}
          {group.currency}
        </p>
      </header>

      {/* The statement summary: rules, not a card. */}
      <section aria-label="Settle up" className="border-y-2 border-text-primary py-6">
        {mine && kind !== "empty" && (
          <p
            className={cn(
              "mb-4 text-lg font-extrabold",
              mine.tone === "owe" && "text-owe",
              mine.tone === "owed" && "text-owed",
            )}
          >
            {mine.text}
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p>
            <span className="amount block text-[2.75rem] leading-none font-semibold sm:text-[3.5rem]">
              {money(figure)}
            </span>
            <span className="mt-2 flex items-center gap-2 font-semibold text-text-secondary">
              {(kind === "settled") && <Check aria-hidden className="size-5 text-success" />}
              {caption}
            </span>
          </p>
          {kind === "open" && <Button>Record a payment</Button>}
          {kind === "small" && <Button variant="outline">Clear Small Change</Button>}
          {kind === "empty" && (
            <Button>
              <Plus aria-hidden /> Add the first Expense
            </Button>
          )}
        </div>

        {kind === "open" && (
          <ol className="mt-6 divide-y divide-border-subtle border-t border-border">
            {ledger.suggestions.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{s.fromId === youId ? "You" : nameOf(group, s.fromId)}</span>
                  <span className="text-text-secondary"> pays </span>
                  <span className="font-semibold">{s.toId === youId ? "you" : nameOf(group, s.toId)}</span>
                </span>
                <span className="amount font-semibold">{money(s.amount)}</span>
              </li>
            ))}
          </ol>
        )}

        {kind !== "empty" && (
          <details className="mt-6 group/b" open={kind !== "settled"}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-text-secondary">
              Balances
            </summary>
            <table className="w-full">
              <tbody className="divide-y divide-border-subtle">
                {ledger.balances.map((b) => (
                  <tr key={b.memberId}>
                    <th scope="row" className="py-2 pr-4 text-left font-normal break-words">
                      {nameOf(group, b.memberId)}
                      {b.memberId === youId && <span className="text-text-secondary"> (you)</span>}
                    </th>
                    <td className="py-2 text-right">
                      <SignedFigure amount={b.amount} group={group} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-4 border-double border-text-primary">
                  <th scope="row" className="py-2 text-left text-sm font-semibold text-text-secondary">
                    Sum of Balances
                  </th>
                  <td className="amount py-2 text-right font-semibold">
                    {formatSignedMoney(
                      ledger.balances.reduce((s, b) => s + b.amount, 0),
                      group.currency,
                    )}{" "}
                    <Check aria-label="reconciled" className="inline size-4 text-success" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </details>
        )}
      </section>

      <ExpensesAndInsights group={group} view={view} onView={setView} />

      <div data-proto-fab className="fixed inset-x-0 bottom-16 z-30 px-3 md:inset-x-auto md:right-6 md:bottom-20 md:px-0">
        <Button className="w-full shadow-lg md:w-auto">
          <Plus aria-hidden /> Add Expense
        </Button>
      </div>
    </div>
  );
}
