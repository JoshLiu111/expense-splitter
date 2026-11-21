import type { CurrencyCode, LockResult } from "@/domain";
import { Field } from "@/components/form";
import { formatCalendarDate } from "@/lib/format";
import type { TodaysRatesState } from "@/rates/use-todays-rates";
import { cn } from "@/lib/utils";

/**
 * The Locked Rate for an Expense or Settlement in a currency other than the
 * Group Currency: today's rate (or the one an edited Expense already has)
 * unless a Member types their own, which is marked manual.
 */
export function ExchangeRateField({
  id,
  currency,
  groupCurrency,
  typed,
  onChange,
  lock,
  rates,
  relocking = false,
  error,
}: {
  id: string;
  currency: CurrencyCode;
  groupCurrency: CurrencyCode;
  typed: string;
  onChange: (rate: string) => void;
  lock: LockResult;
  rates: TodaysRatesState;
  /** An edited Expense's currency changed, so its rate is locked afresh. */
  relocking?: boolean;
  error: string | undefined;
}) {
  const manual = typed.trim() !== "";
  const hintId = `${id}-hint`;
  let hint: string;
  if (manual) hint = lock.ok ? "Manual rate. Clear it to use today's rate." : "";
  else if (lock.ok && lock.kept) hint = "This Expense keeps its Locked Rate. Type a rate to override it.";
  else if (lock.ok) hint = "Today's rate, locked when you save. Type a rate to override it.";
  else if (rates === undefined) hint = "Loading today's rate…";
  else hint = lock.error;
  const notices = [
    relocking && !manual && "Changing the currency re-locks the rate at today's rate.",
    !manual &&
      !(lock.ok && lock.kept) &&
      rates?.stale &&
      `Rates may be outdated (last updated ${formatCalendarDate(rates.fetchedOn)}).`,
  ].filter((n): n is string => Boolean(n));

  return (
    <div className="flex flex-col gap-2">
      <Field id={id} label={`Exchange rate (${groupCurrency} per 1 ${currency})`} error={error}>
        {(describedBy, className) => (
          <input
            id={id}
            name="rate"
            inputMode="decimal"
            autoComplete="off"
            value={typed}
            onChange={(e) => onChange(e.target.value)}
            placeholder={!manual && lock.ok ? lock.rate : ""}
            aria-invalid={error ? true : undefined}
            aria-describedby={[describedBy, hintId].filter(Boolean).join(" ")}
            className={cn(className, "amount")}
          />
        )}
      </Field>
      <p id={hintId} className="text-sm text-text-secondary">
        {lock.ok && (
          <span className="amount font-semibold text-text-primary">
            1 {currency} = {lock.rate} {groupCurrency}
            {lock.manual && " (manual)"}.{" "}
          </span>
        )}
        {hint}
      </p>
      {notices.length > 0 && (
        <ul role="status" className="text-sm font-semibold text-warning">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
