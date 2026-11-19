import type { CalendarDate } from "@/domain";
import { formatCalendarDate } from "@/lib/format";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** One date in the ledger's date column and the entries recorded on it. */
export interface LedgerDay<T> {
  date: CalendarDate;
  /** "26" */
  day: string;
  /** "Mar" (shown uppercase) */
  month: string;
  /** "Mar 26, 2024", for screen readers and the tooltip. */
  label: string;
  /** "2024", on the first date and wherever the year changes. */
  year?: string;
  entries: T[];
}

/**
 * Groups ledger entries by date; same-day entries keep their order. Expects
 * them sorted by date, as the timeline and filtered Expenses are.
 */
export function ledgerDays<T extends { date: CalendarDate }>(entries: T[]): LedgerDay<T>[] {
  const days: LedgerDay<T>[] = [];
  for (const entry of entries) {
    const last = days.at(-1);
    if (last?.date === entry.date) {
      last.entries.push(entry);
      continue;
    }
    const calendarDay = new Date(`${entry.date}T00:00:00Z`);
    const year = String(calendarDay.getUTCFullYear());
    const yearChanged = last === undefined || !last.date.startsWith(year);
    days.push({
      date: entry.date,
      day: String(calendarDay.getUTCDate()),
      month: MONTH.format(calendarDay),
      label: formatCalendarDate(entry.date),
      year: yearChanged ? year : undefined,
      entries: [entry],
    });
  }
  return days;
}
