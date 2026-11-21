"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import {
  changeGroupCurrency,
  computeLedger,
  CURRENCY_CODES,
  formatMoney,
  hasRecords,
  memberLabel,
  membersInBalances,
  parseCurrencyChange,
  todaysRate,
  type CurrencyChangeFields,
  type GroupSnapshot,
} from "@/domain";
import type { ManageResult } from "@/groups/manage-group";
import { attempt } from "@/components/attempt";
import { ErrorSummary, Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTodaysRates } from "@/rates/use-todays-rates";

type Failure = Extract<ManageResult, { ok: false }>;

/**
 * The Group Currency: every Member sees it; only the Group Creator changes
 * it, converting every Expense and Settlement at one rate (Today's Rate
 * unless they type another), after seeing the new Balances it gives.
 */
export function GroupCurrencySection({
  group,
  block,
  onChange,
  onChanged,
}: {
  group: GroupSnapshot;
  /** Why the visitor can't change the Group Currency, or `null`. */
  block: string | null;
  onChange: (fields: CurrencyChangeFields) => Promise<ManageResult>;
  onChanged: (currency: string) => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-lg font-bold">
        Group Currency
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Balances and Settlements are measured in <span className="font-semibold text-text-primary">{group.currency}</span>.
        {block && ` ${block}`}
      </p>
      {block === null && (
        // Starts again from the new Group Currency once it changes.
        <ChangeCurrencyForm key={group.currency} group={group} onChange={onChange} onChanged={onChanged} />
      )}
    </section>
  );
}

function ChangeCurrencyForm({
  group,
  onChange,
  onChanged,
}: {
  group: GroupSnapshot;
  onChange: (fields: CurrencyChangeFields) => Promise<ManageResult>;
  onChanged: (currency: string) => void;
}) {
  const [to, setTo] = useState("");
  const [typed, setTyped] = useState("");
  const [failure, setFailure] = useState<Failure>();
  const [pending, startTransition] = useTransition();
  const rates = useTodaysRates();
  const formId = useId();
  const ids = { to: `${formId}-to`, rate: `${formId}-rate` };
  const errors = failure?.errors;

  const from = group.currency;
  const target = CURRENCY_CODES.find((code) => code === to);
  const converts = hasRecords(group);
  const today = target && todaysRate(rates, from, target);
  const manual = typed.trim() !== "";
  const fields: CurrencyChangeFields = { from, to, rate: manual ? typed : (today ?? "") };
  const parsed = target ? parseCurrencyChange(fields, group) : undefined;
  const preview = parsed?.ok ? changeGroupCurrency(group, parsed.value) : undefined;
  // A typed rate is checked as it is typed, so the preview never goes blank unexplained.
  const rateError = errors?.rate ?? (manual && parsed && !parsed.ok ? parsed.errors.rate : undefined);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await attempt(() => onChange(fields));
      if (result.ok) {
        setFailure(undefined);
        onChanged(to);
      } else setFailure(result);
    });
  }

  let rateHint: string;
  if (manual) rateHint = "Your rate. Clear it to use today's rate.";
  else if (today) rateHint = "Today's rate. Type a rate to override it.";
  else if (rates === undefined) rateHint = "Loading today's rate…";
  else rateHint = "Exchange rates are unavailable right now. Enter the rate yourself.";

  return (
    <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-5">
      <ErrorSummary errors={errors} fieldIds={ids} />
      <Field id={ids.to} label="New Group Currency" error={errors?.to}>
        {(describedBy, className) => (
          <select
            id={ids.to}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setTyped("");
              setFailure(undefined);
            }}
            aria-invalid={errors?.to ? true : undefined}
            aria-describedby={describedBy}
            className={`${className} min-h-11`}
          >
            <option value="">Choose a currency</option>
            {CURRENCY_CODES.filter((code) => code !== from).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        )}
      </Field>

      {target && converts && (
        <div className="flex flex-col gap-2">
          <Field id={ids.rate} label={`Conversion rate (${target} per 1 ${from})`} error={rateError}>
            {(describedBy, className) => (
              <input
                id={ids.rate}
                inputMode="decimal"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={today ?? ""}
                aria-invalid={rateError ? true : undefined}
                aria-describedby={[describedBy, `${ids.rate}-hint`].filter(Boolean).join(" ")}
                className={cn(className, "amount")}
              />
            )}
          </Field>
          <p id={`${ids.rate}-hint`} className="text-sm text-text-secondary">
            {parsed?.ok && (
              <span className="amount font-semibold text-text-primary">
                1 {from} = {parsed.value.rate} {target}
                {manual && " (manual)"}.{" "}
              </span>
            )}
            {rateHint}
          </p>
          {!manual && today && rates?.stale && (
            <p role="status" className="text-sm font-semibold text-warning">
              Rates may be outdated (last updated {formatCalendarDate(rates.fetchedOn)}).
            </p>
          )}
        </div>
      )}

      {preview && converts && <BalancesPreview group={group} preview={preview} />}

      {target && (
        <p className="text-sm text-text-secondary">
          {converts
            ? `Every Expense and Settlement is converted at this one rate, except those paid in ${target}, which keep their own amount.`
            : "Nothing is recorded yet, so there is nothing to convert."}
        </p>
      )}

      <div>
        <Button type="submit" variant="outline" disabled={pending || !preview}>
          {pending ? "Changing…" : target ? `Change to ${target}` : "Change Group Currency"}
        </Button>
      </div>
    </form>
  );
}

/** Each Member's Balance now and once converted, so the change is seen before it is made. */
function BalancesPreview({ group, preview }: { group: GroupSnapshot; preview: GroupSnapshot }) {
  const now = new Map(computeLedger(group).balances.map((b) => [b.memberId, b.amount]));
  const after = new Map(computeLedger(preview).balances.map((b) => [b.memberId, b.amount]));
  const id = useId();
  return (
    <table aria-labelledby={id} className="w-full text-sm">
      <caption id={id} className="mb-2 text-left font-semibold">
        New Balances
      </caption>
      <thead className="text-text-secondary">
        <tr>
          <th scope="col" className="py-1 text-left font-semibold">
            Member
          </th>
          <th scope="col" className="py-1 text-right font-semibold">
            Now
          </th>
          <th scope="col" className="py-1 text-right font-semibold">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {membersInBalances(group).map((member) => (
          <tr key={member.id} className="border-t border-border">
            <th scope="row" className="py-1.5 text-left font-normal break-words">
              {memberLabel(member)}
            </th>
            <td className="amount py-1.5 text-right">{formatMoney(now.get(member.id) ?? 0, group.currency)}</td>
            <td className="amount py-1.5 text-right font-semibold">
              {formatMoney(after.get(member.id) ?? 0, preview.currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
