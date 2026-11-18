"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import {
  computeLedger,
  formatMoney,
  type GroupSnapshot,
  type Ledger,
  type Member,
  type TimelineEntry,
} from "@/domain";
import { BalanceStatus } from "@/components/balance-status";
import { MemberAvatar } from "@/components/member-avatar";
import { useGuestGroups } from "@/guest/use-guest-groups";
import { formatCalendarDate, pluralize } from "@/lib/format";

export function GuestGroupView() {
  const { groupId } = useParams<{ groupId: string }>();
  const groups = useGuestGroups();

  if (groups === null) {
    return (
      <p className="text-text-secondary" role="status">
        Loading Group…
      </p>
    );
  }

  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    return (
      <section className="mx-auto max-w-content">
        <h1 className="text-2xl font-extrabold">Group not found</h1>
        <p className="mt-2 text-text-secondary">
          It may have been deleted in this session.{" "}
          <Link href="/guest" className="font-semibold text-accent underline">
            Back to your Groups
          </Link>
        </p>
      </section>
    );
  }

  return <GroupDetail group={group} ledger={computeLedger(group)} />;
}

function GroupDetail({ group, ledger }: { group: GroupSnapshot; ledger: Ledger }) {
  const members = new Map(group.members.map((m) => [m.id, m]));
  const nameOf = (id: string) => members.get(id)?.name ?? "Unknown member";

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8">
      <div>
        <Link
          href="/guest"
          className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold text-accent"
        >
          <ArrowLeft aria-hidden className="size-4" /> All Groups
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
                <BalanceStatus amount={balance.amount} currency={group.currency} />
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-lg font-bold">
          Expenses and Settlements
        </h2>
        <ol className="mt-3 flex flex-col gap-2">
          {ledger.timeline.map((entry) => (
            <li key={entry.id}>
              {entry.kind === "expense" ? (
                <ExpenseRow entry={entry} group={group} payer={members.get(entry.expense.payerId)} />
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
      </section>
    </div>
  );
}

function ExpenseRow({
  entry,
  group,
  payer,
}: {
  entry: Extract<TimelineEntry, { kind: "expense" }>;
  group: GroupSnapshot;
  payer: Member | undefined;
}) {
  const { expense } = entry;
  const foreign = expense.currency !== group.currency;
  return (
    <article className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold break-words">{expense.description}</h3>
        <p className="text-sm text-text-secondary">
          {payer?.name ?? "Unknown member"} paid ·{" "}
          {pluralize(entry.owing.length, "member")} · {expense.category} ·{" "}
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
    </article>
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
