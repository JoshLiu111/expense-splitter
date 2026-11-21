import { memberStatement, type StatementLine } from "./member-statement";
import type { CalendarDate, GroupSnapshot } from "./types";

/**
 * Per kind of what moved for one Member: Expenses they paid for as Payer
 * (the full amount, not their Share), Settlements they made and received.
 */
export interface CalendarTally {
  paid: number;
  settlementsMade: number;
  settlementsReceived: number;
}

export interface CalendarDay {
  date: CalendarDate;
  /** In the Group Currency's minor unit, at each Expense's and Settlement's Locked Rate. */
  totals: CalendarTally;
  /** How many Expenses and Settlements of each kind; a day is marked for each kind above 0. */
  counts: CalendarTally;
}

export interface MyCalendar {
  /** `YYYY-MM` */
  month: string;
  /** Only the days with something for the Member, oldest first. */
  days: CalendarDay[];
  /** The days' totals summed. */
  totals: CalendarTally;
}

/** The Member's Statement lines that show on My Calendar: all but Expenses they only have a Share in. */
function calendarLines(group: GroupSnapshot, memberId: string): StatementLine[] {
  return memberStatement(group, memberId).lines.filter(
    (line) => line.kind === "settlement" || line.expense.payerId === memberId,
  );
}

const zero = (): CalendarTally => ({ paid: 0, settlementsMade: 0, settlementsReceived: 0 });

/**
 * My Calendar: one month of what moved for one Member (a Former Member's
 * too), by day: the Expenses they paid for in full as Payer, and the
 * Settlements they made and received. Taken from their Member Statement, so
 * the amounts are in the Group Currency at each Expense's and Settlement's
 * Locked Rate and the months add up to the Statement's totals. Their Shares
 * aren't shown.
 */
export function myCalendar(group: GroupSnapshot, memberId: string, month: string): MyCalendar {
  const days = new Map<CalendarDate, CalendarDay>();
  const totals = zero();
  for (const line of calendarLines(group, memberId)) {
    if (!line.date.startsWith(`${month}-`)) continue;
    const kind: keyof CalendarTally =
      line.kind === "expense" ? "paid" : line.direction === "made" ? "settlementsMade" : "settlementsReceived";
    const amount = line.kind === "expense" ? line.paid : line.groupAmount;
    let day = days.get(line.date);
    if (!day) {
      day = { date: line.date, totals: zero(), counts: zero() };
      days.set(line.date, day);
    }
    day.totals[kind] += amount;
    day.counts[kind] += 1;
    totals[kind] += amount;
  }
  return { month, days: [...days.values()], totals };
}

/**
 * The month My Calendar opens on: the current one if it has something for
 * the Member, else their most recent earlier month with something, else
 * their nearest later one, else the current month.
 */
export function myCalendarOpeningMonth(group: GroupSnapshot, memberId: string, today: CalendarDate): string {
  const current = today.slice(0, 7);
  const months = [...new Set(calendarLines(group, memberId).map((line) => line.date.slice(0, 7)))].sort();
  if (months.includes(current)) return current;
  return months.filter((m) => m < current).at(-1) ?? months.find((m) => m > current) ?? current;
}
