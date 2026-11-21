"use client";

import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Circle, type LucideIcon } from "lucide-react";
import {
  formatMoney,
  myCalendar,
  myCalendarOpeningMonth,
  type CalendarDate,
  type CalendarTally,
  type GroupSnapshot,
  type Member,
} from "@/domain";
import { addMonths, monthWeeks, moveWithinMonth } from "@/components/month-grid";
import { Button } from "@/components/ui/button";
import { formatCalendarDate, formatMonth, pluralize, todayCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The three marks, told apart by shape alone (a dot, an arrow in, an arrow
 * out) and all in ink: cobalt is for what's interactive and debt red and
 * credit green are for Balances only (DESIGN.md). In the order they appear in
 * a cell and in the summary.
 */
const MARKS: {
  kind: keyof CalendarTally;
  label: string;
  /** For a day's name: "2 Expenses paid". */
  count: (n: number) => string;
  Icon: LucideIcon;
  className: string;
}[] = [
  {
    kind: "paid",
    label: "Paid for Expenses",
    count: (n) => `${pluralize(n, "Expense")} paid`,
    Icon: Circle,
    // Filled, so a size smaller to weigh the same as the arrows.
    className: "size-2.5 fill-current",
  },
  {
    kind: "settlementsReceived",
    label: "Received in Settlements",
    count: (n) => `${pluralize(n, "Settlement")} received`,
    Icon: ArrowDownLeft,
    className: "size-3.5",
  },
  {
    kind: "settlementsMade",
    label: "Paid in Settlements",
    count: (n) => `${pluralize(n, "Settlement")} paid`,
    Icon: ArrowUpRight,
    className: "size-3.5",
  },
];

const WEEKDAYS = [
  ["S", "Sunday"],
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
];

/** Today's date never announces a change; it's read again on each render. */
const subscribeNever = () => () => {};
/** The server knows no visitor's time zone, so it renders UTC's date; the visitor's own follows. */
const utcToday = () => new Date().toISOString().slice(0, 10);

/**
 * My Calendar: one month of what moved for one Member (see `myCalendar`).
 * Each day is marked for Expenses they paid for, Settlements they received
 * and Settlements they paid, each by its own shape; amounts
 * are only in the month's summary, so cells fit a phone. A grid of day
 * buttons, one tab stop, moved through with the arrow keys; a marked day
 * opens Expenses at that date. Opens on the current month, or the Member's
 * most recent month with something in it.
 */
export function MyCalendar({
  group,
  member,
  isYou,
  onOpenDay,
}: {
  group: GroupSnapshot;
  member: Member;
  /** False when the calendar stands in for the visitor, as for a Guest in a sample Group. */
  isYou: boolean;
  onOpenDay: (date: CalendarDate) => void;
}) {
  const id = useId();
  const today = useSyncExternalStore(subscribeNever, todayCalendarDate, utcToday);
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const month = chosenMonth ?? myCalendarOpeningMonth(group, member.id, today);
  const calendar = myCalendar(group, member.id, month);
  const days = new Map(calendar.days.map((day) => [day.date, day]));

  const [focused, setFocused] = useState<CalendarDate | null>(null);
  // The grid's one tab stop: the day last moved to, else the first marked day, today or the 1st.
  const tabStop =
    focused?.startsWith(`${month}-`)
      ? focused
      : (calendar.days[0]?.date ?? (today.startsWith(`${month}-`) ? today : `${month}-01`));
  const grid = useRef<HTMLTableElement>(null);

  function showMonth(by: number) {
    setChosenMonth(addMonths(month, by));
    setFocused(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: CalendarDate) {
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (by === undefined) return;
    event.preventDefault();
    const next = moveWithinMonth(date, by);
    setFocused(next);
    grid.current?.querySelector<HTMLButtonElement>(`button[data-date="${next}"]`)?.focus();
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border">
        <h2 id={`${id}-heading`} className="text-lg font-extrabold">
          My Calendar
        </h2>
        <div className="-mr-2.5 flex items-center">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => showMonth(-1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <h3 id={`${id}-month`} aria-live="polite" className="min-w-32 text-center text-sm font-bold">
            {formatMonth(month)}
          </h3>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => showMonth(1)}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      {!isYou && (
        <p className="mt-3 text-sm text-text-secondary">
          Showing <span className="font-semibold text-text-primary">{member.name}</span>, standing in for you in this
          sample Group.
        </p>
      )}

      <table ref={grid} role="grid" aria-labelledby={`${id}-heading ${id}-month`} className="mt-3 w-full table-fixed">
        <thead>
          <tr>
            {WEEKDAYS.map(([short, long]) => (
              <th key={long} scope="col" abbr={long} className="pb-1 text-xs font-semibold text-text-secondary">
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month).map((week) => (
            <tr key={week.find(Boolean)}>
              {week.map((date, i) => {
                if (!date) return <td key={i} />;
                const day = days.get(date);
                const marks = MARKS.filter((mark) => (day?.counts[mark.kind] ?? 0) > 0);
                const name = [
                  formatCalendarDate(date),
                  marks.length ? marks.map((mark) => mark.count(day!.counts[mark.kind])).join(", ") : "nothing",
                ].join(": ");
                return (
                  <td key={date} className="p-0.5">
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === tabStop ? 0 : -1}
                      aria-label={name}
                      aria-disabled={marks.length === 0 || undefined}
                      aria-current={date === today ? "date" : undefined}
                      onClick={() => day && onOpenDay(date)}
                      onFocus={() => setFocused(date)}
                      onKeyDown={(event) => onKeyDown(event, date)}
                      className={cn(
                        "flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg py-1 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                        day ? "cursor-pointer font-semibold hover:bg-bg-tertiary" : "cursor-default text-text-secondary",
                      )}
                    >
                      {/* Today is underlined, not tinted: a tint would read as selected. */}
                      <span className={cn(date === today && "underline decoration-2 underline-offset-4")}>
                        {Number(date.slice(8))}
                      </span>
                      <span aria-hidden className="flex h-3.5 items-center gap-0.5">
                        {marks.map(({ kind, Icon, className }) => (
                          <Icon key={kind} className={className} strokeWidth={3} />
                        ))}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {calendar.days.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">
          Nothing paid or received by {isYou ? "you" : member.name} in {formatMonth(month)}.
        </p>
      ) : (
        <dl
          aria-label={`${formatMonth(month)} summary`}
          className="mt-3 flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:gap-x-8"
        >
          {MARKS.map(({ kind, label, Icon, className }) => (
            <div key={kind} className="flex items-center justify-between gap-2 text-sm sm:justify-start">
              <dt className="flex items-center gap-1.5 whitespace-nowrap text-text-secondary">
                <Icon aria-hidden className={className} strokeWidth={3} />
                {label}
              </dt>
              <dd className="amount font-semibold">{formatMoney(calendar.totals[kind], group.currency)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
