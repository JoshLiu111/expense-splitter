import { monthRange, type CalendarDate } from "@/domain";

const pad = (n: number) => String(n).padStart(2, "0");

/** A month, `YYYY-MM`, as Sunday-first weeks of dates, with `null` before the 1st and after the last day. */
export function monthWeeks(month: string): (CalendarDate | null)[][] {
  const [year, m] = month.split("-").map(Number);
  const lastDay = Number(monthRange(month).to.slice(8));
  const cells: (CalendarDate | null)[] = Array(new Date(Date.UTC(year, m - 1, 1)).getUTCDay()).fill(null);
  for (let day = 1; day <= lastDay; day++) cells.push(`${month}-${pad(day)}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** `YYYY-MM` moved by a number of months. */
export function addMonths(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, m - 1 + by, 1));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}`;
}

/** A date moved by a number of days, kept within its own month. */
export function moveWithinMonth(date: CalendarDate, by: number): CalendarDate {
  const month = date.slice(0, 7);
  const lastDay = Number(monthRange(month).to.slice(8));
  const day = Math.min(Math.max(Number(date.slice(8)) + by, 1), lastDay);
  return `${month}-${pad(day)}`;
}
