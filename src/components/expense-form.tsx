"use client";

import { useId, useMemo, useState, useTransition, type FormEvent } from "react";
import {
  categoryOptions,
  CURRENCY_CODES,
  amountText,
  MAX_EXPENSE_DESCRIPTION_LENGTH,
  MAX_EXPENSE_NOTES_LENGTH,
  computeSplit,
  describeEqualSplit,
  formatMoney,
  inGroupCurrency,
  isCurrencyCode,
  lockRate,
  parseAmount,
  currentMembers,
  selectableMembers,
  type Expense,
  type GroupSnapshot,
  type CurrencyCode,
  type NewExpenseFields,
  type LockResult,
  type SplitType,
} from "@/domain";
import type { ExpenseResult } from "@/expenses/save-expense";
import { GUEST_MEMBER_NAME } from "@/guest/guest-repository";
import { ErrorSummary, Field } from "@/components/form";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { formatCalendarDate, todayCalendarDate } from "@/lib/format";
import type { TodaysRatesState } from "@/rates/use-todays-rates";
import { cn } from "@/lib/utils";

type FormFields = Omit<NewExpenseFields, "splitValues">;
type AdvancedSplitType = Exclude<SplitType, "equal">;
/** What was typed per Member, kept per Split Type so switching loses nothing. */
type SplitValues = Record<AdvancedSplitType, Record<string, string>>;

/** Form values for a new Expense: paid by me, split equally among everyone. */
function initialFields(
  group: GroupSnapshot,
  expense: Expense | null,
  currentMemberId: string | undefined,
): FormFields {
  if (expense) {
    return {
      amount: amountText(expense.amount, expense.currency),
      currency: expense.currency,
      // A manual rate shows, so saving keeps it; an automatic one is kept anyway.
      rate: expense.manualRate ? expense.lockedRate : "",
      description: expense.description,
      date: expense.date,
      category: expense.category,
      payerId: expense.payerId,
      participantIds: expense.shares.map((s) => s.memberId),
      notes: expense.notes ?? "",
      splitType: expense.splitType,
    };
  }
  const current = currentMembers(group);
  return {
    amount: "",
    currency: group.currency,
    rate: "",
    description: "",
    date: todayCalendarDate(),
    category: "Other",
    payerId: current.some((m) => m.id === currentMemberId)
      ? currentMemberId!
      : (current[0]?.id ?? ""),
    participantIds: current.map((m) => m.id),
    notes: "",
    splitType: "equal",
  };
}

/** The values an edited Expense was entered with; one share each by default. */
function initialSplitValues(group: GroupSnapshot, expense: Expense | null): SplitValues {
  const values: SplitValues = {
    exact: {},
    percentage: {},
    shares: Object.fromEntries(group.members.map((m) => [m.id, "1"])),
  };
  for (const share of expense?.shares ?? []) {
    if (expense?.splitType === "exact") {
      values.exact[share.memberId] = amountText(share.amount, expense.currency);
    } else if (expense?.splitType === "percentage" && share.percentage !== undefined) {
      values.percentage[share.memberId] = share.percentage;
    } else if (expense?.splitType === "shares" && share.ratio !== undefined) {
      values.shares[share.memberId] = share.ratio;
    }
  }
  return values;
}

const SPLIT_TYPE_OPTIONS: { value: SplitType; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "exact", label: "Exact" },
  { value: "percentage", label: "Percentage" },
  { value: "shares", label: "Shares" },
];

const SPLIT_VALUE_LEGENDS: Record<AdvancedSplitType, string> = {
  exact: "Amount each Member owes",
  percentage: "Percentage each Member owes",
  shares: "Shares each Member takes",
};

const chipClass =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border-input bg-surface py-1 pr-4 pl-1 text-sm font-semibold transition-colors duration-(--duration-fast) has-checked:border-accent has-checked:bg-accent-subtle has-focus-visible:ring-[3px] has-focus-visible:ring-ring";

/**
 * Add or edit an Expense. Amount comes first; the default is paid by the
 * current Member and split equally among everyone, with a live preview.
 * Exact, Percentage and Shares Splits take a value per participant.
 */
export function ExpenseForm({
  group,
  expense,
  rates,
  currentMemberId,
  onSave,
  onCancel,
  onSaved,
}: {
  group: GroupSnapshot;
  /** The Expense being edited, or `null` to add one. */
  expense: Expense | null;
  rates: TodaysRatesState;
  currentMemberId: string | undefined;
  onSave: (fields: NewExpenseFields) => Promise<ExpenseResult>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState(() => initialFields(group, expense, currentMemberId));
  // Former Members appear only on Expenses they were already part of.
  const pickable = selectableMembers(group, expense);
  const [splitValues, setSplitValues] = useState(() => initialSplitValues(group, expense));
  const [failure, setFailure] = useState<Extract<ExpenseResult, { ok: false }>>();
  const errors = failure?.errors;
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const ids = {
    amount: `${formId}-amount`,
    currency: `${formId}-currency`,
    rate: `${formId}-rate`,
    description: `${formId}-description`,
    payerId: `${formId}-payer`,
    participants: `${formId}-participants`,
    date: `${formId}-date`,
    category: `${formId}-category`,
    notes: `${formId}-notes`,
    splitType: `${formId}-split-type`,
    split: `${formId}-split`,
  };
  const set = <K extends keyof FormFields>(key: K, value: FormFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));
  const splitType = fields.splitType as SplitType;
  const values = splitType === "equal" ? {} : splitValues[splitType];
  const setValue = (memberId: string, value: string) =>
    splitType !== "equal" &&
    setSplitValues((v) => ({ ...v, [splitType]: { ...v[splitType], [memberId]: value } }));

  const currency: CurrencyCode = isCurrencyCode(fields.currency) ? fields.currency : group.currency;
  const foreign = currency !== group.currency;
  const amount = parseAmount(fields.amount, currency);
  const liveAmountError = fields.amount.trim() !== "" && !amount.ok ? amount.error : undefined;
  const split = amount.ok
    ? computeSplit({
        amount: amount.amount,
        currency,
        splitType,
        participantIds: fields.participantIds,
        memberOrder: group.members.map((m) => m.id),
        values,
      })
    : null;
  // Problems with a Member's value show as they type, once there's an amount.
  const valueErrors = split ? (split.ok ? undefined : split.memberErrors) : failure?.splitValueErrors;
  const participants = group.members.filter((m) => fields.participantIds.includes(m.id));
  // After a failed save, the Split's problem tracks what's typed now, so it
  // never contradicts the preview.
  const splitError = errors?.split && (split ? (split.ok ? undefined : split.error) : errors.split);
  // A Split problem no longer applies once the Expense is split equally.
  // Memoised: the summary takes focus whenever its errors object changes.
  const summaryErrors = useMemo(
    () => (splitType === "equal" && errors?.split ? { ...errors, split: undefined } : errors),
    [errors, splitType],
  );
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown member";
  const selectedCount = pickable.filter((m) => fields.participantIds.includes(m.id)).length;
  // The Locked Rate this Expense would get if saved now, for the preview.
  const lock = lockRate({ typed: fields.rate, currency, group, existing: expense ?? undefined, rates });
  const converted =
    foreign && lock.ok && split?.ok
      ? inGroupCurrency({ shares: split.shares, currency, lockedRate: lock.rate }, group.currency)
      : null;
  const relocking = expense !== null && foreign && currency !== expense.currency;
  const rateError = errors?.rate && (lock.ok ? undefined : lock.error);

  function changeCurrency(code: string) {
    // A typed rate was for the previous currency.
    setFields((f) => ({ ...f, currency: code, rate: "" }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await onSave({ ...fields, splitValues: values });
        if (result.ok) onSaved();
        else setFailure(result);
      } catch {
        setFailure({
          ok: false,
          errors: { form: "Couldn't save the Expense. Check your connection and try again." },
        });
      }
    });
  }

  const shownErrors = { ...errors, ...(liveAmountError ? { amount: liveAmountError } : {}) };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <ErrorSummary errors={summaryErrors} fieldIds={ids} />

      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
      <Field id={ids.amount} label={`Amount (${currency})`} error={shownErrors.amount}>
        {(describedBy, className) => (
          <input
            id={ids.amount}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={fields.amount}
            onChange={(e) => set("amount", e.target.value)}
            aria-invalid={shownErrors.amount ? true : undefined}
            aria-describedby={describedBy}
            className={cn(className, "amount text-xl font-semibold")}
            placeholder={currency === "JPY" ? "0" : "0.00"}
          />
        )}
      </Field>
      <Field id={ids.currency} label="Currency" error={errors?.currency}>
        {(describedBy, className) => (
          <select
            id={ids.currency}
            name="currency"
            value={fields.currency}
            onChange={(e) => changeCurrency(e.target.value)}
            aria-invalid={errors?.currency ? true : undefined}
            aria-describedby={describedBy}
            className={cn(className, "min-h-11 text-xl font-semibold")}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        )}
      </Field>
      </div>

      {foreign && (
        <ExchangeRateField
          id={ids.rate}
          currency={currency}
          groupCurrency={group.currency}
          typed={fields.rate}
          onChange={(rate) => set("rate", rate)}
          lock={lock}
          rates={rates}
          relocking={relocking}
          error={rateError}
        />
      )}

      <Field id={ids.description} label="Description" error={errors?.description}>
        {(describedBy, className) => (
          <input
            id={ids.description}
            name="description"
            maxLength={MAX_EXPENSE_DESCRIPTION_LENGTH}
            value={fields.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={errors?.description ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          />
        )}
      </Field>

      <fieldset
        id={ids.payerId}
        tabIndex={-1}
        className="flex flex-col gap-2 outline-none"
        aria-describedby={errors?.payerId ? `${ids.payerId}-error` : undefined}
      >
        <legend className="mb-2 text-sm font-semibold">Paid by</legend>
        <div className="flex flex-wrap gap-2">
          {pickable.map((member) => (
            <label key={member.id} className={chipClass}>
              <input
                type="radio"
                name="payerId"
                value={member.id}
                checked={fields.payerId === member.id}
                onChange={() => set("payerId", member.id)}
                className="sr-only"
              />
              <MemberAvatar member={member} size="sm" />
              {member.name}
              {member.id === currentMemberId && member.name !== GUEST_MEMBER_NAME && " (you)"}
            </label>
          ))}
        </div>
        {errors?.payerId && (
          <p id={`${ids.payerId}-error`} className="text-sm font-semibold text-error">
            {errors.payerId}
          </p>
        )}
      </fieldset>

      <fieldset
        id={ids.participants}
        tabIndex={-1}
        className="flex flex-col gap-2 outline-none"
        aria-describedby={[`${ids.participants}-count`, errors?.participants && `${ids.participants}-error`]
          .filter(Boolean)
          .join(" ")}
      >
        <legend className="mb-2 text-sm font-semibold">Split between</legend>
        <div className="flex flex-wrap gap-2">
          {pickable.map((member) => (
            <label key={member.id} className={chipClass}>
              <input
                type="checkbox"
                name="participantIds"
                value={member.id}
                checked={fields.participantIds.includes(member.id)}
                onChange={(e) =>
                  set(
                    "participantIds",
                    e.target.checked
                      ? [...fields.participantIds, member.id]
                      : fields.participantIds.filter((id) => id !== member.id),
                  )
                }
                className="sr-only"
              />
              <MemberAvatar member={member} size="sm" />
              {member.name}
            </label>
          ))}
        </div>
        <p id={`${ids.participants}-count`} aria-live="polite" className="text-sm text-text-secondary">
          {selectedCount} of {pickable.length} members selected
        </p>
        {errors?.participants && (
          <p id={`${ids.participants}-error`} className="text-sm font-semibold text-error">
            {errors.participants}
          </p>
        )}
      </fieldset>

      <fieldset
        id={ids.splitType}
        tabIndex={-1}
        className="flex flex-col gap-2 outline-none"
        aria-describedby={errors?.splitType ? `${ids.splitType}-error` : undefined}
      >
        <legend className="mb-2 text-sm font-semibold">Split type</legend>
        <div className="flex flex-wrap gap-2">
          {SPLIT_TYPE_OPTIONS.map((option) => (
            <label key={option.value} className={cn(chipClass, "pl-4")}>
              <input
                type="radio"
                name="splitType"
                value={option.value}
                checked={splitType === option.value}
                onChange={() => set("splitType", option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {errors?.splitType && (
          <p id={`${ids.splitType}-error`} className="text-sm font-semibold text-error">
            {errors.splitType}
          </p>
        )}
      </fieldset>

      {splitType !== "equal" && (
        <fieldset
          id={ids.split}
          tabIndex={-1}
          className="flex flex-col gap-3 outline-none"
          aria-describedby={splitError ? `${ids.split}-error` : undefined}
        >
          <legend className="mb-2 text-sm font-semibold">{SPLIT_VALUE_LEGENDS[splitType]}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {participants.map((member) => {
              const id = `${ids.split}-${member.id}`;
              const error = valueErrors?.[member.id];
              return (
                <Field
                  key={member.id}
                  id={id}
                  label={`${member.name} (${splitType === "exact" ? currency : splitType === "percentage" ? "%" : "shares"})`}
                  error={error}
                >
                  {(describedBy, className) => (
                    <input
                      id={id}
                      inputMode="decimal"
                      autoComplete="off"
                      value={values[member.id] ?? ""}
                      onChange={(e) => setValue(member.id, e.target.value)}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={describedBy}
                      className={cn(className, "amount")}
                      placeholder="0"
                    />
                  )}
                </Field>
              );
            })}
          </div>
          {splitError && (
            <p id={`${ids.split}-error`} className="text-sm font-semibold text-error">
              {splitError}
            </p>
          )}
        </fieldset>
      )}

      {/* Not a live region: it changes on every keystroke. */}
      <div
        data-testid="split-preview"
        className="rounded-md bg-bg-secondary px-4 py-3 text-sm"
      >
        {split?.ok && amount.ok && splitType !== "equal" ? (
          <ul>
            {split.shares.map((share) => (
              <li key={share.memberId}>
                {nameOf(share.memberId)}:{" "}
                {share.amount === 0 ? (
                  <span className="text-text-secondary">not charged</span>
                ) : (
                  <span className="amount font-semibold">
                    {formatMoney(share.amount, currency)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : split?.ok && amount.ok ? (
          <>
            <p className="amount font-semibold">
              {describeEqualSplit(amount.amount, currency, split.shares)}
            </p>
            {new Set(split.shares.map((s) => s.amount)).size > 1 && (
              <ul className="mt-1 text-text-secondary">
                {split.shares.map((share) => (
                  <li key={share.memberId}>
                    {nameOf(share.memberId)}:{" "}
                    <span className="amount">{formatMoney(share.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-text-secondary">
            {split && !split.ok ? split.error : "Enter an amount to see each Share."}
          </p>
        )}
        {converted && amount.ok && (
          <p className="amount mt-1 font-semibold" data-testid="converted-preview">
            {formatMoney(amount.amount, currency)} ≈ {formatMoney(converted.groupAmount, group.currency)}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={ids.date} label="Date" error={errors?.date}>
          {(describedBy, className) => (
            <input
              id={ids.date}
              name="date"
              type="date"
              value={fields.date}
              onChange={(e) => set("date", e.target.value)}
              aria-invalid={errors?.date ? true : undefined}
              aria-describedby={describedBy}
              className={cn(className, "min-h-11")}
            />
          )}
        </Field>
        <Field id={ids.category} label="Category" error={errors?.category}>
          {(describedBy, className) => (
            <select
              id={ids.category}
              name="category"
              value={fields.category}
              onChange={(e) => set("category", e.target.value)}
              aria-invalid={errors?.category ? true : undefined}
              aria-describedby={describedBy}
              className={cn(className, "min-h-11")}
            >
              {categoryOptions(group)
                .filter((o) => !o.custom)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              {(group.customCategories ?? []).length > 0 && (
                <optgroup label="This Group's Categories">
                  {categoryOptions(group)
                    .filter((o) => o.custom)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          )}
        </Field>
      </div>

      <Field id={ids.notes} label="Notes (optional)" error={errors?.notes}>
        {(describedBy, className) => (
          <textarea
            id={ids.notes}
            name="notes"
            rows={2}
            maxLength={MAX_EXPENSE_NOTES_LENGTH}
            value={fields.notes}
            onChange={(e) => set("notes", e.target.value)}
            aria-invalid={errors?.notes ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : expense ? "Save changes" : "Add Expense"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The Locked Rate for a foreign-currency Expense: today's rate (or the one it
 * already has) unless a Member types their own, which is marked manual.
 */
function ExchangeRateField({
  id,
  currency,
  groupCurrency,
  typed,
  onChange,
  lock,
  rates,
  relocking,
  error,
}: {
  id: string;
  currency: CurrencyCode;
  groupCurrency: CurrencyCode;
  typed: string;
  onChange: (rate: string) => void;
  lock: LockResult;
  rates: TodaysRatesState;
  relocking: boolean;
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
