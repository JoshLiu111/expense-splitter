"use client";

import { useId, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import {
  categoryName,
  formatMoney,
  type Expense,
  type GroupSnapshot,
  type Member,
  type Settlement,
  type TimelineEntry,
} from "@/domain";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ledgerDays } from "@/components/ledger-days";
import { MemberAvatar, TransferPair } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { formatCalendarDate } from "@/lib/format";

/**
 * The Group's Expenses and Settlements as a ledger on the page background:
 * dates in their own column, one per day, and one row per entry. A row is
 * one control: it opens the Expense editor or the Settlement dialog. Without
 * `onOpenExpense` an Expense row is plain text, and without
 * `onDeleteSettlement` the Settlement dialog only states it (read-only access,
 * ADR 0006).
 */
export function DatedLedger({
  group,
  timeline,
  onOpenExpense,
  onDeleteSettlement,
}: {
  group: GroupSnapshot;
  timeline: TimelineEntry[];
  onOpenExpense?: (expense: Expense) => void;
  onDeleteSettlement?: (settlement: Settlement) => void;
}) {
  const id = useId();
  const members = new Map(group.members.map((m) => [m.id, m]));
  // Former Members stay in the Group, so every id resolves.
  const memberOf = (memberId: string) => members.get(memberId)!;

  return (
    <ol className="border-b border-border">
      {ledgerDays(timeline).map((day) => {
        const dateId = `${id}-${day.date}`;
        return (
          <li key={day.date} className="grid grid-cols-[3.25rem_minmax(0,1fr)] border-t border-border">
            <time
              id={dateId}
              dateTime={day.date}
              title={day.label}
              className="flex flex-col items-start pt-3"
            >
              <span className="sr-only">{day.label}</span>
              <span aria-hidden className="text-2xl leading-none font-extrabold tabular-nums">
                {day.day}
              </span>
              <span aria-hidden className="mt-1 text-xs font-semibold text-text-secondary uppercase">
                {day.month}
                {day.year && <span className="block font-normal">{day.year}</span>}
              </span>
            </time>
            <ul className="divide-y divide-border-subtle">
              {day.entries.map((entry) => (
                <li key={entry.id}>
                  {entry.kind === "expense" ? (
                    <ExpenseRow
                      entry={entry}
                      group={group}
                      payer={memberOf(entry.expense.payerId)}
                      dateId={dateId}
                      onOpen={onOpenExpense && (() => onOpenExpense(entry.expense))}
                    />
                  ) : (
                    <SettlementRow
                      entry={entry}
                      currency={group.currency}
                      from={memberOf(entry.settlement.fromId)}
                      to={memberOf(entry.settlement.toId)}
                      dateId={dateId}
                      onDelete={onDeleteSettlement && (() => onDeleteSettlement(entry.settlement))}
                    />
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A row's heading button covers the whole row, so a click or tap anywhere on
 * it opens the row; the row shows the button's hover tint and focus ring.
 * The row bleeds 8px past the column so its tint clears the avatar and amount.
 */
const rowClass =
  "relative -mx-2 flex min-h-16 cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-(--duration-fast) has-[button:hover]:bg-bg-tertiary/60 has-focus-visible:ring-[3px] has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background";
/** A row that opens nothing: the same layout, without the hover tint or pointer. */
const staticRowClass = "-mx-2 flex min-h-16 items-center gap-3 px-2 py-2.5";
const rowButtonClass =
  "cursor-pointer text-left break-words outline-none after:absolute after:inset-0 after:rounded-md";

function ExpenseRow({
  entry,
  group,
  payer,
  dateId,
  onOpen,
}: {
  entry: Extract<TimelineEntry, { kind: "expense" }>;
  group: GroupSnapshot;
  payer: Member;
  dateId: string;
  /** Opens the Expense editor; without it the row is plain text. */
  onOpen?: () => void;
}) {
  const { expense } = entry;
  const foreign = expense.currency !== group.currency;
  const id = useId();
  return (
    <article className={onOpen ? rowClass : staticRowClass}>
      <MemberAvatar member={payer} size="md" />
      <div className="min-w-0 flex-1">
        <h3>
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              aria-describedby={`${id}-details ${id}-amount ${dateId}`}
              className={`${rowButtonClass} font-semibold`}
            >
              {expense.description}
            </button>
          ) : (
            <span className="font-semibold break-words">{expense.description}</span>
          )}
        </h3>
        <p id={`${id}-details`} className="text-sm break-words text-text-secondary">
          {payer.name} paid in {categoryName(group, expense.category)}
        </p>
      </div>
      <p id={`${id}-amount`} className="shrink-0 text-right">
        <span className="amount block font-semibold">{formatMoney(entry.groupAmount, group.currency)}</span>
        {foreign && (
          <span className="amount block text-xs text-text-secondary">
            <span className="sr-only">, paid as </span>
            {formatMoney(expense.amount, expense.currency)}
          </span>
        )}
      </p>
    </article>
  );
}

/**
 * A Settlement can be added or deleted but never edited, so its row opens a
 * dialog stating it, with Delete Settlement behind a confirmation when it can
 * be deleted.
 */
function SettlementRow({
  entry,
  currency,
  from,
  to,
  dateId,
  onDelete,
}: {
  entry: Extract<TimelineEntry, { kind: "settlement" }>;
  currency: GroupSnapshot["currency"];
  from: Member;
  to: Member;
  dateId: string;
  onDelete?: () => void;
}) {
  const amount = formatMoney(entry.settlement.amount, currency);
  const date = formatCalendarDate(entry.date);
  const id = useId();
  const [open, setOpen] = useState(false);
  // Once deleted the row is gone, so focus is left to whoever announces it.
  const deleted = useRef(false);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) deleted.current = false;
        setOpen(next);
      }}
    >
      <article className={rowClass}>
        <TransferPair from={from} to={to} size="xs" />
        <div className="min-w-0 flex-1">
          <h3>
            <Dialog.Trigger
              aria-describedby={`${id}-amount ${dateId}`}
              className={`${rowButtonClass} text-text-secondary`}
            >
              <span className="sr-only">Settlement: </span>
              <span className="font-semibold text-text-primary">{from.name}</span> paid{" "}
              <span className="font-semibold text-text-primary">{to.name}</span>
            </Dialog.Trigger>
          </h3>
          {/* The button already says "Settlement" to screen readers. */}
          <p aria-hidden className="text-sm text-text-secondary">
            Settlement
          </p>
        </div>
        <span id={`${id}-amount`} className="amount shrink-0 font-semibold text-text-secondary">
          {amount}
        </span>
      </article>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 max-h-[92dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg outline-none"
          onCloseAutoFocus={(event) => {
            if (deleted.current) event.preventDefault();
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <Dialog.Title className="text-lg font-bold">Settlement</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2.5">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2">
            {from.name} paid {to.name} <span className="amount font-semibold">{amount}</span> on{" "}
            <time dateTime={entry.date}>{date}</time>.
          </Dialog.Description>
          {onDelete && (
            <div className="-mr-3 mt-6 flex justify-end">
              <ConfirmDelete
                title="Delete this Settlement?"
                confirmLabel="Delete Settlement"
                onConfirm={() => {
                  deleted.current = true;
                  setOpen(false);
                  onDelete();
                }}
              >
                The Settlement from {from.name} to {to.name} (<span className="amount">{amount}</span>)
              </ConfirmDelete>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
