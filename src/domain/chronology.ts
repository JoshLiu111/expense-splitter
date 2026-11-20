import type { CalendarDate } from "./types";

/** Something recorded in a Group on a date: an Expense or a Settlement. */
export interface Recorded {
  date: CalendarDate;
  /** ISO timestamp; breaks ties on the same date. */
  createdAt: string;
}

/** Sort order for Expenses and Settlements: oldest first, by date then creation time. */
export function oldestFirst(a: Recorded, b: Recorded): number {
  return compare(a.date, b.date) || compare(a.createdAt, b.createdAt);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
