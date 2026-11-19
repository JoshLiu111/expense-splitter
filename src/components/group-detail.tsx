"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertDialog } from "radix-ui";
import { ArrowLeft, ArrowRightLeft, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import {
  categoryName,
  computeInsights,
  computeLedger,
  formatMoney,
  isFiltering,
  type Expense,
  type ExpenseFilter,
  type GroupSnapshot,
  type Member,
  type Settlement,
  type TimelineEntry,
} from "@/domain";
import type { DeleteExpense, SaveExpense } from "@/expenses/save-expense";
import type { SettleUp } from "@/settlements/settle-up";
import { BalancesPanel } from "@/components/balances-panel";
import { ExpenseEditor } from "@/components/expense-editor";
import { SettleUpSection } from "@/components/settle-up";
import { ExpenseFilters, SpendingInsights } from "@/components/spending";
import { AvatarStack } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { useTodaysRates } from "@/rates/use-todays-rates";
import { describeBalance, formatCalendarDate, pluralize } from "@/lib/format";

/**
 * A Group's header (name, Members, total spent), the settle-up hero (Settle up, then Balances), Insights
 * and the newest-first timeline, with Expense entry.
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
  const [filter, setFilter] = useState<ExpenseFilter>({});
  const filtering = isFiltering(filter);
  const insights = computeInsights(group, filter);
  const timeline = filtering ? insights.expenses : ledger.timeline;
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

      {ledger.expenseCount > 0 && (
        <section aria-labelledby="insights-heading" className="flex flex-col gap-4">
          <h2 id="insights-heading" className="text-lg font-bold">
            Insights
          </h2>
          <ExpenseFilters group={group} insights={insights} filter={filter} onChange={setFilter} />
          <SpendingInsights
            group={group}
            insights={insights}
            balances={ledger.balances}
            filtering={filtering}
          />
        </section>
      )}

      {/* With nothing recorded, the hero leads to the first Expense instead. */}
      {ledger.timeline.length > 0 && (
        <section aria-labelledby="activity-heading">
          <h2
            id="activity-heading"
            ref={activityHeading}
            tabIndex={-1}
            className="rounded-md text-lg font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            Expenses and Settlements
          </h2>
          {/* Live, so the count is read out as filters change. */}
          <div aria-live="polite" className="empty:hidden">
            {filtering && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-text-secondary">
                Showing {pluralize(insights.expenses.length, "matching Expense")} of {ledger.expenseCount};
                Settlements are hidden while filtering.
                <Button variant="quiet" onClick={() => setFilter({})}>
                  Clear filters
                </Button>
              </p>
            )}
          </div>
          {timeline.length === 0 && filtering ? (
            <p className="mt-3 rounded-lg border border-dashed border-border-input p-6 text-text-secondary">
              No Expenses match these filters.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {timeline.map((entry) => (
                <li key={entry.id}>
                  {entry.kind === "expense" ? (
                    <ExpenseRow
                      entry={entry}
                      group={group}
                      payer={members.get(entry.expense.payerId)}
                      onEdit={() => open(entry.expense)}
                      onDelete={() => remove(entry.expense)}
                    />
                  ) : (
                    <SettlementRow
                      entry={entry}
                      currency={group.currency}
                      from={nameOf(entry.settlement.fromId)}
                      to={nameOf(entry.settlement.toId)}
                      onDelete={() => removeSettlement(entry.settlement)}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
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

const SPLIT_TYPE_LABELS: Record<Expense["splitType"], string> = {
  equal: "Split equally",
  exact: "Exact amounts",
  percentage: "By percentage",
  shares: "By shares",
};

function ExpenseRow({
  entry,
  group,
  payer,
  onEdit,
  onDelete,
}: {
  entry: Extract<TimelineEntry, { kind: "expense" }>;
  group: GroupSnapshot;
  payer: Member | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { expense } = entry;
  const foreign = expense.currency !== group.currency;
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words">{expense.description}</h3>
          <p className="text-sm text-text-secondary">
            {payer?.name ?? "Unknown member"} paid ·{" "}
            {pluralize(entry.owing.length, "member")} · {SPLIT_TYPE_LABELS[expense.splitType]} ·{" "}
            {categoryName(group, expense.category)} ·{" "}
            <time dateTime={expense.date}>{formatCalendarDate(expense.date)}</time>
          </p>
        </div>
        <p className="text-right">
          <span className="amount font-semibold">
            {formatMoney(expense.amount, expense.currency)}
          </span>
          {foreign && (
            <>
              <span className="amount block text-sm text-text-secondary">
                ≈ {formatMoney(entry.groupAmount, group.currency)}
              </span>
              <span className="amount block text-xs text-text-secondary">
                1 {expense.currency} = {expense.lockedRate} {group.currency}
                {expense.manualRate && " · manual rate"}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="-mb-1 flex justify-end gap-1">
        <Button variant="ghost" onClick={onEdit} aria-label={`Edit “${expense.description}”`}>
          <Pencil aria-hidden /> Edit
        </Button>
        <ConfirmDelete
          label={`Delete “${expense.description}”`}
          title="Delete this Expense?"
          confirmLabel="Delete Expense"
          onConfirm={onDelete}
        >
          “{expense.description}” (
          <span className="amount">{formatMoney(expense.amount, expense.currency)}</span>)
        </ConfirmDelete>
      </div>
    </article>
  );
}

function ConfirmDelete({
  label,
  title,
  confirmLabel,
  children,
  onConfirm,
}: {
  /** The trigger's accessible name, e.g. Delete “Dinner”. */
  label: string;
  title: string;
  confirmLabel: string;
  /** What will be removed, for the dialog's description. */
  children: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="ghost" aria-label={label}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-lg outline-none">
          <AlertDialog.Title className="text-lg font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-text-secondary">
            {children} will be removed and Balances recomputed. This can&apos;t be undone.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button onClick={onConfirm} className="bg-error text-white hover:bg-error/90">
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function SettlementRow({
  entry,
  currency,
  from,
  to,
  onDelete,
}: {
  entry: Extract<TimelineEntry, { kind: "settlement" }>;
  currency: GroupSnapshot["currency"];
  from: string;
  to: string;
  onDelete: () => void;
}) {
  const amount = formatMoney(entry.settlement.amount, currency);
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-dashed border-border-input bg-bg-secondary px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ArrowRightLeft aria-hidden className="size-5 shrink-0 text-accent" />
          <div className="min-w-0">
            <h3 className="font-semibold break-words">
              Settlement: {from} paid {to}
            </h3>
            <p className="text-sm text-text-secondary">
              <time dateTime={entry.date}>{formatCalendarDate(entry.date)}</time>
            </p>
          </div>
        </div>
        <span className="amount font-semibold">{amount}</span>
      </div>
      <div className="-mb-1 flex justify-end">
        <ConfirmDelete
          label={`Delete Settlement: ${from} paid ${to} ${amount}`}
          title="Delete this Settlement?"
          confirmLabel="Delete Settlement"
          onConfirm={onDelete}
        >
          The Settlement from {from} to {to} (<span className="amount">{amount}</span>)
        </ConfirmDelete>
      </div>
    </article>
  );
}
