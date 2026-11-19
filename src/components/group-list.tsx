import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import {
  computeLedger,
  formatMoney,
  settleUpStatus,
  type CurrencyCode,
  type GroupSnapshot,
  type SettleUpStatus,
} from "@/domain";
import { BalanceStatus } from "@/components/balance-status";
import { describeYourBalance, pluralize } from "@/lib/format";

/**
 * Groups as rows of one ledger panel, each leading with where the Group
 * stands on settling up (the Settle up hero's state), then its Expense count
 * and total spent. With a `viewerUserId`, each row also shows that User's own
 * Balance in the Group.
 */
export function GroupList({
  groups,
  basePath,
  viewerUserId,
}: {
  groups: GroupSnapshot[];
  /** Group links go to `${basePath}/${group.id}`. */
  basePath: string;
  viewerUserId?: string;
}) {
  return (
    <ul className="rounded-lg border border-border bg-surface">
      {groups.map((group) => {
        const ledger = computeLedger(group);
        const viewer = viewerUserId
          ? group.members.find((m) => m.userId === viewerUserId)
          : undefined;
        const balance = viewer
          ? ledger.balances.find((b) => b.memberId === viewer.id)?.amount
          : undefined;
        return (
          <li
            key={group.id}
            className="border-b border-border-subtle first:rounded-t-lg last:rounded-b-lg last:border-b-0"
          >
            <Link
              href={`${basePath}/${group.id}`}
              className="flex min-h-11 items-center gap-3 rounded-[inherit] px-4 py-4 outline-none transition-colors duration-(--duration-fast) hover:bg-bg-tertiary/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1 basis-60">
                  <h2 className="text-lg font-bold break-words">{group.name}</h2>
                  <StatusLine status={settleUpStatus(ledger)} currency={group.currency} />
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-text-secondary">
                    <span>{pluralize(ledger.expenseCount, "expense")}</span>
                    <span>
                      <span className="amount">{formatMoney(ledger.totalSpent, group.currency)}</span> spent
                    </span>
                  </p>
                </div>
                {balance !== undefined && (
                  <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-col sm:items-end">
                    <span className="text-sm text-text-secondary">Your Balance</span>
                    <BalanceStatus
                      amount={balance}
                      currency={group.currency}
                      label={describeYourBalance(balance, group.currency)}
                    />
                  </div>
                )}
              </div>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-text-secondary" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The Group's settle-up state in the Settle up hero's words. */
function StatusLine({ status, currency }: { status: SettleUpStatus; currency: CurrencyCode }) {
  const className = "mt-1 flex items-center gap-1.5 font-semibold";
  switch (status.state) {
    case "open":
      return <p className={className}>{pluralize(status.payments, "payment")} to settle up</p>;
    case "settled":
      return (
        <p className={className}>
          <Check aria-hidden className="size-4 shrink-0 text-success" strokeWidth={3} />
          Settled Up
        </p>
      );
    case "small":
      return (
        <p className={`${className} text-text-secondary`}>
          <span>
            <span className="amount text-text-primary">{formatMoney(status.total, currency)}</span> of Small Change
            left
          </span>
        </p>
      );
    case "empty":
      return <p className={`${className} text-text-secondary`}>No Expenses yet</p>;
  }
}
