"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertDialog } from "radix-ui";
import { ArrowLeft, ArrowRightLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  computeLedger,
  formatMoney,
  type Expense,
  type GroupSnapshot,
  type Member,
  type TimelineEntry,
} from "@/domain";
import type { DeleteExpense, SaveExpense } from "@/expenses/save-expense";
import { BalanceStatus } from "@/components/balance-status";
import { ExpenseEditor } from "@/components/expense-editor";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { describeBalance, formatCalendarDate, pluralize } from "@/lib/format";

/**
 * A Group's summary, Balances and newest-first timeline, with Expense entry.
 * Balances are recomputed from the Group on every render (ADR 0004).
 */
export function GroupDetail({
  group,
  backHref,
  backLabel,
  currentMemberId,
  onSaveExpense,
  onDeleteExpense,
}: {
  group: GroupSnapshot;
  backHref: string;
  backLabel: string;
  /** The visitor's own Member: the default Payer. */
  currentMemberId: string | undefined;
  onSaveExpense: SaveExpense;
  onDeleteExpense: DeleteExpense;
}) {
  const ledger = computeLedger(group);
  const members = new Map(group.members.map((m) => [m.id, m]));
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

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 pb-24 md:pb-0">
      <div>
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold text-accent"
        >
          <ArrowLeft aria-hidden className="size-4" /> {backLabel}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold break-words">{group.name}</h1>
        {group.description && (
          <p className="mt-1 text-text-secondary">{group.description}</p>
        )}
        <p className="mt-2 text-sm text-text-secondary">
          {pluralize(ledger.expenseCount, "expense")} ·{" "}
          <span className="amount text-text-primary">
            {formatMoney(ledger.totalSpent, group.currency)}
          </span>{" "}
          spent · Balances in {group.currency}
        </p>
      </div>

      <p role="status" className="empty:hidden">
        {actionNews && <span className="font-semibold text-success">{actionNews} </span>}
        <span className="sr-only">{balanceNews}</span>
      </p>

      {editing && (
        <ExpenseEditor
          group={group}
          expense={editing.expense}
          currentMemberId={currentMemberId}
          onSave={(fields) => onSaveExpense(editing.expense?.id ?? null, fields)}
          onClose={close}
          onSaved={() => {
            setActionNews(editing.expense ? "Expense updated." : "Expense added.");
            close();
          }}
        />
      )}

      <section aria-labelledby="balances-heading">
        <h2 id="balances-heading" className="text-lg font-bold">
          Balances
        </h2>
        {ledger.settledUp && (
          <p className="mt-2 font-semibold text-success">All settled up!</p>
        )}
        <ul className="mt-3 divide-y divide-border-subtle rounded-lg border border-border bg-surface">
          {ledger.balances.map((balance) => {
            const member = members.get(balance.memberId)!;
            return (
              <li
                key={balance.memberId}
                data-testid={`balance-${balance.memberId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <MemberAvatar member={member} />
                  <span className="font-semibold break-words">{member.name}</span>
                </span>
                <BalanceStatus
                  amount={balance.amount}
                  currency={group.currency}
                  label={describeBalance(member.name, balance.amount, group.currency)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="activity-heading">
        <h2
          id="activity-heading"
          ref={activityHeading}
          tabIndex={-1}
          className="rounded-md text-lg font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Expenses and Settlements
        </h2>
        {ledger.timeline.length === 0 ? (
          <div className="mt-3 flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-input p-6">
            <p className="text-text-secondary">No expenses yet. Add your first one!</p>
            {!editing && (
              <Button variant="outline" onClick={() => open(null)}>
                <Plus aria-hidden /> Add your first Expense
              </Button>
            )}
          </div>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {ledger.timeline.map((entry) => (
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
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {!editing && (
        // Always one tap away: a bottom bar on phones, a floating button on
        // wide screens.
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-primary p-3 md:inset-x-auto md:right-6 md:bottom-6 md:border-0 md:bg-transparent md:p-0">
          <Button
            ref={addButton}
            onClick={() => open(null)}
            className="w-full shadow-lg md:w-auto md:px-6 md:text-base"
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
  // This form only edits Expenses in the Group Currency; others would lose
  // their Locked Rate.
  const editable = !foreign;
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words">{expense.description}</h3>
          <p className="text-sm text-text-secondary">
            {payer?.name ?? "Unknown member"} paid ·{" "}
            {pluralize(entry.owing.length, "member")} · {SPLIT_TYPE_LABELS[expense.splitType]} ·{" "}
            {expense.category} ·{" "}
            <time dateTime={expense.date}>{formatCalendarDate(expense.date)}</time>
          </p>
        </div>
        <p className="text-right">
          <span className="amount font-semibold">
            {formatMoney(expense.amount, expense.currency)}
          </span>
          {foreign && (
            <span className="amount block text-sm text-text-secondary">
              ≈ {formatMoney(entry.groupAmount, group.currency)}
            </span>
          )}
        </p>
      </div>
      <div className="-mb-1 flex justify-end gap-1">
        {editable && (
          <Button variant="ghost" onClick={onEdit} aria-label={`Edit “${expense.description}”`}>
            <Pencil aria-hidden /> Edit
          </Button>
        )}
        <ConfirmDelete expense={expense} onConfirm={onDelete} />
      </div>
    </article>
  );
}

function ConfirmDelete({
  expense,
  onConfirm,
}: {
  expense: Expense;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="ghost" aria-label={`Delete “${expense.description}”`}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-lg outline-none">
          <AlertDialog.Title className="text-lg font-bold">Delete this Expense?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-text-secondary">
            “{expense.description}” (
            <span className="amount">{formatMoney(expense.amount, expense.currency)}</span>) will be
            removed and Balances recomputed. This can&apos;t be undone.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button onClick={onConfirm} className="bg-error text-white hover:bg-error/90">
                Delete Expense
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
}: {
  entry: Extract<TimelineEntry, { kind: "settlement" }>;
  currency: GroupSnapshot["currency"];
  from: string;
  to: string;
}) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-dashed border-border-input bg-bg-secondary px-4 py-3">
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
      <span className="amount font-semibold">
        {formatMoney(entry.settlement.amount, currency)}
      </span>
    </article>
  );
}
