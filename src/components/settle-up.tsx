"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { Dialog } from "radix-ui";
import { Coins, GitCompareArrows, HandCoins, PartyPopper, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { formatCalendarDate, pluralize, todayCalendarDate } from "@/lib/format";

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
 * Settle up, with no added cognitive load: the visitor's own action first in
 * one sentence, everyone else's Suggested Settlements collapsed. Small Change
 * clears in one tap, and every Balance at zero is celebrated.
 */
export function SettleUpSection({
  group,
  ledger,
  currentMemberId,
  settleUp,
  onNews,
}: {
  group: GroupSnapshot;
  ledger: Ledger;
  /** The visitor's own Member, if they have one in this Group. */
  currentMemberId: string | undefined;
  settleUp: SettleUp;
  onNews: (news: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [clearing, startClearing] = useTransition();
  const [clearError, setClearError] = useState("");
  const names = new Map(group.members.map((m) => [m.id, m.name]));
  const nameOf = (id: string) => names.get(id) ?? "Unknown member";
  const me = currentMemberId && names.has(currentMemberId) ? currentMemberId : undefined;
  const money = (amount: number) => formatMoney(amount, group.currency);

  const onlySmallChange = ledger.suggestions.length === 0 && ledger.smallChange.length > 0;
  const mine = ledger.suggestions.filter((s) => s.fromId === me || s.toId === me);
  const others = ledger.suggestions.filter((s) => s.fromId !== me && s.toId !== me);
  const explanation = explainSettlements(group);
  const sourcesOf = (s: SuggestedSettlement) =>
    [...explanation.suggestions, ...explanation.smallChange].find(
      (e) => e.fromId === s.fromId && e.toId === s.toId,
    )?.sources ?? [];
  const [showWhy, setShowWhy] = useState(false);

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

  const record = (suggestion: SuggestedSettlement | null, label: string) => (
    <RecordSettlement
      group={group}
      suggestion={suggestion}
      label={label}
      onRecord={settleUp.record}
      onRecorded={recorded}
      returnFocus={heading}
    />
  );

  const row = (s: SuggestedSettlement) => (
    <li key={`${s.fromId}-${s.toId}`} className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-semibold">{nameOf(s.fromId)}</span> pays{" "}
          <span className="font-semibold">{nameOf(s.toId)}</span>{" "}
          <span className="amount font-semibold">{money(s.amount)}</span>
        </p>
        {record(s, `Record: ${nameOf(s.fromId)} pays ${nameOf(s.toId)} ${money(s.amount)}`)}
      </div>
      {!s.sharedAnExpense && (
        <p className="text-sm text-text-secondary">
          {nameOf(s.fromId)} and {nameOf(s.toId)} never shared an Expense; settling directly
          saves the Group a Settlement.
        </p>
      )}
      <PaymentSources group={group} payerName={nameOf(s.fromId)} amount={s.amount} sources={sourcesOf(s)} />
    </li>
  );

  return (
    <section aria-labelledby="settle-up-heading">
      <h2
        id="settle-up-heading"
        ref={heading}
        tabIndex={-1}
        className="rounded-md text-lg font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        Settle up
      </h2>

      {ledger.settledUp ? (
        ledger.timeline.length === 0 ? (
          <p className="mt-2 text-text-secondary">Nothing to settle yet.</p>
        ) : (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-success bg-owed-subtle px-4 py-4 motion-safe:animate-[celebrate_var(--duration-slow)_ease-out]">
            <PartyPopper aria-hidden className="size-7 shrink-0 text-success" />
            <div>
              <p className="text-lg font-extrabold text-success">All settled up!</p>
              <p className="text-sm text-text-secondary">Every Balance is exactly zero.</p>
            </div>
          </div>
        )
      ) : onlySmallChange ? (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
          <p className="flex items-center gap-2 font-semibold">
            <Coins aria-hidden className="size-5 text-accent" /> Only Small Change left
          </p>
          <ul className="text-sm text-text-secondary">
            {ledger.smallChange.map((s) => (
              <li key={`${s.fromId}-${s.toId}`}>
                {nameOf(s.fromId)} pays {nameOf(s.toId)}{" "}
                <span className="amount">{money(s.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={clearSmallChange} disabled={clearing}>
              {clearing ? "Clearing…" : "Clear Small Change"}
            </Button>
            {clearError && <p className="text-sm font-semibold text-error">{clearError}</p>}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {me && (
            <PersonalAction
              me={me}
              mine={mine}
              ledger={ledger}
              nameOf={nameOf}
              money={money}
              record={record}
              sources={(s) => (
                <PaymentSources
                  group={group}
                  payerName={s.fromId === me ? "you" : nameOf(s.fromId)}
                  amount={s.amount}
                  sources={sourcesOf(s)}
                />
              )}
            />
          )}
          {others.length > 0 &&
            (me ? (
              <details className="rounded-lg border border-border bg-surface">
                <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold">
                  Other Suggested Settlements ({others.length})
                </summary>
                <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                  {others.map(row)}
                </ul>
              </details>
            ) : (
              <div>
                <h3 className="font-semibold">Suggested Settlements</h3>
                <ul className="mt-2 divide-y divide-border-subtle rounded-lg border border-border bg-surface">
                  {others.map(row)}
                </ul>
              </div>
            ))}
          <div>{record(null, "Record another Settlement")}</div>
        </div>
      )}

      {!ledger.settledUp && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <Button variant="ghost" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
              <GitCompareArrows aria-hidden /> {showWhy ? "Hide why" : "Why these payments?"}
            </Button>
          </div>
          {showWhy && <WhyThesePayments group={group} explanation={explanation} />}
        </div>
      )}
    </section>
  );
}

/** One sentence about the visitor's own action, e.g. "You owe $45.20 → pay Taylor $45.20". */
function PersonalAction({
  me,
  mine,
  ledger,
  nameOf,
  money,
  record,
  sources,
}: {
  me: string;
  mine: SuggestedSettlement[];
  ledger: Ledger;
  nameOf: (id: string) => string;
  money: (amount: number) => string;
  record: (suggestion: SuggestedSettlement, label: string) => React.ReactNode;
  /** Where a suggestion's amount comes from, expandable. */
  sources: (suggestion: SuggestedSettlement) => React.ReactNode;
}) {
  const balance = ledger.balances.find((b) => b.memberId === me)?.amount ?? 0;
  const list = (parts: string[]) =>
    parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

  // Small Change isn't suggested, so mention it when it's part of the Balance.
  const listed = mine.reduce((sum, s) => sum + s.amount, 0);
  const smallChange = Math.abs(balance) - listed;
  const plusSmallChange = smallChange > 0 ? ` (plus ${money(smallChange)} Small Change)` : "";

  let sentence: React.ReactNode;
  if (balance < 0 && mine.length > 0) {
    sentence = (
      <>
        You owe <span className="amount">{money(-balance)}</span>{" "}
        → pay{" "}
        {list(mine.map((s) => `${nameOf(s.toId)} ${money(s.amount)}`))}
        {plusSmallChange}
      </>
    );
  } else if (balance > 0 && mine.length > 0) {
    sentence = (
      <>
        You get back <span className="amount">{money(balance)}</span>{" "}
        →{" "}
        {list(mine.map((s) => `${nameOf(s.fromId)} pays you ${money(s.amount)}`))}
        {plusSmallChange}
      </>
    );
  } else {
    sentence = balance === 0 ? "You're settled up." : "You only have Small Change left.";
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent bg-surface px-4 py-4">
      <p className="flex items-start gap-2 text-lg font-bold">
        <HandCoins aria-hidden className="mt-1 size-5 shrink-0 text-accent" />
        <span>{sentence}</span>
      </p>
      {mine.map((s) => (
        <div key={`${s.fromId}-${s.toId}`} className="flex flex-col gap-1">
          {!s.sharedAnExpense && (
            <p className="text-sm text-text-secondary">
              {s.fromId === me
                ? `You and ${nameOf(s.toId)} never shared an Expense; settling with them directly saves the Group a Settlement.`
                : `You and ${nameOf(s.fromId)} never shared an Expense; settling with them directly saves the Group a Settlement.`}
            </p>
          )}
          {sources(s)}
          <div>
            {record(
              s,
              s.fromId === me
                ? `Record: you pay ${nameOf(s.toId)} ${money(s.amount)}`
                : `Record: ${nameOf(s.fromId)} pays you ${money(s.amount)}`,
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A button that opens the Settlement form, prefilled from a suggestion if given. */
function RecordSettlement({
  group,
  suggestion,
  label,
  onRecord,
  onRecorded,
  returnFocus,
}: {
  group: GroupSnapshot;
  suggestion: SuggestedSettlement | null;
  label: string;
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
        <Button variant={suggestion ? "default" : "outline"} aria-label={label}>
          {suggestion ? "Record" : label}
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
