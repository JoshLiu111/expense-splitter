"use client";

import { Dialog } from "radix-ui";
import { ArrowDownLeft, ArrowUpRight, Check, X } from "lucide-react";
import {
  FORMER_MEMBER_SUFFIX,
  formatMoney,
  memberLabel,
  memberStatement,
  type GroupSnapshot,
  type Member,
  type MinorUnits,
  type StatementLine,
} from "@/domain";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/components/use-media-query";
import { describeBalance, formatCalendarDate, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Opens a Member's Member Statement from `children`, the trigger: a centred
 * dialog on wide screens, a bottom sheet on phones. Focus is trapped while
 * it is open and returns to the trigger when it closes. The Statement is
 * derived only while open (ADR 0004).
 */
export function MemberStatementDialog({
  group,
  member,
  isYou,
  children,
}: {
  group: GroupSnapshot;
  member: Member;
  isYou: boolean;
  /** The trigger: a single button. */
  children: React.ReactElement;
}) {
  const wide = useMediaQuery("(min-width: 48rem)");
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          data-testid="member-statement"
          className={cn(
            "fixed z-50 overflow-y-auto border-border bg-surface shadow-lg outline-none",
            wide
              ? "top-1/2 left-1/2 max-h-[92dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6"
              : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl border-t px-4 pt-2 pb-6",
          )}
        >
          {!wide && <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-border-input" />}
          <StatementBody group={group} member={member} isYou={isYou} wide={wide} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatementBody({
  group,
  member,
  isYou,
  wide,
}: {
  group: GroupSnapshot;
  member: Member;
  isYou: boolean;
  wide: boolean;
}) {
  const statement = memberStatement(group, member.id);
  const { totals, balance } = statement;
  const currency = group.currency;
  const members = new Map(group.members.map((m) => [m.id, m]));
  const nameOf = (id: string) => members.get(id)?.name ?? "Unknown member";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <MemberAvatar member={member} size="md" />
          <Dialog.Title className="min-w-0 text-lg font-bold break-words">
            {member.name}
            {member.former && <span className="font-normal text-text-secondary">{FORMER_MEMBER_SUFFIX}</span>}
            {isYou && <span className="font-normal text-text-secondary"> (you)</span>}
          </Dialog.Title>
        </div>
        <Dialog.Close asChild>
          <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2.5">
            <X aria-hidden />
          </Button>
        </Dialog.Close>
      </div>
      <Dialog.Description className="mt-1 text-sm text-text-secondary">
        Member Statement: every Expense and Settlement behind this Balance, in {currency}.
      </Dialog.Description>

      {statement.lines.length === 0 ? (
        <p className="mt-4 border-t border-border pt-4 text-sm text-text-secondary">
          No Expenses or Settlements involve {member.name} yet.
        </p>
      ) : (
        <ol aria-label="Lines" className="mt-4 divide-y divide-border-subtle border-t border-border">
          {statement.lines.map((line) => (
            <StatementRow key={line.id} line={line} group={group} memberId={member.id} nameOf={nameOf} />
          ))}
        </ol>
      )}

      <dl className="border-t border-border pt-3 text-sm">
        <TotalRow label="Paid" amount={totals.paid} currency={currency} />
        <TotalRow label="Share of Expenses" amount={-totals.shares} currency={currency} />
        {totals.settlementsMade > 0 && (
          <TotalRow label="Settlements made" amount={totals.settlementsMade} currency={currency} />
        )}
        {totals.settlementsReceived > 0 && (
          <TotalRow label="Settlements received" amount={-totals.settlementsReceived} currency={currency} />
        )}
      </dl>
      <BalanceTotal name={memberLabel(member)} amount={balance} currency={currency} wide={wide} />
    </>
  );
}

function StatementRow({
  line,
  group,
  memberId,
  nameOf,
}: {
  line: StatementLine;
  group: GroupSnapshot;
  memberId: string;
  nameOf: (id: string) => string;
}) {
  const currency = group.currency;
  const date = (
    <time dateTime={line.date} className="whitespace-nowrap">
      {formatCalendarDate(line.date)}
    </time>
  );

  if (line.kind === "settlement") {
    const other = nameOf(line.counterpartId);
    return (
      <li data-testid={`statement-line-${line.id}`} className="flex items-center gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words">
            {line.direction === "made" ? `Paid ${other}` : `Received from ${other}`}
          </p>
          <p className="text-sm text-text-secondary">
            {date} · Settlement
          </p>
        </div>
        <Net amount={line.net} currency={currency} />
      </li>
    );
  }

  const { expense } = line;
  const otherCurrency = expense.currency !== currency;
  const isPayer = expense.payerId === memberId;
  return (
    <li data-testid={`statement-line-${line.id}`} className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">{expense.description}</p>
        <p className="text-sm text-text-secondary">
          {date} · Paid <span className="amount text-text-primary">{formatMoney(line.paid, currency)}</span> · Share{" "}
          <span className="amount text-text-primary">{formatMoney(line.share, currency)}</span>
        </p>
        {otherCurrency && (
          <p className="text-xs text-text-secondary">
            <span className="sr-only">In {expense.currency}: </span>
            {isPayer && (
              <>
                Paid <span className="amount">{formatMoney(expense.amount, expense.currency)}</span> ·{" "}
              </>
            )}
            Share <span className="amount">{formatMoney(line.expenseShare, expense.currency)}</span> · 1{" "}
            {expense.currency} = <span className="amount">{expense.lockedRate}</span> {currency}
          </p>
        )}
        {line.leftoverCent && (
          <p className="text-xs text-text-secondary">Includes the Split&apos;s Leftover Cent</p>
        )}
      </div>
      <Net amount={line.net} currency={currency} />
    </li>
  );
}

/** A line's effect on the Balance: signed, in ink, so only the Balance itself carries owe/owed colour. */
function Net({ amount, currency }: { amount: MinorUnits; currency: GroupSnapshot["currency"] }) {
  return (
    <span className="amount shrink-0 self-start pt-0.5 text-right font-semibold">
      <span className="sr-only">Effect on Balance: </span>
      {formatSignedMoney(amount, currency)}
    </span>
  );
}

function TotalRow({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: MinorUnits;
  currency: GroupSnapshot["currency"];
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="amount">{formatSignedMoney(amount, currency)}</dd>
    </div>
  );
}

/**
 * The Statement's total: the Member's Balance, with word, arrow and sign as
 * in Balances. Pinned to the bottom of the dialog or sheet, so the figure the
 * lines add up to stays in view while they scroll.
 */
function BalanceTotal({
  name,
  amount,
  currency,
  wide,
}: {
  name: string;
  amount: MinorUnits;
  currency: GroupSnapshot["currency"];
  wide: boolean;
}) {
  const Icon = amount > 0 ? ArrowDownLeft : amount < 0 ? ArrowUpRight : Check;
  const word = amount > 0 ? "gets back" : amount < 0 ? "owes" : "settled up";
  return (
    <p
      data-testid="member-statement-balance"
      className={cn(
        "sticky bottom-0 mt-2 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-border bg-surface pt-3",
        wide ? "-mx-6 -mb-6 px-6 pb-6" : "-mx-4 -mb-6 px-4 pb-6",
      )}
    >
      <span className="sr-only">Balance: {describeBalance(name, amount, currency)}</span>
      <span aria-hidden className="font-bold">
        Balance
      </span>
      <span
        aria-hidden
        className={cn(
          "flex items-baseline gap-2 font-semibold",
          amount < 0 && "text-owe",
          amount > 0 && "text-owed",
          amount === 0 && "text-text-secondary",
        )}
      >
        <Icon className="size-4 self-center" strokeWidth={2.5} />
        <span className="text-sm">{word}</span>
        <span className="amount text-lg">{formatSignedMoney(amount, currency)}</span>
      </span>
    </p>
  );
}
