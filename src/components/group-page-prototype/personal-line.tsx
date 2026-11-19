"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): the signed-in User's own action,
// with every figure in mono.

import { formatMoney, type GroupSnapshot } from "@/domain";
import { cn } from "@/lib/utils";
import type { personalAction } from "./prototype-data";

export function PersonalLine({
  group,
  mine,
  className,
}: {
  group: GroupSnapshot;
  mine: NonNullable<ReturnType<typeof personalAction>>;
  className?: string;
}) {
  return (
    <p className={cn(mine.tone === "owe" && "text-owe", mine.tone === "owed" && "text-owed", className)}>
      {mine.clauses.map((c, i) => (
        <span key={i} className="block">
          {c.words}
          {c.amount !== undefined && <span className="amount"> {formatMoney(c.amount, group.currency)}</span>}
        </span>
      ))}
    </p>
  );
}
