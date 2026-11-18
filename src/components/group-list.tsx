import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { computeLedger, formatMoney, type GroupSnapshot } from "@/domain";
import { BalanceStatus } from "@/components/balance-status";
import { pluralize } from "@/lib/format";

/**
 * Groups as cards with Expense count and total spent. With a `viewerUserId`,
 * each card also shows that User's own Balance in the Group.
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
    <ul className="flex flex-col gap-3">
      {groups.map((group) => {
        const ledger = computeLedger(group);
        const viewer = viewerUserId
          ? group.members.find((m) => m.userId === viewerUserId)
          : undefined;
        const balance = viewer
          ? ledger.balances.find((b) => b.memberId === viewer.id)?.amount
          : undefined;
        return (
          <li key={group.id}>
            <Link
              href={`${basePath}/${group.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-(--duration-fast) hover:bg-bg-secondary"
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold break-words">{group.name}</h2>
                <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-text-secondary">
                  <span>{pluralize(ledger.expenseCount, "expense")}</span>
                  <span>
                    <span className="amount text-text-primary">
                      {formatMoney(ledger.totalSpent, group.currency)}
                    </span>{" "}
                    spent
                  </span>
                </p>
                {balance !== undefined && (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-text-secondary">Your Balance:</span>
                    <BalanceStatus amount={balance} currency={group.currency} />
                  </p>
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
