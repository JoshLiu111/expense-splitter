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
