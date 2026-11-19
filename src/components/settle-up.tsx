"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { Dialog } from "radix-ui";
import { ArrowDownLeft, ArrowUpRight, Check, GitCompareArrows, Plus, X } from "lucide-react";
import {
  amountText,
  computeLedger,
  explainSettlements,
  formatMoney,
  memberLabel,
  membersInBalances,
  parseAmount,
  validateSettlement,
  type GroupSnapshot,
  type Ledger,
  type SettlementSource,
  type NewSettlementFields,
  type SuggestedSettlement,
} from "@/domain";
import type { SettlementResult, SettleUp } from "@/settlements/settle-up";
import { ErrorSummary, Field } from "@/components/form";
import { AvatarStack, TransferPair } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { formatCalendarDate, pluralize, todayCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";

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
 * the visitor's own payment as the largest figure, then everyone else's
 * Suggested Settlements; Small Change clears in one tap; Settled Up is the
 * Settled Up Moment; a Group with no Expenses leads to adding the first.
 */
export function SettleUpSection({
  group,
  ledger,
  currentMemberId,
  settleUp,
  onNews,
  onAddExpense,
}: {
  group: GroupSnapshot;
  ledger: Ledger;
  /** The visitor's own Member, if they have one in this Group. */
  currentMemberId: string | undefined;
  settleUp: SettleUp;
  onNews: (news: string) => void;
  /** Opens the Expense editor, for a Group with no Expenses yet. */
  onAddExpense: () => void;
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

  const state: "empty" | "settled" | "small" | "open" =
    // Not just "no Expenses": Settlements left after deleting every Expense still leave Balances.
    ledger.timeline.length === 0
      ? "empty"
      : ledger.settledUp
        ? "settled"
        : ledger.suggestions.length === 0
          ? "small"
          : "open";
  const mine = ledger.suggestions.filter((s) => s.fromId === me || s.toId === me);
  const others = ledger.suggestions.filter((s) => s.fromId !== me && s.toId !== me);
  const myBalance = ledger.balances.find((b) => b.memberId === me)?.amount ?? 0;
  const explanation = explainSettlements(group);
  const sourcesOf = (s: SuggestedSettlement) =>
    [...explanation.suggestions, ...explanation.smallChange].find(
      (e) => e.fromId === s.fromId && e.toId === s.toId,
    )?.sources ?? [];

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

  const record = (suggestion: SuggestedSettlement | null, label: string, trigger: RecordTrigger) => (
    <RecordSettlement
      group={group}
      suggestion={suggestion}
      label={label}
      trigger={trigger}
      onRecord={settleUp.record}
      onRecorded={recorded}
      returnFocus={heading}
    />
  );

  const outstanding = ledger.suggestions.reduce((sum, s) => sum + s.amount, 0);
  const mineTotal = mine.reduce((sum, s) => sum + s.amount, 0);
  const whyToggle = (
    <Button variant="quiet" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)} className="-mx-3">
      <GitCompareArrows aria-hidden /> {showWhy ? "Hide why" : "Why these payments?"}
    </Button>
  );
  const smallChangeTotal = ledger.smallChange.reduce((sum, s) => sum + s.amount, 0);

  return (
    <section
      aria-labelledby="settle-up-heading"
      className={cn(
        "hero-panel",
        state === "settled" &&
          "border-success bg-owed-subtle motion-safe:animate-[celebrate_var(--duration-slow)_ease-out]",
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
        {state === "open" && (
          <p className="text-sm text-text-secondary">
            {pluralize(ledger.suggestions.length, "payment")},{" "}
            <span className="amount font-semibold text-text-primary">{money(outstanding)}</span> in total
          </p>
        )}
      </div>

      {state === "empty" && (
        <div className="mt-4 flex flex-col items-center py-4 text-center">
          <AvatarStack members={group.members} size="md" />
          <p className="mt-5 text-xl font-extrabold">No Expenses yet</p>
          <p className="mt-1 max-w-sm text-text-secondary">
            Record who paid for what, and the payments that settle this Group appear here.
          </p>
          <Button onClick={onAddExpense} className="mt-5 px-5">
            <Plus aria-hidden /> Add the first Expense
          </Button>
        </div>
      )}

      {state === "settled" && (
        <div className="mt-4 flex flex-col items-center py-4 text-center">
          <span className="relative">
            <AvatarStack members={membersInBalances(group)} size="md" ring="ring-owed-subtle" />
            <span className="absolute -right-6 -bottom-1 inline-flex size-7 items-center justify-center rounded-full bg-success text-on-accent ring-2 ring-owed-subtle">
              <Check aria-hidden className="size-4" strokeWidth={3} />
            </span>
          </span>
          <p className="mt-5 text-lg font-extrabold text-success">All settled up!</p>
          <p className="mt-1 text-text-secondary">
            Every Balance is exactly zero:{" "}
            <span className="amount font-semibold text-text-primary">{money(ledger.totalSpent)}</span> shared,
            nothing outstanding.
          </p>
        </div>
      )}

      {state === "small" && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {me && <YourStanding balance={myBalance} money={money} />}
            <p className="text-text-secondary">
              Only Small Change left:{" "}
              <span className="amount font-semibold text-text-primary">{money(smallChangeTotal)}</span>, nothing
              worth a payment.
            </p>
            <ul className="mt-1 text-sm text-text-secondary">
              {ledger.smallChange.map((s) => (
                <li key={`${s.fromId}-${s.toId}`} className="break-words">
                  {nameOf(s.fromId)} pays {nameOf(s.toId)} <span className="amount">{money(s.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button variant="outline" onClick={clearSmallChange} disabled={clearing} className="px-5">
              {clearing ? "Clearing…" : "Clear Small Change"}
            </Button>
            {clearError && <p className="text-sm font-semibold text-error">{clearError}</p>}
          </div>
        </div>
      )}

      {state === "open" && (
        <>
          {me && mine.length === 0 && (
            <div className="mt-4 border-b border-border pb-4">
              <YourStanding balance={myBalance} money={money} />
            </div>
          )}
          {mine.map((s) => {
            const youPay = s.fromId === me;
            const other = youPay ? s.toId : s.fromId;
            return (
              <div key={`${s.fromId}-${s.toId}`} className="mt-4 border-b border-border pb-5">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <TransferPair from={memberOf(s.fromId)} to={memberOf(s.toId)} size="lg" />
                  <p className={cn("min-w-0", youPay ? "text-owe" : "text-owed")}>
                    <span className="block font-extrabold break-words">
                      {youPay ? `You pay ${nameOf(other)}` : `${nameOf(other)} pays you`}
                    </span>
                    <span className="amount block text-xl leading-tight font-semibold sm:text-3xl">
                      {money(s.amount)}
                    </span>
                  </p>
                  {record(
                    s,
                    youPay
                      ? `Record: you pay ${nameOf(other)} ${money(s.amount)}`
                      : `Record: ${nameOf(other)} pays you ${money(s.amount)}`,
                    { variant: "default", text: "Record this payment", className: "col-span-2 px-5 sm:col-span-1" },
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {!s.sharedAnExpense && (
                    <p className="text-sm text-text-secondary">
                      You and {nameOf(other)} never shared an Expense; settling with them directly saves the Group
                      a Settlement.
                    </p>
                  )}
                  <PaymentSources
                    group={group}
                    payerName={youPay ? "you" : nameOf(s.fromId)}
                    amount={s.amount}
                    sources={sourcesOf(s)}
                  />
                </div>
              </div>
            );
          })}
          {me && mine.length > 0 && Math.abs(myBalance) > mineTotal && (
            <p className="mt-2 text-sm text-text-secondary">
              Plus{" "}
              <span className="amount">
                {money(Math.abs(myBalance) - mineTotal)}
              </span>{" "}
              of Small Change, not worth a payment.
            </p>
          )}

          {others.length > 0 && (
            <ul aria-label={me ? "Other Suggested Settlements" : "Suggested Settlements"} className="mt-2">
              {others.map((s) => (
                <li
                  key={`${s.fromId}-${s.toId}`}
                  className="border-b border-border-subtle py-3 last:border-b-0"
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                    <TransferPair from={memberOf(s.fromId)} to={memberOf(s.toId)} />
                    <p className="col-span-2 row-start-2 min-w-0 break-words text-text-secondary sm:col-span-1 sm:col-start-2 sm:row-start-1">
                      <span className="font-semibold text-text-primary">{nameOf(s.fromId)}</span> pays{" "}
                      <span className="font-semibold text-text-primary">{nameOf(s.toId)}</span>{" "}
                      <span className="sr-only">{money(s.amount)}</span>
                    </p>
                    <span aria-hidden className="amount col-start-3 row-start-1 justify-self-end font-semibold">
                      {money(s.amount)}
                    </span>
                    <div className="col-start-3 row-start-2 justify-self-end sm:col-start-4 sm:row-start-1">
                      {record(s, `Record: ${nameOf(s.fromId)} pays ${nameOf(s.toId)} ${money(s.amount)}`, {
                        variant: "quiet",
                        text: "Record",
                        className: "-mr-3",
                      })}
                    </div>
                  </div>
                  {!s.sharedAnExpense && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {nameOf(s.fromId)} and {nameOf(s.toId)} never shared an Expense; settling directly saves the
                      Group a Settlement.
                    </p>
                  )}
                  <PaymentSources
                    group={group}
                    payerName={nameOf(s.fromId)}
                    amount={s.amount}
                    sources={sourcesOf(s)}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            {record(null, "Record another Settlement", {
              variant: "outline",
              text: "Record another Settlement",
              className: "px-5",
            })}
            {whyToggle}
          </div>
        </>
      )}

      {state === "small" && (
        <div className="mt-3">{whyToggle}</div>
      )}
      {(state === "open" || state === "small") && showWhy && (
        <div className="mt-3">
          <WhyThesePayments group={group} explanation={explanation} />
        </div>
      )}
    </section>
  );
}

/**
 * The visitor's own line when no Suggested Settlement involves them: even
 * ("You're even"), or holding only Small Change.
 */
function YourStanding({ balance, money }: { balance: number; money: (amount: number) => string }) {
  if (balance === 0) {
    return (
      <p className="flex items-center gap-2 font-extrabold">
        <Check aria-hidden className="size-5 shrink-0 text-success" strokeWidth={3} />
        You&apos;re even: nothing for you to pay or get back.
      </p>
    );
  }
  return (
    <p className={cn("flex items-center gap-2 font-extrabold", balance < 0 ? "text-owe" : "text-owed")}>
      {balance < 0 ? (
        <ArrowUpRight aria-hidden className="size-5 shrink-0" strokeWidth={2.5} />
      ) : (
        <ArrowDownLeft aria-hidden className="size-5 shrink-0" strokeWidth={2.5} />
      )}
      <span>
        {balance < 0 ? "You owe" : "You get back"} only Small Change:{" "}
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
  suggestion,
  label,
  trigger,
  onRecord,
  onRecorded,
  returnFocus,
}: {
  group: GroupSnapshot;
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
  suggestion,
  onRecord,
  onRecorded,
}: {
  group: GroupSnapshot;
  suggestion: SuggestedSettlement | null;
  onRecord: SettleUp["record"];
  onRecorded: (news: string) => void;
}) {
  const members = membersInBalances(group);
  const [fields, setFields] = useState<NewSettlementFields>({
    fromId: suggestion?.fromId ?? "",
    toId: suggestion?.toId ?? "",
    amount: suggestion ? amountText(suggestion.amount, group.currency) : "",
    date: todayCalendarDate(),
  });
  const [failure, setFailure] = useState<Failure>();
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const ids = {
    fromId: `${formId}-from`,
    toId: `${formId}-to`,
    amount: `${formId}-amount`,
    date: `${formId}-date`,
  };
  const errors = failure?.errors;
  const set = (key: keyof NewSettlementFields, value: string) => setFields((f) => ({ ...f, [key]: value }));
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "";

  // What's left for the payer after this Settlement, as a live preview.
  const remaining = (() => {
    const amount = parseAmount(fields.amount, group.currency);
    if (!amount.ok) return null;
    const proposed = { fromId: fields.fromId, toId: fields.toId, amount: amount.amount };
    if (!validateSettlement(group, proposed).ok) return null;
    const owes = -(computeLedger(group).balances.find((b) => b.memberId === fields.fromId)?.amount ?? 0);
    return owes - amount.amount;
  })();
  const describeRemaining = (left: number) =>
    left > 0
      ? `${nameOf(fields.fromId)} will still owe ${formatMoney(left, group.currency)}.`
      : `${nameOf(fields.fromId)} will be settled up.`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const left = remaining;
    startTransition(async () => {
      const result = await attempt(() => onRecord(fields));
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
      <Field
        id={ids.amount}
        label={`Amount (${group.currency})`}
        hint={
          remaining === null
            ? `Settlements are always in the Group Currency. Paid in another currency? Convert it to ${group.currency} first.`
            : `After this, ${describeRemaining(remaining)}`
        }
        error={errors?.amount}
      >
        {(describedBy, className) => (
          <input
            id={ids.amount}
            inputMode="decimal"
            autoComplete="off"
            value={fields.amount}
            onChange={(e) => set("amount", e.target.value)}
            aria-invalid={errors?.amount ? true : undefined}
            aria-describedby={describedBy}
            className={`${className} amount`}
          />
        )}
      </Field>
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

/**
 * Where a Suggested Settlement's amount comes from, collapsed to one line
 * ("From “Kyoto ryokan (2 nights)” and 3 other expenses") that expands to
 * every source; the amounts add up to the suggestion.
 */
function PaymentSources({
  group,
  payerName,
  amount,
  sources,
}: {
  group: GroupSnapshot;
  /** Who pays, as the sentence should name them ("you" or a name). */
  payerName: string;
  amount: number;
  sources: SettlementSource[];
}) {
  if (sources.length === 0) return null;
  const money = (value: number) => formatMoney(value, group.currency);
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown member";
  const described = sources.map((source) => {
    if (source.kind === "expense") {
      const expense = group.expenses.find((e) => e.id === source.id);
      return {
        source,
        title: `“${expense?.description ?? "Deleted Expense"}”`,
        detail: expense ? `${nameOf(expense.payerId)} paid · ${formatCalendarDate(expense.date)}` : "",
      };
    }
    const settlement = group.settlements.find((s) => s.id === source.id);
    return {
      source,
      title: settlement ? `Settlement from ${nameOf(settlement.fromId)}` : "A Settlement",
      detail: settlement ? `received ${formatCalendarDate(settlement.date)}` : "",
    };
  });
  const rest = sources.slice(1);
  const restNoun = rest.every((s) => s.kind === "expense") ? "expense" : "item";
  const summary =
    rest.length === 0
      ? `From ${described[0].title}`
      : `From ${described[0].title} and ${pluralize(rest.length, `other ${restNoun}`)}`;

  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md font-semibold text-accent">
        {summary}
      </summary>
      <ul className="mt-1 flex flex-col gap-1 border-l-2 border-border pl-3">
        {described.map(({ source, title, detail }) => (
          <li key={`${source.kind}-${source.id}`} className="flex flex-wrap justify-between gap-x-3">
            <span className="min-w-0 break-words">
              <span className="font-semibold">{title}</span>
              {detail && <span className="text-text-secondary"> · {detail}</span>}
            </span>
            <span className="amount">
              {money(source.amount)}
              {source.amount < source.full && (
                <span className="text-text-secondary"> of {money(source.full)}</span>
              )}
            </span>
          </li>
        ))}
        <li className="flex flex-wrap justify-between gap-x-3 border-t border-border-subtle pt-1 text-text-secondary">
          <span>
            What {payerName} {payerName === "you" ? "owe" : "owes"} from these, after what{" "}
            {payerName === "you" ? "you" : "they"} paid for others
          </span>
          <span className="amount font-semibold text-text-primary">{money(amount)}</span>
        </li>
      </ul>
    </details>
  );
}
