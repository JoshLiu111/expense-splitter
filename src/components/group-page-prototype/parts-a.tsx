"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): pieces only Direction A uses.
// Member colours carry identity (who paid, who pays whom); the Balance
// rules carry magnitude; the date column carries the rhythm of the trip.

import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import {
  categoryName,
  formatMoney,
  type GroupSnapshot,
  type Member,
  type MemberBalance,
  type TimelineEntry,
} from "@/domain";
import { avatarFill, initials, textColourOn } from "@/components/member-avatar";
import { formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { memberOf, nameOf } from "./parts";

const AVATAR_SIZES = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
} as const;

export function Avatar({
  member,
  size = "sm",
  className,
}: {
  member: Pick<Member, "name" | "avatarColor">;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const fill = avatarFill(member.avatarColor);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        AVATAR_SIZES[size],
        className,
      )}
      style={{ backgroundColor: fill, color: textColourOn(fill) }}
    >
      {initials(member.name)}
    </span>
  );
}

/** Overlapping avatars, each cut out of the page by a ring in the page colour. */
export function AvatarStack({
  members,
  size = "sm",
  ring = "ring-bg-primary",
}: {
  members: Member[];
  size?: keyof typeof AVATAR_SIZES;
  /** The colour behind the stack, so each avatar is cut out of it. */
  ring?: "ring-bg-primary" | "ring-surface";
}) {
  return (
    <span aria-hidden className="flex -space-x-1.5">
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} className={cn("ring-2", ring)} />
      ))}
    </span>
  );
}

/** Payer, arrow, payee: the shape of one payment. */
export function TransferPair({
  group,
  fromId,
  toId,
  size = "sm",
}: {
  group: GroupSnapshot;
  fromId: string;
  toId: string;
  size?: keyof typeof AVATAR_SIZES;
}) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center gap-1">
      <Avatar member={memberOf(group, fromId)} size={size} />
      <ArrowRight className={cn("text-text-secondary", size === "lg" ? "size-5" : "size-4")} />
      <Avatar member={memberOf(group, toId)} size={size} />
    </span>
  );
}

/**
 * Balances as a T-account: who owes on the left, who gets back on the
 * right. The two sides total the same, which is the reconciliation itself.
 * Column headings carry the word and arrow; every figure carries its sign.
 */
export function BalanceRules({
  group,
  balances,
  youId,
}: {
  group: GroupSnapshot;
  balances: MemberBalance[];
  youId?: string;
}) {
  const owe = balances.filter((b) => b.amount < 0).sort((x, y) => x.amount - y.amount);
  const get = balances.filter((b) => b.amount > 0).sort((x, y) => y.amount - x.amount);
  const even = balances.filter((b) => b.amount === 0);
  const oweTotal = owe.reduce((s, b) => s + b.amount, 0);
  const getTotal = get.reduce((s, b) => s + b.amount, 0);
  const reconciled = oweTotal + getTotal === 0;

  const side = (
    title: string,
    Icon: typeof ArrowUpRight,
    tone: "owe" | "owed",
    rows: MemberBalance[],
    total: number,
    className?: string,
  ) => (
    <div className={cn("flex flex-col", className)}>
      <h3 className={cn("flex items-center gap-1.5 pb-2 text-sm font-bold", tone === "owe" ? "text-owe" : "text-owed")}>
        <Icon aria-hidden className="size-4" strokeWidth={2.5} />
        {title}
      </h3>
      <ul aria-label={title} className="flex-1 border-t border-border">
        {rows.length === 0 && <li className="py-3 text-sm text-text-secondary">Nobody</li>}
        {rows.map((b) => (
          <li key={b.memberId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            {/* Whole words only: a long name pushes the figure to its own line instead. */}
            <span className="flex flex-1 items-center gap-3 font-semibold">
              <Avatar member={memberOf(group, b.memberId)} size="sm" />
              <span>
                {nameOf(group, b.memberId)}
                {b.memberId === youId && <span className="font-normal text-text-secondary"> (you)</span>}
              </span>
            </span>
            <span className={cn("amount ml-auto font-semibold", tone === "owe" ? "text-owe" : "text-owed")}>
              <span className="sr-only">{tone === "owe" ? "owes " : "gets back "}</span>
              {formatSignedMoney(b.amount, group.currency)}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-baseline justify-between border-t border-border pt-2.5 text-sm">
        <span className="font-semibold text-text-secondary">Total</span>
        <span className="amount text-base font-semibold">{formatSignedMoney(total, group.currency)}</span>
      </p>
    </div>
  );

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-0">
        {side("Owe", ArrowUpRight, "owe", owe, oweTotal, "sm:border-r sm:border-border sm:pr-6")}
        {side("Get back", ArrowDownLeft, "owed", get, getTotal, "sm:pl-6")}
      </div>
      {even.length > 0 && (
        <p className="mt-4 text-sm text-text-secondary">
          Settled up:{" "}
          <span className="font-semibold text-text-primary">
            {even.map((b) => nameOf(group, b.memberId)).join(", ")}
          </span>
        </p>
      )}
      {reconciled && (owe.length > 0 || even.length > 0) && (
        <p className="mt-4 flex items-start gap-1.5 text-sm text-text-secondary">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} />
          <span>
            Both sides match, so the Balances reconcile to{" "}
            <span className="amount font-semibold text-text-primary">{formatMoney(0, group.currency)}</span>.
          </span>
        </p>
      )}
    </div>
  );
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const FULL = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** The ledger with dates in their own column, one per day. */
export function DatedLedger({ group, timeline }: { group: GroupSnapshot; timeline: TimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <p className="border-y border-border py-8 text-center text-text-secondary">
        No Expenses yet. Add the first one and Balances appear above.
      </p>
    );
  }
  const byDate = new Map<string, TimelineEntry[]>();
  for (const entry of timeline) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);

  let lastYear = "";
  return (
    <ol className="border-b border-border">
      {[...byDate].map(([date, entries]) => {
        const d = new Date(`${date}T00:00:00Z`);
        const year = String(d.getUTCFullYear());
        const showYear = year !== lastYear;
        lastYear = year;
        return (
          <li key={date} className="grid grid-cols-[3.25rem_1fr] border-t border-border">
            <time dateTime={date} title={FULL.format(d)} className="flex flex-col items-start pt-3">
              <span className="text-2xl leading-none font-extrabold tabular-nums">{d.getUTCDate()}</span>
              <span className="mt-1 text-xs font-semibold text-text-secondary uppercase">
                {MONTH.format(d)}
                {showYear && <span className="block font-normal">{year}</span>}
              </span>
            </time>
            <ul className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="-mx-2 flex min-h-16 w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-[var(--duration-fast)] hover:bg-bg-tertiary/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {entry.kind === "expense" ? (
                      <>
                        <Avatar member={memberOf(group, entry.expense.payerId)} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold break-words">{entry.expense.description}</span>
                          <span className="block text-sm text-text-secondary">
                            {nameOf(group, entry.expense.payerId)} paid
                            <span className="text-text-tertiary"> in </span>
                            {categoryName(group, entry.expense.category)}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="amount block font-semibold">
                            {formatMoney(entry.groupAmount, group.currency)}
                          </span>
                          {entry.expense.currency !== group.currency && (
                            <span className="amount block text-xs text-text-secondary">
                              {formatMoney(entry.expense.amount, entry.expense.currency)}
                            </span>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <TransferPair
                          group={group}
                          fromId={entry.settlement.fromId}
                          toId={entry.settlement.toId}
                          size="xs"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-text-secondary">
                            <span className="font-semibold text-text-primary">
                              {nameOf(group, entry.settlement.fromId)}
                            </span>{" "}
                            paid{" "}
                            <span className="font-semibold text-text-primary">
                              {nameOf(group, entry.settlement.toId)}
                            </span>
                          </span>
                          <span className="block text-sm text-text-secondary">Settlement</span>
                        </span>
                        <span className="amount font-semibold text-text-secondary">
                          {formatMoney(entry.settlement.amount, group.currency)}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
