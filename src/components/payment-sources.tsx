import { formatMoney, type GroupSnapshot, type SettlementSource } from "@/domain";
import { formatCalendarDate, pluralize } from "@/lib/format";

/**
 * Where a Suggested Settlement's amount comes from: a disclosure summarised
 * by its first source ("From “Kyoto ryokan (2 nights)” and 3 other expenses")
 * that expands to every source; the amounts add up to the suggestion.
 */
export function PaymentSources({
  group,
  payerName,
  amount,
  sources,
}: {
  group: GroupSnapshot;
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
              {source.amount < source.full && <span className="text-text-secondary"> of {money(source.full)}</span>}
            </span>
          </li>
        ))}
        <li className="flex flex-wrap justify-between gap-x-3 border-t border-border-subtle pt-1 text-text-secondary">
          <span>What {payerName} owes from these, after what they paid for others</span>
          <span className="amount font-semibold text-text-primary">{money(amount)}</span>
        </li>
      </ul>
    </details>
  );
}
