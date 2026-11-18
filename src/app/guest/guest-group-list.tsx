"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { computeLedger, formatMoney } from "@/domain";
import { useGuestGroups } from "@/guest/use-guest-groups";
import { pluralize } from "@/lib/format";

export function GuestGroupList() {
  const groups = useGuestGroups();

  return (
    <section aria-labelledby="groups-heading" className="mx-auto max-w-content">
      <h1 id="groups-heading" className="text-2xl font-extrabold">
        Your Groups
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        You&apos;re exploring as a Guest. Changes last until you close this browser tab.
      </p>

      {groups === null ? (
        <p className="mt-6 text-text-secondary" role="status">
          Loading Groups…
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {groups.map((group) => {
            const ledger = computeLedger(group);
            return (
              <li key={group.id}>
                <Link
                  href={`/guest/groups/${group.id}`}
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
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-text-secondary" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
