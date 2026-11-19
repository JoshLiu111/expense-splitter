"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import {
  computeLedger,
  formatMoney,
  type Expense,
  type GroupSnapshot,
  type Settlement,
} from "@/domain";
import type { DeleteExpense, SaveExpense } from "@/expenses/save-expense";
import type { SettleUp } from "@/settlements/settle-up";
import { BalancesPanel } from "@/components/balances-panel";
import { DatedLedger } from "@/components/dated-ledger";
import { ExpenseEditor } from "@/components/expense-editor";
import { SettleUpSection } from "@/components/settle-up";
import { ExpensesAndInsights } from "@/components/expenses-and-insights";
import { AvatarStack } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { useTodaysRates } from "@/rates/use-todays-rates";
import { describeBalance, pluralize } from "@/lib/format";

/**
 * A Group's header (name, Members, total spent), the settle-up hero (Settle up, then Balances),
 * then Expenses | Insights (the dated ledger of Expenses and Settlements, and
 * where the money went, over one shared filter), with Expense entry.
 * Details, Categories, Members and deletion live in Group settings, linked
 * from the header. Balances are recomputed from the Group on every render
 * (ADR 0004).
 */
export function GroupDetail({
  group,
  backHref,
  backLabel,
  settingsHref,
  currentMemberId,
  onSaveExpense,
  onDeleteExpense,
  settleUp,
}: {
  group: GroupSnapshot;
  backHref: string;
  backLabel: string;
  /** The Group's settings page. */
  settingsHref: string;
  /** The visitor's own Member: the default Payer. */
  currentMemberId: string | undefined;
  onSaveExpense: SaveExpense;
  onDeleteExpense: DeleteExpense;
  settleUp: SettleUp;
}) {
  const ledger = computeLedger(group);
  const rates = useTodaysRates();
  const members = new Map(group.members.map((m) => [m.id, m]));
  const activeMembers = group.members.filter((m) => !m.former);
  const nameOf = (id: string) => members.get(id)?.name ?? "Unknown member";

  // `null`: closed; `{ expense: null }`: adding; otherwise editing that Expense.
  const [editing, setEditing] = useState<{ expense: Expense | null } | null>(null);
  const [actionNews, setActionNews] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const activityHeading = useRef<HTMLHeadingElement>(null);

  // Announce Balance changes once they arrive (Guest writes are instant;
  // a User's arrive with the refreshed Group).
  const signature = ledger.balances.map((b) => `${b.memberId}:${b.amount}`).join();
  const [seenSignature, setSeenSignature] = useState(signature);
  const [balanceNews, setBalanceNews] = useState("");
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setBalanceNews(
      `Balances updated. ${ledger.balances
        .map((b) => describeBalance(nameOf(b.memberId), b.amount, group.currency))
        .join(". ")}.`,
    );
  }

  function open(expense: Expense | null) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActionNews("");
    setEditing({ expense });
  }

  function close() {
    setEditing(null);
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected ? opener.current : addButton.current;
      target?.focus();
    });
  }

  async function remove(expense: Expense) {
    const result = await onDeleteExpense(expense.id);
    setActionNews(
      result.ok ? `Deleted “${expense.description}”.` : (result.errors.form ?? "Couldn't delete the Expense."),
    );
    activityHeading.current?.focus();
  }

  async function removeSettlement(settlement: Settlement) {
    const result = await settleUp.delete(settlement.id).catch(() => null);
    setActionNews(
      result?.ok
        ? `Deleted the Settlement from ${nameOf(settlement.fromId)} to ${nameOf(settlement.toId)}.`
        : (result?.errors.form ?? "Couldn't delete the Settlement."),
    );
    activityHeading.current?.focus();
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 pb-24 md:pb-0">
      <header>
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold text-accent"
        >
          <ArrowLeft aria-hidden className="size-4" /> {backLabel}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-3xl font-extrabold tracking-tight break-words">{group.name}</h1>
          <Button asChild variant="ghost" size="icon" className="-mr-2.5 text-text-secondary hover:text-text-primary">
            <Link href={settingsHref} aria-label="Group settings">
              <Settings aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <AvatarStack members={activeMembers} ring="ring-bg-primary" />
          <p className="text-sm text-text-secondary">
            {pluralize(activeMembers.length, "member")}
            {ledger.expenseCount > 0 && (
              <>
                ,{" "}
                <span className="amount font-semibold text-text-primary">
                  {formatMoney(ledger.totalSpent, group.currency)}
                </span>{" "}
                across {pluralize(ledger.expenseCount, "expense")}
              </>
            )}
          </p>
        </div>
      </header>

      {/* Out of the flow while it holds only screen-reader news, so it adds no gap. */}
      <p role="status" className={actionNews ? undefined : "sr-only"}>
        {actionNews && <span className="font-semibold text-success">{actionNews} </span>}
        <span className="sr-only">{balanceNews}</span>
      </p>

      {editing && (
        <ExpenseEditor
          group={group}
          expense={editing.expense}
          rates={rates}
          currentMemberId={currentMemberId}
          onSave={(fields) => onSaveExpense(editing.expense?.id ?? null, fields)}
          onClose={close}
          onSaved={() => {
            setActionNews(editing.expense ? "Expense updated." : "Expense added.");
            close();
          }}
          onDelete={(expense) => {
            setEditing(null);
            void remove(expense);
          }}
        />
      )}

      <SettleUpSection
        group={group}
        ledger={ledger}
        currentMemberId={currentMemberId}
        settleUp={settleUp}
        onNews={setActionNews}
        onAddExpense={() => open(null)}
      />

      {ledger.timeline.length > 0 && (
        <BalancesPanel group={group} ledger={ledger} currentMemberId={currentMemberId} />
      )}

      {/* With nothing recorded, the hero leads to the first Expense instead. */}
      {ledger.timeline.length > 0 && (
        <ExpensesAndInsights
          group={group}
          ledger={ledger}
          headingRef={activityHeading}
          renderLedger={(timeline) => (
            <DatedLedger
              group={group}
              timeline={timeline}
              onOpenExpense={open}
              onDeleteSettlement={removeSettlement}
            />
          )}
        />
      )}

      {/* With nothing recorded, "Add the first Expense" in the hero is the only call to action. */}
      {!editing && ledger.timeline.length > 0 && (
        // Always one tap away: a full-width pill floating 12px in from the
        // phone's edges, a floating button on wide screens.
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 px-3 md:inset-x-auto md:right-6 md:bottom-6 md:px-0">
          <Button
            ref={addButton}
            onClick={() => open(null)}
            className="pointer-events-auto w-full px-5 shadow-lg md:w-auto"
          >
            <Plus aria-hidden /> Add Expense
          </Button>
        </div>
      )}
    </div>
  );
}
