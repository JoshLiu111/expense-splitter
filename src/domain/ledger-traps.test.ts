import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import {
  computeLedger,
  formatMoney,
  importSampleGroups,
  type Expense,
  type GroupSnapshot,
} from "./index";

const members = ["a", "b", "c"].map((id) => ({
  id,
  name: id.toUpperCase(),
  avatarColor: "#000000",
}));

function usdGroup(expenses: Partial<Expense>[]): GroupSnapshot {
  return {
    id: "grp_test",
    name: "Test",
    description: "",
    currency: "USD",
    members,
    settlements: [],
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
      createdAt: "2024-03-01T00:00:00.000Z",
      category: "Other",
      ...e,
    })),
  };
}

const balances = (group: GroupSnapshot) =>
  Object.fromEntries(
    computeLedger(group).balances.map((b) => [b.memberId, b.amount]),
  );

describe("Compute Ledger: data traps", () => {
  it("treats JPY amounts as whole yen (zero exponent), not hundredths", () => {
    const group = usdGroup([
      {
        amount: 1213,
        currency: "JPY",
        lockedRate: "0.0067",
        shares: [{ memberId: "b", amount: 1213 }],
      },
    ]);
    // ¥1,213 × 0.0067 = $8.1271 → $8.13
    expect(balances(group)).toEqual({ a: 813, b: -813, c: 0 });
  });

  it("converts ¥4,850 at 0.0067 to exactly $32.50 despite 4850 × 0.0067 being 32.495000000000005 in floats", () => {
    const group = usdGroup([
      {
        amount: 4850,
        currency: "JPY",
        lockedRate: "0.0067",
        shares: [{ memberId: "b", amount: 4850 }],
      },
    ]);
    expect(balances(group)).toEqual({ a: 3250, b: -3250, c: 0 });
  });

  it("rounds each converted Share on its own line, so lines add up to the Balance", () => {
    // Each ¥5 Share is $0.0335 → $0.03. Per-total rounding would credit the
    // Payer $0.10 (¥15 × 0.0067 = $0.1005); per-line credits $0.09.
    const group = usdGroup([
      {
        amount: 15,
        currency: "JPY",
        lockedRate: "0.0067",
        shares: [
          { memberId: "a", amount: 5 },
          { memberId: "b", amount: 5 },
          { memberId: "c", amount: 5 },
        ],
      },
    ]);
    expect(balances(group)).toEqual({ a: 6, b: -3, c: -3 });
  });

  it("lists the timeline newest first regardless of input order", () => {
    const group = usdGroup([
      { id: "exp_mid", date: "2024-03-05", createdAt: "2024-03-05T10:00:00.000Z" },
      { id: "exp_new", date: "2024-03-09", createdAt: "2024-03-09T10:00:00.000Z" },
      { id: "exp_old", date: "2024-03-01", createdAt: "2024-03-01T10:00:00.000Z" },
    ]);
    group.settlements = [
      {
        id: "stl_1",
        fromId: "b",
        toId: "a",
        amount: 0,
        currency: "USD",
        lockedRate: "1",
        date: "2024-03-07",
        createdAt: "2024-03-07T10:00:00.000Z",
      },
    ];
    expect(computeLedger(group).timeline.map((t) => t.id)).toEqual([
      "exp_new",
      "stl_1",
      "exp_mid",
      "exp_old",
    ]);
  });

  it("orders entries on the same calendar date by creation time, newest first", () => {
    const group = usdGroup([
      { id: "exp_morning", date: "2024-03-05", createdAt: "2024-03-05T08:00:00.000Z" },
      { id: "exp_evening", date: "2024-03-05", createdAt: "2024-03-05T20:00:00.000Z" },
    ]);
    expect(computeLedger(group).timeline.map((t) => t.id)).toEqual([
      "exp_evening",
      "exp_morning",
    ]);
  });

  it("imports a UTC datetime as its UTC calendar date, never the previous day", () => {
    // 02:00Z on 1 January is still 31 December in US time zones.
    const [group] = importSampleGroups({
      groups: [
        {
          id: "grp_tz",
          name: "TZ",
          description: "",
          currency: "USD",
          createdAt: "2024-01-01T00:00:00Z",
          members: [{ id: "a", name: "A", avatarColor: "#000000" }],
          settlements: [],
          expenses: [
            {
              id: "exp_rent",
              description: "Rent",
              amount: 100,
              currency: "USD",
              exchangeRate: 1,
              paidBy: "a",
              splitType: "equal",
              splits: [{ memberId: "a", amount: 100 }],
              date: "2024-01-01T02:00:00Z",
              category: "Housing",
            },
          ],
        },
      ],
    });
    expect(computeLedger(group).timeline[0].date).toBe("2024-01-01");
  });

  it("does not list a Member with an explicit $0 Share as owing", () => {
    const camping = importSampleGroups(sampleData).find((g) => g.id === "grp_camping")!;
    const gas = computeLedger(camping).timeline.find((t) => t.id === "exp_404");
    if (gas?.kind !== "expense") throw new Error("exp_404 missing");
    expect(gas.owing.map((o) => o.memberId)).toEqual([
      "mem_lily",
      "mem_omar",
      "mem_rachel",
      "mem_dev",
    ]);
  });

  it("shows each owing line in both the Expense Currency and the Group Currency", () => {
    const group = usdGroup([
      {
        amount: 1213,
        currency: "JPY",
        lockedRate: "0.0067",
        shares: [{ memberId: "b", amount: 1213 }],
      },
    ]);
    const [entry] = computeLedger(group).timeline;
    if (entry.kind !== "expense") throw new Error("expected an Expense");
    expect(entry.groupAmount).toBe(813);
    expect(entry.owing).toEqual([{ memberId: "b", amount: 1213, groupAmount: 813 }]);
  });
});

describe("Compute Ledger: Group summary", () => {
  it("counts Expenses and totals what was spent in the Group Currency", () => {
    const birthday = importSampleGroups(sampleData).find((g) => g.id === "grp_birthday")!;
    const ledger = computeLedger(birthday);
    expect(ledger.expenseCount).toBe(4);
    expect(ledger.totalSpent).toBe(35749);
  });

  it("is Settled Up only when every Balance is exactly zero", () => {
    expect(computeLedger(usdGroup([])).settledUp).toBe(true);
    const oneCentOff = usdGroup([{ amount: 1, shares: [{ memberId: "b", amount: 1 }] }]);
    expect(computeLedger(oneCentOff).settledUp).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formats amounts per currency", () => {
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
    expect(formatMoney(123456, "JPY")).toBe("¥123,456");
    expect(formatMoney(-4520, "USD")).toBe("-$45.20");
    expect(formatMoney(10000, "EUR")).toBe("€100.00");
  });
});
