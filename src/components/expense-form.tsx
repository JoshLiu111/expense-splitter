"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import {
  CATEGORIES,
  amountText,
  MAX_EXPENSE_DESCRIPTION_LENGTH,
  MAX_EXPENSE_NOTES_LENGTH,
  computeSplit,
  describeEqualSplit,
  formatMoney,
  parseAmount,
  type Expense,
  type GroupSnapshot,
  type NewExpenseFields,
} from "@/domain";
import type { ExpenseResult } from "@/expenses/save-expense";
import { GUEST_MEMBER_NAME } from "@/guest/guest-repository";
import { ErrorSummary, Field } from "@/components/form";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { todayCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Form values for a new Expense: paid by me, split equally among everyone. */
function initialFields(
  group: GroupSnapshot,
  expense: Expense | null,
  currentMemberId: string | undefined,
): NewExpenseFields {
  if (expense) {
    return {
      amount: amountText(expense.amount, expense.currency),
      description: expense.description,
      date: expense.date,
      category: expense.category,
      payerId: expense.payerId,
      participantIds: expense.shares.map((s) => s.memberId),
      notes: expense.notes ?? "",
    };
  }
  return {
    amount: "",
    description: "",
    date: todayCalendarDate(),
    category: "Other",
    payerId: currentMemberId ?? group.members[0]?.id ?? "",
    participantIds: group.members.map((m) => m.id),
    notes: "",
  };
}

const chipClass =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border-input bg-surface py-1 pr-4 pl-1 text-sm font-semibold transition-colors duration-(--duration-fast) has-checked:border-accent has-checked:bg-accent-subtle has-focus-visible:ring-[3px] has-focus-visible:ring-ring";

/**
 * Add or edit an Equal Expense. Amount comes first; the default is paid by
 * the current Member and split equally among everyone, with a live preview.
 */
export function ExpenseForm({
  group,
  expense,
  currentMemberId,
  onSave,
  onCancel,
  onSaved,
}: {
  group: GroupSnapshot;
  /** The Expense being edited, or `null` to add one. */
  expense: Expense | null;
  currentMemberId: string | undefined;
  onSave: (fields: NewExpenseFields) => Promise<ExpenseResult>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState(() => initialFields(group, expense, currentMemberId));
  const [errors, setErrors] = useState<Extract<ExpenseResult, { ok: false }>["errors"]>();
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const ids = {
    amount: `${formId}-amount`,
    description: `${formId}-description`,
    payerId: `${formId}-payer`,
    participants: `${formId}-participants`,
    date: `${formId}-date`,
    category: `${formId}-category`,
    notes: `${formId}-notes`,
  };
  const set = <K extends keyof NewExpenseFields>(key: K, value: NewExpenseFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const amount = parseAmount(fields.amount, group.currency);
  const liveAmountError = fields.amount.trim() !== "" && !amount.ok ? amount.error : undefined;
  const split = amount.ok
    ? computeSplit({
        amount: amount.amount,
        currency: group.currency,
        splitType: "equal",
        participantIds: fields.participantIds,
        memberOrder: group.members.map((m) => m.id),
      })
    : null;
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown member";
  const selectedCount = group.members.filter((m) => fields.participantIds.includes(m.id)).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await onSave(fields);
        if (result.ok) onSaved();
        else setErrors(result.errors);
      } catch {
        setErrors({ form: "Couldn't save the Expense. Check your connection and try again." });
      }
    });
  }

  const shownErrors = { ...errors, ...(liveAmountError ? { amount: liveAmountError } : {}) };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <ErrorSummary errors={errors} fieldIds={ids} />

      <Field id={ids.amount} label={`Amount (${group.currency})`} error={shownErrors.amount}>
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
            placeholder={group.currency === "JPY" ? "0" : "0.00"}
          />
        )}
      </Field>

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
          {group.members.map((member) => (
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
        <legend className="mb-2 text-sm font-semibold">Split equally between</legend>
        <div className="flex flex-wrap gap-2">
          {group.members.map((member) => (
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
          {selectedCount} of {group.members.length} members selected
        </p>
        {errors?.participants && (
          <p id={`${ids.participants}-error`} className="text-sm font-semibold text-error">
            {errors.participants}
          </p>
        )}
      </fieldset>

      {/* Not a live region: it changes on every keystroke. */}
      <div
        data-testid="split-preview"
        className="rounded-md bg-bg-secondary px-4 py-3 text-sm"
      >
        {split?.ok && amount.ok ? (
          <>
            <p className="amount font-semibold">
              {describeEqualSplit(amount.amount, group.currency, split.shares)}
            </p>
            {new Set(split.shares.map((s) => s.amount)).size > 1 && (
              <ul className="mt-1 text-text-secondary">
                {split.shares.map((share) => (
                  <li key={share.memberId}>
                    {nameOf(share.memberId)}:{" "}
                    <span className="amount">{formatMoney(share.amount, group.currency)}</span>
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
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
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
