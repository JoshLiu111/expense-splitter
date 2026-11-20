import { categoryName } from "./categories";
import { amountText } from "./currency";
import { inGroupCurrency } from "./ledger";
import { memberLabel } from "./manage-group";
import type { GroupSnapshot, SplitType } from "./types";

const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  equal: "Equal",
  exact: "Exact",
  percentage: "Percentage",
  shares: "Shares",
};

/**
 * Export a Group as CSV: one row per Expense and Settlement. Amounts are
 * exact decimal strings from integer minor units (ADR 0001); each Share is
 * in the Group Currency at the Expense's Locked Rate, rounded on its own
 * line, so an Expense's Shares sum to its Group Currency amount.
 */
export function groupCsv(group: GroupSnapshot): string {
  const g = group.currency;
  const nameOf = (memberId: string) => {
    const member = group.members.find((m) => m.id === memberId);
    return member ? memberLabel(member) : "";
  };
  const header = [
    "Type",
    "Date",
    "Description",
    "Category",
    "Paid by",
    "Paid to",
    "Expense Currency",
    "Expense Amount",
    "Locked Rate",
    `Amount (${g})`,
    "Split Type",
    "Notes",
    ...group.members.map((m) => `Share: ${memberLabel(m)} (${g})`),
  ];
  const rows: { cells: string[]; date: string; createdAt: string }[] = [];

  for (const expense of group.expenses) {
    const { lines, groupAmount } = inGroupCurrency(expense, g);
    rows.push({ date: expense.date, createdAt: expense.createdAt, cells: [
      "Expense",
      expense.date,
      expense.description,
      categoryName(group, expense.category),
      nameOf(expense.payerId),
      "",
      expense.currency,
      amountText(expense.amount, expense.currency),
      expense.lockedRate,
      amountText(groupAmount, g),
      SPLIT_TYPE_LABELS[expense.splitType],
      expense.notes ?? "",
      ...group.members.map((m) => {
        const line = lines.find((l) => l.memberId === m.id);
        return line ? amountText(line.groupAmount, g) : "";
      }),
    ] });
  }

  for (const settlement of group.settlements) {
    rows.push({
      date: settlement.date,
      createdAt: settlement.createdAt,
      cells: [
        "Settlement",
        settlement.date,
        "",
        "",
        nameOf(settlement.fromId),
        nameOf(settlement.toId),
        "",
        "",
        "",
        amountText(settlement.amount, g),
        "",
        "",
        ...group.members.map(() => ""),
      ],
    });
  }

  // Oldest first, by date then creation time, as in a Member Statement.
  rows.sort((x, y) => compare(x.date, y.date) || compare(x.createdAt, y.createdAt));
  const table = [header, ...rows.map((row) => row.cells)];

  return "\uFEFF" + table.map((row) => row.map(field).join(",") + "\r\n").join("");
}

/**
 * One RFC 4180 field: quoted, with quotes doubled, when it holds a comma,
 * quote or line break. Text a spreadsheet would run as a formula (any
 * Member can name an Expense "=HYPERLINK(…)") is kept as text with a
 * leading apostrophe; amounts are never negative, so none is affected.
 */
function field(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The export's file name: the Group's name with characters file systems
 * don't allow (and control characters) turned into spaces, e.g.
 * "Trip to Japan.csv".
 */
export function groupCsvFileName(group: Pick<GroupSnapshot, "name">): string {
  const name = group.name
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  return `${name || "Group"}.csv`;
}
