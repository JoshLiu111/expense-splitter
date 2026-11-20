import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { groupCsv, groupCsvFileName, importSampleGroups, type Expense, type GroupSnapshot, type Settlement } from "./index";

const groups = importSampleGroups(sampleData);
const japan = groups.find((g) => g.id === "grp_japan_2024")!;

const BOM = "\uFEFF";

/** The CSV's rows, without the BOM, split on CRLF (no field in these tests spans lines). */
function rows(csv: string): string[] {
  return csv.slice(BOM.length).split("\r\n").slice(0, -1);
}

/** Reads CSV text (RFC 4180, after the BOM) into rows of fields. */
function parse(csv: string): string[][] {
  expect(csv.startsWith(BOM)).toBe(true);
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = csv.slice(BOM.length);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') {
      field += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (quoted) {
      field += c;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += c;
    }
  }
  expect(field).toBe("");
  return out;
}

/** Plain decimal text like "8.13" to minor units, without floating point. */
const minor = (text: string) => Number(text.replace(".", ""));

/** A USD Group of Alex and Blake. */
function usdGroup(expenses: Partial<Expense>[], settlements: Partial<Settlement>[] = []): GroupSnapshot {
  return {
    id: "grp_test",
    name: "Test",
    description: "",
    currency: "USD",
    members: [
      { id: "a", name: "Alex", avatarColor: "#000000" },
      { id: "b", name: "Blake", avatarColor: "#000000" },
    ],
    expenses: expenses.map((e, i) => ({
      id: `exp_${i}`,
      description: `Expense ${i}`,
      amount: 0,
      currency: "USD",
      lockedRate: "1",
      payerId: "a",
      splitType: "exact",
      shares: [],
      date: "2024-03-01",
      createdAt: `2024-03-01T00:00:0${i}.000Z`,
      category: "Other",
      ...e,
    })),
    settlements: settlements.map((s, i) => ({
      id: `stl_${i}`,
      fromId: "b",
      toId: "a",
      amount: 0,
      date: "2024-03-02",
      createdAt: `2024-03-02T00:00:0${i}.000Z`,
      ...s,
    })),
  };
}

describe("Group CSV: Expenses", () => {
  it("has a header naming each Member's Share column, then one row per Expense", () => {
    const group = usdGroup([
      {
        description: "Dinner",
        amount: 6001,
        category: "Food & Drink",
        splitType: "equal",
        shares: [
          { memberId: "a", amount: 3001 },
          { memberId: "b", amount: 3000 },
        ],
      },
    ]);
    expect(rows(groupCsv(group))).toEqual([
      "Type,Date,Description,Category,Payer,From,To,Expense Currency,Expense Amount,Locked Rate,Amount (USD),Split Type,Notes,Share: Alex (USD),Share: Blake (USD)",
      "Expense,2024-03-01,Dinner,Food & Drink,Alex,,,USD,60.01,1,60.01,Equal,,30.01,30.00",
    ]);
  });
});

describe("Group CSV: Expense Currency", () => {
  it("shows an Expense in another currency at its Locked Rate, with each Share in the Group Currency", () => {
    const [header, ...body] = parse(groupCsv(japan));
    const snacks = body.find((row) => row[2] === "Fushimi Inari snacks & drinks")!;
    const cell = (name: string) => snacks[header.indexOf(name)];
    expect(cell("Expense Currency")).toBe("JPY");
    expect(cell("Expense Amount")).toBe("4850");
    expect(cell("Locked Rate")).toBe("0.0067");
    expect(cell("Amount (USD)")).toBe("32.50");
    expect(cell("Payer")).toBe("Jordan Park");
    // ¥1,213 × 0.0067 = $8.1271 → $8.13; ¥1,212 × 0.0067 = $8.1204 → $8.12.
    expect(cell("Share: Alex Chen (USD)")).toBe("8.13");
    expect(cell("Share: Jordan Park (USD)")).toBe("8.13");
    expect(cell("Share: Sam Rivera (USD)")).toBe("8.12");
    expect(cell("Share: Taylor Kim (USD)")).toBe("8.12");
  });

  it.each(groups.map((g) => [g.name, g] as const))(
    "%s: every Expense's Shares sum to its Group Currency amount",
    (_name, group) => {
      const [header, ...body] = parse(groupCsv(group));
      const amount = header.indexOf(`Amount (${group.currency})`);
      const shareColumns = header.flatMap((name, i) => (name.startsWith("Share: ") ? [i] : []));
      const expenses = body.filter((row) => row[0] === "Expense");
      expect(expenses).toHaveLength(group.expenses.length);
      for (const row of expenses) {
        const shares = shareColumns.reduce((sum, i) => sum + (row[i] ? minor(row[i]) : 0), 0);
        expect(shares, row[2]).toBe(minor(row[amount]));
      }
    },
  );
});

describe("Group CSV: spreadsheet safety", () => {
  it("quotes fields with commas, quotes or line breaks, doubling the quotes", () => {
    const group = usdGroup([
      {
        description: 'Pizza, "large"',
        notes: "Line one\nline two",
        amount: 1000,
        shares: [{ memberId: "a", amount: 1000 }],
      },
    ]);
    group.members[0].name = "Chen, Alex";
    const csv = groupCsv(group);
    expect(csv).toContain('"Share: Chen, Alex (USD)"');
    expect(csv).toContain(
      'Expense,2024-03-01,"Pizza, ""large""",Other,"Chen, Alex",,,USD,10.00,1,10.00,Exact,"Line one\nline two",10.00,\r\n',
    );
    expect(parse(csv)[1].slice(2, 5)).toEqual(['Pizza, "large"', "Other", "Chen, Alex"]);
  });

  it("keeps text a spreadsheet would run as a formula as plain text", () => {
    const group = usdGroup([
      {
        description: '=HYPERLINK("https://example.test","Click")',
        notes: "+1 for later",
        amount: 1000,
        shares: [{ memberId: "a", amount: 1000 }],
      },
    ]);
    group.settlements.push({ id: "stl_x", fromId: "b", toId: "a", amount: 100, date: "2024-03-02", createdAt: "" });
    group.members[1].name = "@Blake";
    const [header, expense, settlement] = parse(groupCsv(group));
    expect(expense[header.indexOf("Description")]).toBe(`'=HYPERLINK("https://example.test","Click")`);
    expect(expense[header.indexOf("Notes")]).toBe("'+1 for later");
    expect(settlement[header.indexOf("From")]).toBe("'@Blake");
  });
});

describe("Group CSV: Settlements", () => {
  it("lists each Settlement from one Member to another, in date order among the Expenses, oldest first", () => {
    const group = usdGroup(
      [
        { description: "Later", date: "2024-03-03", amount: 500, shares: [{ memberId: "b", amount: 500 }] },
        { description: "Earlier", date: "2024-03-01", amount: 500, shares: [{ memberId: "b", amount: 500 }] },
      ],
      [{ fromId: "b", toId: "a", amount: 2500, date: "2024-03-02" }],
    );
    expect(rows(groupCsv(group)).slice(1)).toEqual([
      "Expense,2024-03-01,Earlier,Other,Alex,,,USD,5.00,1,5.00,Exact,,,5.00",
      "Settlement,2024-03-02,,,,Blake,Alex,,,,25.00,,,,",
      "Expense,2024-03-03,Later,Other,Alex,,,USD,5.00,1,5.00,Exact,,,5.00",
    ]);
  });
});

describe("Group CSV: Former Members", () => {
  it("labels a Former Member wherever they appear", () => {
    const group = usdGroup(
      [{ amount: 500, payerId: "b", shares: [{ memberId: "b", amount: 500 }] }],
      [{ fromId: "a", toId: "b", amount: 100 }],
    );
    group.members[1].former = true;
    const [header, expense, settlement] = parse(groupCsv(group));
    expect(header.at(-1)).toBe("Share: Blake (Former Member) (USD)");
    expect(expense[header.indexOf("Payer")]).toBe("Blake (Former Member)");
    expect(settlement[header.indexOf("To")]).toBe("Blake (Former Member)");
  });
});

describe("Group CSV: file name", () => {
  it("is named after the Group", () => {
    expect(groupCsvFileName(japan)).toBe("Trip to Japan.csv");
  });

  it("drops characters file systems don't allow, keeping the rest of the name", () => {
    expect(groupCsvFileName({ name: 'Rent: 2024/25 "Q1"?' })).toBe("Rent 2024 25 Q1.csv");
    expect(groupCsvFileName({ name: "東京 · 旅行" })).toBe("東京 · 旅行.csv");
    expect(groupCsvFileName({ name: "/// " })).toBe("Group.csv");
  });
});
