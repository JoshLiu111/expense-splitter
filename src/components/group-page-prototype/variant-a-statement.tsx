"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): Direction A, Statement.
// One column read like a reconciled statement: the payments that close the
// Group (yours first and largest), the Balances whose rules are their bars,
// then the ledger with dates in their own column.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, ChevronDown, GitCompareArrows, Plus, Settings } from "lucide-react";
import {
  computeLedger,
  explainSettlements,
  formatMoney,
  type GroupSnapshot,
  type SuggestedSettlement,
} from "@/domain";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PersonalLine } from "./personal-line";
import { BUTTON_A, ExpensesAndInsights, nameOf } from "./parts";
import { AvatarStack, BalanceRules, DatedLedger, TransferPair } from "./parts-a";
import { heroKind, outstanding, personalAction, smallChangeTotal } from "./prototype-data";

export const name = "Statement";

// The graph is secondary, so its code loads only when asked for.
const WhyThesePayments = dynamic(() => import("@/components/why-these-payments"), {
  ssr: false,
  loading: () => <p className="text-sm text-text-secondary">Loading the graph…</p>,
});

export function VariantA({ group, youId }: { group: GroupSnapshot; youId?: string }) {
  const ledger = computeLedger(group);
  const kind = heroKind(ledger);
  const mine = personalAction(group, ledger, youId);
  const [view, setView] = useState<"expenses" | "insights">("expenses");
  const [showWhy, setShowWhy] = useState(false);
  const money = (n: number) => formatMoney(n, group.currency);

  const involvesYou = (s: SuggestedSettlement) => s.fromId === youId || s.toId === youId;
  const yours = ledger.suggestions.filter(involvesYou);
  const others = ledger.suggestions.filter((s) => !involvesYou(s));

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 pb-28">
      <header>
        <Link href="/guest" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
          <ArrowLeft aria-hidden className="size-4" /> All Groups
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-3xl font-extrabold tracking-tight break-words">{group.name}</h1>
          <Button variant="ghost" size="icon" aria-label="Group settings" className={cn(BUTTON_A.icon, "-mr-2.5")}>
            <Settings aria-hidden />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <AvatarStack members={group.members} />
          <p className="text-sm text-text-secondary">
            {pluralize(group.members.length, "member")}
            {ledger.expenseCount > 0 && (
              <>
                , <span className="amount font-semibold text-text-primary">{money(ledger.totalSpent)}</span> across{" "}
                {pluralize(ledger.expenseCount, "expense")}
              </>
            )}
          </p>
        </div>
      </header>

      <section aria-labelledby="settle-up" className="rounded-xl bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="settle-up" className="text-lg font-extrabold">
            Settle up
          </h2>
          {kind === "open" && (
            <p className="text-sm text-text-secondary">
              {pluralize(ledger.suggestions.length, "payment")},{" "}
              <span className="amount font-semibold text-text-primary">{money(outstanding(ledger))}</span> in total
            </p>
          )}
        </div>

        {kind === "open" && (
          <>
            {yours.map((s, i) => (
              <YourPayment key={i} group={group} s={s} youId={youId!} />
            ))}
            <ol className={cn("mt-4", yours.length > 0 && "mt-2")}>
              {others.map((s, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-subtle py-3 last:border-b-0"
                >
                  <TransferPair group={group} fromId={s.fromId} toId={s.toId} />
                  <span className="order-last basis-full text-text-secondary sm:order-none sm:basis-0 sm:flex-1">
                    <span className="font-semibold text-text-primary">{nameOf(group, s.fromId)}</span> pays{" "}
                    <span className="font-semibold text-text-primary">{nameOf(group, s.toId)}</span>
                  </span>
                  <span className="amount ml-auto font-semibold">{money(s.amount)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {yours.length === 0 && (
                <Button variant="outline" className={BUTTON_A.secondary}>
                  Record a payment
                </Button>
              )}
              <Button
                variant="ghost"
                aria-expanded={showWhy}
                onClick={() => setShowWhy((v) => !v)}
                className={cn(BUTTON_A.quiet, yours.length === 0 && "mx-0")}
              >
                <GitCompareArrows aria-hidden /> {showWhy ? "Hide why" : "Why these payments?"}
              </Button>
            </div>
            {showWhy && (
              <div className="mt-3">
                <WhyThesePayments group={group} explanation={explainSettlements(group)} />
              </div>
            )}
          </>
        )}

        {kind === "small" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              {mine && <PersonalLine group={group} mine={mine} className="mb-1 font-extrabold" />}
              <p className="text-text-secondary">
                <span className="amount font-semibold text-text-primary">{money(smallChangeTotal(ledger))}</span> of
                Small Change left; nothing worth a payment.
              </p>
            </div>
            <Button variant="outline" className={BUTTON_A.secondary}>
              Clear Small Change
            </Button>
          </div>
        )}

        {kind === "settled" && (
          <div className="mt-6 flex flex-col items-center py-4 text-center">
            <span className="relative">
              <AvatarStack members={group.members} size="md" ring="ring-surface" />
              <span className="absolute -right-6 -bottom-1 inline-flex size-7 items-center justify-center rounded-full bg-success text-white ring-2 ring-surface">
                <Check aria-hidden className="size-4" strokeWidth={3} />
              </span>
            </span>
            <p className="mt-5 text-2xl font-extrabold">Everyone is Settled Up</p>
            <p className="mt-1 text-text-secondary">
              <span className="amount font-semibold text-text-primary">{money(ledger.totalSpent)}</span> shared,
              nothing outstanding.
            </p>
          </div>
        )}

        {kind === "empty" && (
          <div className="mt-6 flex flex-col items-center py-4 text-center">
            <AvatarStack members={group.members} size="md" ring="ring-surface" />
            <p className="mt-5 text-2xl font-extrabold">No Expenses yet</p>
            <p className="mt-1 max-w-sm text-text-secondary">
              Record who paid for what, and the payments that settle this Group appear here.
            </p>
            <Button className={cn(BUTTON_A.primary, "mt-5")}>
              <Plus aria-hidden /> Add the first Expense
            </Button>
          </div>
        )}
      </section>

      {kind !== "empty" && (
        <details className="group/b rounded-xl bg-surface p-5 sm:p-7" open={kind !== "settled"}>
          <summary className="flex min-h-11 cursor-pointer items-center justify-between text-lg font-extrabold marker:content-none">
            Balances
            {/* Looks like the quiet buttons; the summary itself is the control. */}
            <span
              className={cn(
                BUTTON_A.quiet,
                "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold transition-colors duration-(--duration-fast)",
              )}
            >
              <span className="group-open/b:hidden">Show</span>
              <span className="hidden group-open/b:inline">Hide</span>
              <ChevronDown
                aria-hidden
                className="size-4 transition-transform duration-(--duration-fast) group-open/b:rotate-180"
              />
            </span>
          </summary>
          <div className="mt-2">
            <BalanceRules group={group} balances={ledger.balances} youId={youId} />
          </div>
        </details>
      )}

      {kind !== "empty" && (
        <section aria-label="Expenses and Insights" className="mt-8">
          <ExpensesAndInsights
            group={group}
            view={view}
            onView={setView}
            tabStyle="underline"
            renderList={(timeline) => <DatedLedger group={group} timeline={timeline} />}
          />
        </section>
      )}

      {kind !== "empty" && (
        <div data-proto-fab className="fixed inset-x-0 bottom-16 z-30 px-3 md:inset-x-auto md:right-6 md:bottom-20 md:px-0">
          <Button className={cn(BUTTON_A.primary, "w-full shadow-lg md:w-auto")}>
            <Plus aria-hidden /> Add Expense
          </Button>
        </div>
      )}
    </div>
  );
}

/** The payment that involves the signed-in User, set larger than the rest. */
function YourPayment({ group, s, youId }: { group: GroupSnapshot; s: SuggestedSettlement; youId: string }) {
  const youPay = s.fromId === youId;
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-4 border-b border-border py-5 sm:grid-cols-[auto_1fr_auto]">
      <TransferPair group={group} fromId={s.fromId} toId={s.toId} size="lg" />
      <p className={cn("min-w-0", youPay ? "text-owe" : "text-owed")}>
        <span className="block font-extrabold break-words">
          {youPay ? `You pay ${nameOf(group, s.toId)}` : `${nameOf(group, s.fromId)} pays you`}
        </span>
        <span className="amount block text-3xl leading-tight font-semibold">
          {formatMoney(s.amount, group.currency)}
        </span>
      </p>
      <Button className={cn(BUTTON_A.primary, "col-span-2 sm:col-span-1")}>Record this payment</Button>
    </div>
  );
}
