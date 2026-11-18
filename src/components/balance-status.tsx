import { ArrowDownLeft, ArrowUpRight, Check } from "lucide-react";
import type { CurrencyCode, MinorUnits } from "@/domain";
import { formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A Member's Balance with sign, icon and label, so owing and being owed are
 * never told apart by colour alone.
 */
export function BalanceStatus({
  amount,
  currency,
  label: sentence,
}: {
  amount: MinorUnits;
  currency: CurrencyCode;
  /** A natural-language sentence for screen readers, e.g. "Jordan owes $219.49". */
  label?: string;
}) {
  const state = amount > 0 ? "owed" : amount < 0 ? "owes" : "settled";
  const Icon = state === "owed" ? ArrowDownLeft : state === "owes" ? ArrowUpRight : Check;
  const label = state === "owed" ? "gets back" : state === "owes" ? "owes" : "settled up";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-2 py-1",
        state === "owed" && "bg-owed-subtle text-owed",
        state === "owes" && "bg-owe-subtle text-owe",
        state === "settled" && "bg-bg-tertiary text-text-secondary",
      )}
    >
      <Icon aria-hidden className="size-4" />
      {sentence && <span className="sr-only">{sentence}</span>}
      <span aria-hidden={sentence ? true : undefined} className="text-sm font-semibold">
        {label}
      </span>
      <span aria-hidden={sentence ? true : undefined} className="amount text-base font-semibold">
        {formatSignedMoney(amount, currency)}
      </span>
    </span>
  );
}
