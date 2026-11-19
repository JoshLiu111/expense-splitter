"use client";

import { useId, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import {
  FORMER_MEMBER_SUFFIX,
  formatMoney,
  membersInBalances,
  type GroupSnapshot,
  type Ledger,
  type Member,
  type MemberBalance,
} from "@/domain";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { describeBalance, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Balances as a T-account: who owes on one side, who gets back on the other,
 * each with its total, so the two sides visibly reconcile. Every side carries
 * a word and an arrow, every figure its sign, and every row a screen-reader
 * sentence, so colour is never the only cue. Collapsed once Settled Up.
 */
export function BalancesPanel({
  group,
  ledger,
  currentMemberId,
}: {
  group: GroupSnapshot;
  ledger: Ledger;
  currentMemberId: string | undefined;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(!ledger.settledUp);
  // Open again whenever the Group stops being Settled Up, and fold away once it is.
  const [wasSettled, setWasSettled] = useState(ledger.settledUp);
  if (wasSettled !== ledger.settledUp) {
    setWasSettled(ledger.settledUp);
    setOpen(!ledger.settledUp);
  }

  const members = new Map(membersInBalances(group).map((m) => [m.id, m]));
  const shown = ledger.balances.filter((b) => members.has(b.memberId));
  const owe = shown
    .filter((b) => b.amount < 0)
    .sort((x, y) => x.amount - y.amount);
  const getBack = shown
    .filter((b) => b.amount > 0)
    .sort((x, y) => y.amount - x.amount);
  const even = shown.filter((b) => b.amount === 0);
  const total = (rows: MemberBalance[]) =>
    rows.reduce((sum, b) => sum + b.amount, 0);
  const anyoneOwes = owe.length + getBack.length > 0;

  const row = (balance: MemberBalance) => (
    <BalanceRow
      key={balance.memberId}
      group={group}
      member={members.get(balance.memberId)!}
      amount={balance.amount}
      isYou={balance.memberId === currentMemberId}
    />
  );

  return (
    <section aria-labelledby={`${panelId}-heading`} className="hero-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${panelId}-heading`} className="text-lg font-extrabold">
          Balances
        </h2>
        <Button
          variant="quiet"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="-mr-3"
        >
          {open ? "Hide" : "Show"}
          <ChevronDown
            aria-hidden
            className={cn(
              "transition-transform duration-(--duration-fast)",
              open && "rotate-180",
            )}
          />
          <span className="sr-only"> Balances</span>
        </Button>
      </div>

      <div id={panelId} hidden={!open} className="mt-2">
        {anyoneOwes && (
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-0">
            <BalanceSide
              title="Owe"
              Icon={ArrowUpRight}
              tone="owe"
              total={total(owe)}
              currency={group.currency}
              className="sm:border-r sm:border-border sm:pr-6"
            >
              {owe.map(row)}
            </BalanceSide>
            <BalanceSide
              title="Get back"
              Icon={ArrowDownLeft}
              tone="owed"
              total={total(getBack)}
              currency={group.currency}
              className="sm:pl-6"
            >
              {getBack.map(row)}
            </BalanceSide>
          </div>
        )}

        {even.length > 0 && (
          <div className={cn(anyoneOwes && "mt-6")}>
            <h3 className="flex items-center gap-1.5 pb-2 text-sm font-bold text-text-secondary">
              <Check aria-hidden className="size-4" strokeWidth={2.5} />
              Settled up
            </h3>
            <ul aria-label="Settled up" className="border-t border-border">
              {even.map(row)}
            </ul>
          </div>
        )}

        {anyoneOwes && (
          <p className="mt-4 flex items-start gap-1.5 text-sm text-text-secondary">
            <Check
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-success"
              strokeWidth={3}
            />
            <span>
              Both sides match, so the Balances reconcile to{" "}
              <span className="amount font-semibold text-text-primary">
                {formatMoney(0, group.currency)}
              </span>
              .
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function BalanceSide({
  title,
  Icon,
  tone,
  total,
  currency,
  className,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  tone: "owe" | "owed";
  total: number;
  currency: GroupSnapshot["currency"];
  className?: string;
  children: React.ReactNode[];
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <h3
        className={cn(
          "flex items-center gap-1.5 pb-2 text-sm font-bold",
          tone === "owe" ? "text-owe" : "text-owed",
        )}
      >
        <Icon aria-hidden className="size-4" strokeWidth={2.5} />
        {title}
      </h3>
      <ul aria-label={title} className="flex-1 border-t border-border">
        {children.length === 0 ? (
          <li className="py-3 text-sm text-text-secondary">Nobody</li>
        ) : (
          children
        )}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5 text-sm">
        <span className="font-semibold text-text-secondary">Total</span>
        <span className="amount text-base font-semibold">
          {formatSignedMoney(total, currency)}
        </span>
      </p>
    </div>
  );
}

function BalanceRow({
  group,
  member,
  amount,
  isYou,
}: {
  group: GroupSnapshot;
  member: Member;
  amount: number;
  isYou: boolean;
}) {
  return (
    <li
      data-testid={`balance-${member.id}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
    >
      <span className="sr-only">{describeBalance(member.name, amount, group.currency)}</span>
      {/* Whole words: a long name pushes the figure onto its own line instead. */}
      <span aria-hidden className="flex min-w-[min(100%,min-content)] flex-[1_1_12rem] items-center gap-3 font-semibold">
        <MemberAvatar member={member} size="sm" />
        <span className="min-w-0 break-words">
          {member.name}
          {member.former && <span className="font-normal text-text-secondary">{FORMER_MEMBER_SUFFIX}</span>}
          {isYou && <span className="font-normal text-text-secondary"> (you)</span>}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "amount ml-auto font-semibold",
          amount < 0 && "text-owe",
          amount > 0 && "text-owed",
          amount === 0 && "text-text-secondary",
        )}
      >
        {formatSignedMoney(amount, group.currency)}
      </span>
    </li>
  );
}
