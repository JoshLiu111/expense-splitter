import { categoryName, memberLabel, monthRange, type ExpenseFilter, type GroupSnapshot } from "@/domain";
import { formatCalendarDate, formatMonth } from "@/lib/format";

export type FilterChip = {
  key: string;
  label: string;
  /** The filter once this chip is removed. */
  without: ExpenseFilter;
};

function omit(filter: ExpenseFilter, ...keys: (keyof ExpenseFilter)[]): ExpenseFilter {
  const next = { ...filter };
  for (const key of keys) delete next[key];
  return next;
}

/**
 * The active filters as removable chips, in the order the filter form lists
 * them. A range covering exactly one calendar month reads as that month.
 */
export function filterChips(group: GroupSnapshot, filter: ExpenseFilter): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filter.category) {
    chips.push({ key: "category", label: categoryName(group, filter.category), without: omit(filter, "category") });
  }
  if (filter.memberId) {
    const member = group.members.find((m) => m.id === filter.memberId);
    chips.push({
      key: "memberId",
      label: member ? memberLabel(member) : "Unknown member",
      without: omit(filter, "memberId"),
    });
  }
  const month = filter.from?.slice(0, 7);
  const range = month ? monthRange(month) : undefined;
  if (month && range && range.from === filter.from && range.to === filter.to) {
    chips.push({ key: "month", label: formatMonth(month), without: omit(filter, "from", "to") });
  } else {
    if (filter.from) {
      chips.push({ key: "from", label: `From ${formatCalendarDate(filter.from)}`, without: omit(filter, "from") });
    }
    if (filter.to) {
      chips.push({ key: "to", label: `To ${formatCalendarDate(filter.to)}`, without: omit(filter, "to") });
    }
  }
  return chips;
}
