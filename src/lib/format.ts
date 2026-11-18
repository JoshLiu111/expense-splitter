import { formatMoney, type CalendarDate, type CurrencyCode, type MinorUnits } from "@/domain";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "2024-03-26" → "Mar 26, 2024"; calendar dates have no time zone. */
export function formatCalendarDate(date: CalendarDate): string {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

/** "+$216.46", "−$219.49" (true minus sign), or "$0.00". */
export function formatSignedMoney(amount: MinorUnits, currency: CurrencyCode): string {
  const magnitude = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${magnitude}`;
  if (amount < 0) return `−${magnitude}`;
  return magnitude;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Today's calendar date where the visitor is (not UTC). */
export function todayCalendarDate(now = new Date()): CalendarDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "Jordan owes $219.49", "Alex gets back $216.46", "Sam is settled up". */
export function describeBalance(name: string, amount: MinorUnits, currency: CurrencyCode): string {
  if (amount > 0) return `${name} gets back ${formatMoney(amount, currency)}`;
  if (amount < 0) return `${name} owes ${formatMoney(-amount, currency)}`;
  return `${name} is settled up`;
}

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

/** "2024-03" → "March 2024" (or "Mar 24" when `short`). */
export function formatMonth(month: string, { short = false } = {}): string {
  return (short ? shortMonthFormatter : monthFormatter).format(new Date(`${month}-01T00:00:00Z`));
}
