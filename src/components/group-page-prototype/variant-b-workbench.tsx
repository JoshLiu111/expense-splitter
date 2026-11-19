"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): Direction B, Workbench.
// Two columns on desktop (about 64rem): Balances and Settle up in a sticky
// left column, Expenses and Insights on the right. One column on phone.

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Coins, Plus, Settings } from "lucide-react";
import { computeLedger, formatMoney, type GroupSnapshot } from "@/domain";
import { BalanceStatus } from "@/components/balance-status";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { describeBalance, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExpensesAndInsights, memberOf, nameOf } from "./parts";
import { heroKind, personalAction, smallChangeTotal } from "./prototype-data";

export const name = "Workbench";

export function VariantB({ group, youId }: { group: GroupSnapshot; youId?: string }) {
  const ledger = computeLedger(group);
  const kind = heroKind(ledger);
  const mine = personalAction(group, ledger, youId);
  const [view, setView] = useState<"expenses" | "insights">("expenses");
  const money = (n: number) => formatMoney(n, group.currency);

  const status = {
    open: pluralize(ledger.suggestions.length, "payment") + " to settle up",
    small: `Small Change only (${money(smallChangeTotal(ledger))})`,
    settled: "Settled Up",
    empty: "Nothing to settle yet",
  }[kind];

  return (
    <div className="mx-auto flex max-w-[64rem] flex-col gap-6 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <Link href="/guest" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
            <ArrowLeft aria-hidden className="size-4" /> All Groups
          </Link>
          <h1 className="text-2xl font-extrabold break-words">{group.name}</h1>
          <p className="text-sm text-text-secondary">
            {pluralize(ledger.expenseCount, "expense")} ·{" "}
            <span className="amount text-text-primary">{money(ledger.totalSpent)}</span> spent
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings aria-hidden /> Settings
          </Button>
          <Button>
            <Plus aria-hidden /> Add Expense
          </Button>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="md:sticky md:top-4 md:self-start">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-semibold text-text-secondary">Settle up</p>
              <p className="flex items-center gap-2 text-xl font-extrabold">
                {kind === "settled" && <Check aria-hidden className="size-6 text-success" />}
                {kind === "small" && <Coins aria-hidden className="size-6 text-text-secondary" />}
                {status}
              </p>
            </div>

            {mine && kind === "open" && mine.tone !== "settled" && (
              <div
                className={cn(
                  "rounded-md p-3",
                  mine.tone === "owe" ? "bg-owe-subtle text-owe" : "bg-owed-subtle text-owed",
                )}
              >
                <p className="font-bold">{mine.text}</p>
                <Button className="mt-2 w-full">Record payment</Button>
              </div>
            )}

            {kind === "open" && (
              <ol className="flex flex-col divide-y divide-border-subtle">
                {ledger.suggestions
                  .filter((s) => s.fromId !== youId)
                  .map((s, i) => (
                    <li key={i} className="flex items-center gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1 break-words">
                        {nameOf(group, s.fromId)} <ArrowRight aria-label="pays" className="inline size-3" />{" "}
                        {s.toId === youId ? "you" : nameOf(group, s.toId)}
                      </span>
                      <span className="amount font-semibold">{money(s.amount)}</span>
                    </li>
                  ))}
              </ol>
            )}
            {kind === "small" && <Button variant="outline">Clear Small Change</Button>}
            {kind === "empty" && (
              <p className="text-sm text-text-secondary">
                Add an Expense and Balances and suggested payments appear here.
              </p>
            )}

            {kind !== "empty" && (
              <div className="border-t border-border pt-3">
                <p className="text-sm font-semibold text-text-secondary">Balances</p>
                <ul className="mt-1 flex flex-col">
                  {ledger.balances.map((b) => {
                    const m = memberOf(group, b.memberId);
                    return (
                      <li key={b.memberId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <MemberAvatar member={m} size="sm" />
                          <span className="min-w-0 text-sm font-semibold break-words">
                            {b.memberId === youId ? "You" : m.name}
                          </span>
                        </span>
                        <BalanceStatus
                          amount={b.amount}
                          currency={group.currency}
                          label={describeBalance(m.name, b.amount, group.currency)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <ExpensesAndInsights group={group} view={view} onView={setView} />
        </div>
      </div>
    </div>
  );
}
