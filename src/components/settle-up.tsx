"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { Dialog } from "radix-ui";
import { ArrowDownLeft, ArrowUpRight, Check, GitCompareArrows, Plus, X } from "lucide-react";
import {
  amountText,
  computeLedger,
  CURRENCY_CODES,
  explainSettlements,
  formatMoney,
  isCurrencyCode,
  lockRate,
  memberLabel,
  membersInBalances,
  parseAmount,
  settleableAmount,
  settlementAmountFor,
  settlementInGroupCurrency,
  settleUpStatus,
  validateSettlement,
  type CurrencyCode,
  type GroupSnapshot,
  type Ledger,
  type NewSettlementFields,
  type SuggestedSettlement,
} from "@/domain";
import type { SettlementResult, SettleUp } from "@/settlements/settle-up";
import { ExchangeRateField } from "@/components/exchange-rate-field";
import { neverSharedReason } from "@/components/never-shared-reason";
import { ErrorSummary, Field } from "@/components/form";
import { AvatarStack, TransferPair } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { pluralize, todayCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TodaysRatesState } from "@/rates/use-todays-rates";

// The graph is secondary, so its code loads only when asked for.
const WhyThesePayments = dynamic(() => import("@/components/why-these-payments"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-text-secondary">
      Loading the graph…
    </p>
  ),
});

type Failure = Extract<SettlementResult, { ok: false }>;

const OFFLINE: Failure = {
  ok: false,
  errors: { form: "Couldn't save the Settlement. Check your connection and try again." },
};

async function attempt(call: () => Promise<SettlementResult>): Promise<SettlementResult> {
  try {
    return await call();
  } catch {
    return OFFLINE;
  }
}

const dialogClass =
  "fixed top-1/2 left-1/2 z-50 max-h-[92dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg outline-none";

/**
 * The settle-up hero: the first thing on the Group page. Open Debts lead with
 * the visitor's own payment as the largest figure (with a one-line reason
 * when its two Members never shared an Expense), then everyone else's
 * Suggested Settlements as one-line rows; "Record a payment" shows only when
 * the visitor has no Suggested Settlement of their own;
 * Small Change clears in one tap; Settled Up is the Settled Up Moment; a
 * Group with no Expenses leads to adding the first. Read-only, it shows the
 * same standing but offers nothing to record, clear or add.
 */
export function SettleUpSection({
  group,
  rates,
  ledger,
  currentMemberId,
  settleUp,
  onNews,
  onAddExpense,
  readOnly = false,
}: {
  group: GroupSnapshot;
  /** Today's exchange rates, for a Settlement in another Settlement Currency. */
  rates: TodaysRatesState;
  ledger: Ledger;
  /** The visitor's own Member, if they have one in this Group. */
  currentMemberId: string | undefined;
  settleUp: SettleUp;
  onNews: (news: string) => void;
  /** Opens the Expense editor, for a Group with no Expenses yet. */
  onAddExpense: () => void;
  /** For a Former Member reading a reopened Balance (ADR 0006): nothing to act on. */
  readOnly?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [clearing, startClearing] = useTransition();
  const [clearError, setClearError] = useState("");
  const [showWhy, setShowWhy] = useState(false);
  const members = new Map(group.members.map((m) => [m.id, m]));
  const nameOf = (id: string) => members.get(id)?.name ?? "Unknown member";
  const memberOf = (id: string) => members.get(id)!;
  const me = currentMemberId && members.has(currentMemberId) ? currentMemberId : undefined;
  const money = (amount: number) => formatMoney(amount, group.currency);

  const status = settleUpStatus(ledger);
  const mine = ledger.suggestions.filter((s) => s.fromId === me || s.toId === me);
  // A visitor with a payment of their own records it there; "Record a payment" is for everyone else.
  const hasOwnSuggestion = mine.length > 0;
  const others = ledger.suggestions.filter((s) => s.fromId !== me && s.toId !== me);
  const myBalance = ledger.balances.find((b) => b.memberId === me)?.amount ?? 0;

  function recorded(news: string) {
    onNews(news);
    heading.current?.focus();
  }

  function clearSmallChange() {
    setClearError("");
    startClearing(async () => {
      const result = await attempt(() => settleUp.clearSmallChange(todayCalendarDate()));
      if (result.ok) recorded("Small Change cleared.");
      else setClearError(result.errors.form ?? "Couldn't clear the Small Change.");
    });
  }

  const record = (suggestion: SuggestedSettlement | null, label: string, trigger: RecordTrigger) =>
    readOnly ? null : (
      <RecordSettlement
        group={group}
        rates={rates}
        suggestion={suggestion}
        label={label}
        trigger={trigger}
        onRecord={settleUp.record}
        onRecorded={recorded}
        returnFocus={heading}
      />
    );

  return (
    <section
      aria-labelledby="settle-up-heading"
      className={cn(
        "hero-panel",
        // A scale pop only: the panel stays white.
        status.state === "settled" && "motion-safe:animate-[celebrate_var(--duration-slow)_ease-out]",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="settle-up-heading"
          ref={heading}
          tabIndex={-1}
          className="rounded-md text-lg font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Settle up
        </h2>
        {status.state === "open" && (
          <p className="text-sm text-text-secondary">
            {pluralize(status.payments, "payment")},{" "}
            <span className="amount font-semibold text-text-primary">{money(status.total)}</span> in total
          </p>
        )}
      </div>

      {status.state === "empty" && (
        <div className="mt-6 flex flex-col items-center py-4 text-center">
          <AvatarStack members={group.members.filter((m) => !m.former)} size="md" />
          <p className="mt-5 text-2xl font-extrabold">No Expenses yet</p>
          <p className="mt-1 max-w-sm text-text-secondary">
            Record who paid for what, and the payments that settle this Group appear here.
          </p>
          {!readOnly && (
            <Button onClick={onAddExpense} className="mt-5 px-5">
              <Plus aria-hidden /> Add the first Expense
            </Button>
          )}
        </div>
      )}

      {status.state === "settled" && (
        <div className="mt-6 flex flex-col items-center py-4 text-center">
          <span className="relative">
            <AvatarStack members={membersInBalances(group)} size="md" />
            <span className="absolute -right-6 -bottom-1 inline-flex size-7 items-center justify-center rounded-full bg-success text-on-accent ring-2 ring-surface">
              <Check aria-hidden className="size-4" strokeWidth={3} />
            </span>
          </span>
          <p className="mt-5 text-2xl font-extrabold text-text-primary">Everyone is Settled Up</p>
          <p className="mt-1 text-text-secondary">
            <span className="amount font-semibold text-text-primary">{money(ledger.totalSpent)}</span> shared,
            nothing outstanding.
          </p>
        </div>
      )}

      {status.state === "small" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            {me && <YourStanding balance={myBalance} money={money} className="mb-1" />}
            <p className="text-text-secondary">
              <span className="amount font-semibold text-text-primary">{money(status.total)}</span> of Small
              Change left; nothing worth a payment.
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-col items-start gap-2">
              <Button variant="outline" onClick={clearSmallChange} disabled={clearing} className="px-5">
                {clearing ? "Clearing…" : "Clear Small Change"}
              </Button>
              {clearError && <p className="text-sm font-semibold text-error">{clearError}</p>}
            </div>
          )}
        </div>
      )}

      {status.state === "open" && (
        <>
          {me && !hasOwnSuggestion && (
            <YourStanding balance={myBalance} money={money} className="mt-4 border-b border-border pb-4" />
          )}
          {mine.map((s) => {
            const youPay = s.fromId === me;
            const other = youPay ? s.toId : s.fromId;
            const reason = neverSharedReason(group, s, youPay ? "payer" : "recipient");
            return (
              <div
                key={`${s.fromId}-${s.toId}`}
                className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 border-b border-border py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <TransferPair from={memberOf(s.fromId)} to={memberOf(s.toId)} size="lg" />
                <p className={cn("min-w-0", youPay ? "text-owe" : "text-owed")}>
                  <span className="block font-extrabold break-words">
                    {youPay ? `You pay ${nameOf(other)}` : `${nameOf(other)} pays you`}
                  </span>
                  <span className="amount block text-xl leading-tight font-semibold sm:text-3xl">
                    {money(s.amount)}
                  </span>
                </p>
                {/* Under the payment: right of the avatars on wide screens, full width above Record on phones. */}
                {reason && (
                  <p className="col-span-2 min-w-0 text-sm break-words text-text-secondary sm:col-start-2">
                    {reason}
                  </p>
                )}
                {record(
                  s,
                  youPay
                    ? `Record: you pay ${nameOf(other)} ${money(s.amount)}`
                    : `Record: ${nameOf(other)} pays you ${money(s.amount)}`,
                  {
                    variant: "default",
                    text: "Record this payment",
                    className: "col-span-2 px-5 sm:col-span-1 sm:col-start-3 sm:row-start-1",
                  },
                )}
              </div>
            );
          })}

          {others.length > 0 && (
            <ul
              aria-label={me ? "Other Suggested Settlements" : "Suggested Settlements"}
              className={hasOwnSuggestion ? "mt-2" : "mt-4"}
            >
              {others.map((s) => (
                <li
                  key={`${s.fromId}-${s.toId}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-subtle py-3 last:border-b-0"
                >
                  <TransferPair from={memberOf(s.fromId)} to={memberOf(s.toId)} />
                  {/* On phones the names take their own line, so a long one never pushes the figure out. */}
                  <p className="order-last min-w-0 basis-full break-words text-text-secondary sm:order-none sm:flex-1 sm:basis-0">
                    <span className="font-semibold text-text-primary">{nameOf(s.fromId)}</span> pays{" "}
                    <span className="font-semibold text-text-primary">{nameOf(s.toId)}</span>
                    <span className="sr-only"> {money(s.amount)}</span>
                  </p>
                  <span aria-hidden className="amount ml-auto font-semibold">
                    {money(s.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* "Record this payment" opens a form that can be changed to any Settlement. */}
            {!hasOwnSuggestion &&
              record(null, "Record a payment", { variant: "outline", text: "Record a payment", className: "px-5" })}
            <Button
              variant="quiet"
              aria-expanded={showWhy}
              onClick={() => setShowWhy((v) => !v)}
              // Alone on its line, its icon lines up with the content edge, as in the comp.
              className={hasOwnSuggestion ? "-ml-3" : undefined}
            >
              <GitCompareArrows aria-hidden /> {showWhy ? "Hide why" : "Why these payments?"}
            </Button>
          </div>
          {showWhy && (
            <div className="mt-3">
              <WhyThesePayments group={group} explanation={explainSettlements(group)} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The visitor's own line when no Suggested Settlement involves them: settled
 * up themselves, or holding only Small Change.
 */
function YourStanding({
  balance,
  money,
  className,
}: {
  balance: number;
  money: (amount: number) => string;
  className?: string;
}) {
  if (balance === 0) {
    return (
      <p className={cn("font-extrabold", className)}>You&apos;re settled up</p>
    );
  }
  return (
    <p className={cn("flex items-center gap-2 font-extrabold", balance < 0 ? "text-owe" : "text-owed", className)}>
      {balance < 0 ? (
        <ArrowUpRight aria-hidden className="size-5 shrink-0" strokeWidth={2.5} />
      ) : (
        <ArrowDownLeft aria-hidden className="size-5 shrink-0" strokeWidth={2.5} />
      )}
      <span>
        {balance < 0 ? "You owe" : "You get back"} Small Change of{" "}
        <span className="amount">{money(Math.abs(balance))}</span>
      </span>
    </p>
  );
}

/** The Record button's role in the button hierarchy and its visible text. */
type RecordTrigger = { variant: "default" | "outline" | "quiet"; text: string; className?: string };

/** A button that opens the Settlement form, prefilled from a suggestion if given. */
function RecordSettlement({
  group,
  rates,
  suggestion,
  label,
  trigger,
  onRecord,
  onRecorded,
  returnFocus,
}: {
  group: GroupSnapshot;
  rates: TodaysRatesState;
  suggestion: SuggestedSettlement | null;
  /** The trigger's accessible name, e.g. "Record: Sam pays Taylor $3.03". */
  label: string;
  trigger: RecordTrigger;
  onRecord: SettleUp["record"];
  onRecorded: (news: string) => void;
  /** Where focus goes once recorded, since this button may be gone. */
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const done = useRef(false);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) done.current = false;
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          variant={trigger.variant}
          aria-label={trigger.text === label ? undefined : label}
          className={trigger.className}
        >
          {trigger.text}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          aria-describedby={undefined}
          className={dialogClass}
          onCloseAutoFocus={(event) => {
            if (!done.current) return;
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <Dialog.Title className="text-lg font-bold">Record a Settlement</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <SettlementForm
            group={group}
            rates={rates}
            suggestion={suggestion}
            onRecord={onRecord}
            onRecorded={(news) => {
              done.current = true;
              setOpen(false);
              onRecorded(news);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettlementForm({
  group,
  rates,
  suggestion,
  onRecord,
  onRecorded,
}: {
  group: GroupSnapshot;
  rates: TodaysRatesState;
  suggestion: SuggestedSettlement | null;
  onRecord: SettleUp["record"];
  onRecorded: (news: string) => void;
}) {
  const members = membersInBalances(group);
  const [fields, setFields] = useState<NewSettlementFields>({
    fromId: suggestion?.fromId ?? "",
    toId: suggestion?.toId ?? "",
    amount: "",
    currency: group.currency,
    rate: "",
    date: todayCalendarDate(),
  });
  // Opened from a Suggested Settlement, the amount follows the currency and
  // rate until the Member types one; changing the currency follows again.
  const [amountTyped, setAmountTyped] = useState(false);
  const [failure, setFailure] = useState<Failure>();
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const ids = {
    fromId: `${formId}-from`,
    toId: `${formId}-to`,
    amount: `${formId}-amount`,
    currency: `${formId}-currency`,
    rate: `${formId}-rate`,
    date: `${formId}-date`,
  };
  const errors = failure?.errors;
  const set = (key: keyof NewSettlementFields, value: string) => setFields((f) => ({ ...f, [key]: value }));
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "";

  const currency: CurrencyCode = isCurrencyCode(fields.currency) ? fields.currency : group.currency;
  const foreign = currency !== group.currency;
  // The Locked Rate this Settlement would get if recorded now.
  const lock = lockRate({ typed: fields.rate, currency, group, rates });
  const rateError = errors?.rate && (lock.ok ? undefined : lock.error);

  // The amount as shown: typed, or prefilled from the Suggested Settlement.
  const shownAmount = (() => {
    if (!suggestion || amountTyped) return fields.amount;
    if (!lock.ok) return "";
    // The Suggested Settlement in the Settlement Currency, never converting
    // to more than can be settled.
    const prefilled = settlementAmountFor({
      amount: suggestion.amount,
      max: settleableAmount(group, fields.fromId, fields.toId) || suggestion.amount,
      currency,
      groupCurrency: group.currency,
      rate: lock.rate,
    });
    return prefilled === null ? "" : amountText(prefilled, currency);
  })();

  // The amount in the Group Currency at the rate it would be locked at.
  const groupAmount = (() => {
    const parsed = parseAmount(shownAmount, currency);
    if (!parsed.ok || !lock.ok) return null;
    return settlementInGroupCurrency({ amount: parsed.amount, currency, lockedRate: lock.rate }, group.currency);
  })();
  // What's left for the payer after this Settlement, as a live preview.
  const remaining = (() => {
    if (!groupAmount) return null;
    const proposed = { fromId: fields.fromId, toId: fields.toId, amount: groupAmount };
    if (!validateSettlement(group, proposed).ok) return null;
    const owes = -(computeLedger(group).balances.find((b) => b.memberId === fields.fromId)?.amount ?? 0);
    return owes - groupAmount;
  })();
  const describeRemaining = (left: number) =>
    left > 0
      ? `${nameOf(fields.fromId)} will still owe ${formatMoney(left, group.currency)}.`
      : `${nameOf(fields.fromId)} will be settled up.`;
  const amountHint = [
    foreign && groupAmount !== null && `${formatMoney(groupAmount, group.currency)} at this rate.`,
    remaining !== null && `After this, ${describeRemaining(remaining)}`,
  ]
    .filter(Boolean)
    .join(" ");

  function changeCurrency(code: string) {
    // A typed rate was for the previous currency.
    setFields((f) => ({ ...f, currency: code, rate: "" }));
    setAmountTyped(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const left = remaining;
    startTransition(async () => {
      const result = await attempt(() => onRecord({ ...fields, amount: shownAmount }));
      if (!result.ok) setFailure(result);
      else onRecorded(`Settlement recorded.${left === null ? "" : ` ${describeRemaining(left)}`}`);
    });
  }

  const select = (key: "fromId" | "toId", label: string, placeholder: string) => (
    <Field id={ids[key]} label={label} error={errors?.[key]}>
      {(describedBy, className) => (
        <select
          id={ids[key]}
          value={fields[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={errors?.[key] ? true : undefined}
          aria-describedby={describedBy}
          className={`${className} min-h-11`}
        >
          <option value="">{placeholder}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <ErrorSummary errors={errors} fieldIds={ids} />
      {select("fromId", "Paid by", "Choose who paid")}
      {select("toId", "Paid to", "Choose who was paid")}
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <Field id={ids.amount} label={`Amount (${currency})`} hint={amountHint || undefined} error={errors?.amount}>
          {(describedBy, className) => (
            <input
              id={ids.amount}
              inputMode="decimal"
              autoComplete="off"
              value={shownAmount}
              onChange={(e) => {
                setAmountTyped(true);
                set("amount", e.target.value);
              }}
              aria-invalid={errors?.amount ? true : undefined}
              aria-describedby={describedBy}
              className={`${className} amount`}
            />
          )}
        </Field>
        <Field id={ids.currency} label="Currency" error={errors?.currency}>
          {(describedBy, className) => (
            <select
              id={ids.currency}
              value={fields.currency}
              onChange={(e) => changeCurrency(e.target.value)}
              aria-invalid={errors?.currency ? true : undefined}
              aria-describedby={describedBy}
              className={`${className} min-h-11`}
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
          error={rateError}
        />
      )}
      <Field id={ids.date} label="Date" error={errors?.date}>
        {(describedBy, className) => (
          <input
            id={ids.date}
            type="date"
            value={fields.date}
            onChange={(e) => set("date", e.target.value)}
            aria-invalid={errors?.date ? true : undefined}
            aria-describedby={describedBy}
            className={`${className} min-h-11`}
          />
        )}
      </Field>
      <div className="flex flex-wrap justify-end gap-3">
        <Dialog.Close asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Dialog.Close>
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record Settlement"}
        </Button>
      </div>
    </form>
  );
}
