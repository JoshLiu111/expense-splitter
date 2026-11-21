import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import {
  computeLedger,
  importSampleGroups,
  memberStatement,
  type Expense,
  type GroupSnapshot,
  type Settlement,
} from "./index";

const groups = importSampleGroups(sampleData);

const members = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), avatarColor: "#000000" }));

/** A USD Group of A, B and C. */
function usdGroup(expenses: Partial<Expense>[], settlements: Partial<Settlement>[] = []): GroupSnapshot {
  return {
    id: "grp_test",
    name: "Test",
    description: "",
    currency: "USD",
    members,
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
      currency: "USD" as const,
      lockedRate: "1",
      date: "2024-03-02",
      createdAt: `2024-03-02T00:00:0${i}.000Z`,
      ...s,
    })),
  };
}

describe("Member Statement: totals", () => {
  it.each(
    groups.flatMap((g) => g.members.map((m) => [g.name, m.name, g, m.id] as const)),
  )("%s: %s's lines total exactly their Balance", (_group, _member, g, memberId) => {
    const balance = computeLedger(g).balances.find((b) => b.memberId === memberId)!.amount;
    const statement = memberStatement(g, memberId);
    expect(statement.lines.reduce((sum, line) => sum + line.net, 0)).toBe(balance);
    expect(statement.balance).toBe(balance);
    const { paid, shares, settlementsMade, settlementsReceived } = statement.totals;
    expect(paid - shares + settlementsMade - settlementsReceived).toBe(balance);
  });
});

describe("Member Statement: Expense lines", () => {
  // ¥1,213 × 0.0067 = $8.1271 → $8.13; ¥1,212 × 0.0067 = $8.1204 → $8.12.
  const yen = usdGroup([
    {
      amount: 2425,
      currency: "JPY",
      lockedRate: "0.0067",
      payerId: "a",
      shares: [
        { memberId: "a", amount: 1213 },
        { memberId: "b", amount: 1212 },
      ],
    },
  ]);

  it("shows a Share in another Expense Currency in the Group Currency at the Locked Rate, with the Expense Currency amount", () => {
    expect(memberStatement(yen, "b").lines).toMatchObject([
      { kind: "expense", paid: 0, share: 812, expenseShare: 1212, net: -812 },
    ]);
  });

  it("credits the Payer the sum of the rounded Shares, not the rounded total", () => {
    // Each ¥5 Share is $0.0335 → $0.03, so the Payer is credited $0.09,
    // though ¥15 × 0.0067 = $0.1005 would round to $0.10.
    const group = usdGroup([
      {
        amount: 15,
        currency: "JPY",
        lockedRate: "0.0067",
        payerId: "a",
        shares: ["a", "b", "c"].map((memberId) => ({ memberId, amount: 5 })),
      },
    ]);
    expect(memberStatement(group, "a").lines).toMatchObject([
      { kind: "expense", paid: 9, share: 3, expenseShare: 5, net: 6 },
    ]);
  });

  it("keeps a Share that rounds to zero in the Group Currency, with its Expense Currency amount", () => {
    // ¥1 × 0.004 = $0.004 → $0.00.
    const group = usdGroup([
      {
        amount: 101,
        currency: "JPY",
        lockedRate: "0.004",
        payerId: "a",
        shares: [
          { memberId: "a", amount: 100 },
          { memberId: "b", amount: 1 },
        ],
      },
    ]);
    expect(memberStatement(group, "b").lines).toMatchObject([
      { kind: "expense", paid: 0, share: 0, expenseShare: 1, net: 0 },
    ]);
  });

  it("leaves out Expenses the Member neither paid for nor shared", () => {
    expect(memberStatement(yen, "c").lines).toEqual([]);
    expect(memberStatement(yen, "c").balance).toBe(0);
  });
});

describe("Member Statement: Leftover Cents", () => {
  const leftover = (group: GroupSnapshot, memberId: string) =>
    memberStatement(group, memberId).lines.map((line) => line.kind === "expense" && line.leftoverCent);

  it("marks the Share that received the Leftover Cent of an Equal Split", () => {
    // $10.00 three ways: $3.34, $3.33, $3.33.
    const group = usdGroup([
      {
        amount: 1000,
        splitType: "equal",
        shares: [
          { memberId: "a", amount: 334 },
          { memberId: "b", amount: 333 },
          { memberId: "c", amount: 333 },
        ],
      },
    ]);
    expect(leftover(group, "a")).toEqual([true]);
    expect(leftover(group, "b")).toEqual([false]);
  });

  it("marks Leftover Cents of Percentage and Shares Splits by their weights", () => {
    const group = usdGroup([
      // 50% / 25% / 25% of $0.99: $0.495, $0.2475, $0.2475 → $0.50, $0.25, $0.24.
      {
        amount: 99,
        splitType: "percentage",
        shares: [
          { memberId: "a", amount: 50, percentage: "50" },
          { memberId: "b", amount: 25, percentage: "25" },
          { memberId: "c", amount: 24, percentage: "25" },
        ],
      },
      // 2:1 of $1.00: $0.666…, $0.333… → $0.67, $0.33.
      {
        amount: 100,
        splitType: "shares",
        shares: [
          { memberId: "b", amount: 67, ratio: "2" },
          { memberId: "c", amount: 33, ratio: "1" },
        ],
      },
    ]);
    expect(leftover(group, "a")).toEqual([true, false]);
    expect(leftover(group, "b")).toEqual([true, true]);
    expect(leftover(group, "c")).toEqual([false, false]);
  });

  it("never marks an Exact Split, whose Shares were typed", () => {
    const group = usdGroup([
      { amount: 1000, shares: [{ memberId: "a", amount: 334 }, { memberId: "b", amount: 666 }] },
    ]);
    expect(leftover(group, "a")).toEqual([false]);
  });

  it("marks Leftover yen in a JPY Equal Split", () => {
    // Trip to Japan's ¥4,850 four ways: ¥1,213, ¥1,213, ¥1,212, ¥1,212.
    const japan = groups.find((g) => g.id === "grp_japan_2024")!;
    const line = (memberId: string) =>
      memberStatement(japan, memberId).lines.find((l) => l.id === "exp_006");
    expect(line("mem_alex")).toMatchObject({ leftoverCent: true, expenseShare: 1213 });
    expect(line("mem_sam")).toMatchObject({ leftoverCent: false, expenseShare: 1212 });
  });
});

describe("Member Statement: Settlements", () => {
  // A paid $30.00, split equally with B and C; B then pays A back $10.00.
  const group = usdGroup(
    [
      {
        amount: 3000,
        splitType: "equal",
        payerId: "a",
        shares: ["a", "b", "c"].map((memberId) => ({ memberId, amount: 1000 })),
      },
    ],
    [{ fromId: "b", toId: "a", amount: 1000 }],
  );

  it("lists a Settlement the Member made, raising their Balance", () => {
    const statement = memberStatement(group, "b");
    expect(statement.lines).toMatchObject([
      { kind: "expense", net: -1000 },
      { kind: "settlement", direction: "made", counterpartId: "a", net: 1000 },
    ]);
    expect(statement.balance).toBe(0);
  });

  it("lists a Settlement the Member received, lowering their Balance", () => {
    const statement = memberStatement(group, "a");
    expect(statement.lines).toMatchObject([
      { kind: "expense", paid: 3000, share: 1000, net: 2000 },
      { kind: "settlement", direction: "received", counterpartId: "b", net: -1000 },
    ]);
    expect(statement.balance).toBe(1000);
  });

  it("totals what the Member paid, their Shares, and the Settlements they made and received", () => {
    expect(memberStatement(group, "a").totals).toEqual({
      paid: 3000,
      shares: 1000,
      settlementsMade: 0,
      settlementsReceived: 1000,
    });
    expect(memberStatement(group, "b").totals).toEqual({
      paid: 0,
      shares: 1000,
      settlementsMade: 1000,
      settlementsReceived: 0,
    });
  });

  it("leaves out Settlements between other Members", () => {
    expect(memberStatement(group, "c").lines.map((l) => l.kind)).toEqual(["expense"]);
  });

  it("lists lines oldest first, by date then creation time", () => {
    const later = usdGroup(
      [
        { amount: 100, date: "2024-03-05", shares: [{ memberId: "b", amount: 100 }] },
        { amount: 200, date: "2024-03-01", shares: [{ memberId: "b", amount: 200 }] },
      ],
      [{ fromId: "b", toId: "a", amount: 50, date: "2024-03-03" }],
    );
    expect(memberStatement(later, "b").lines.map((l) => l.id)).toEqual(["exp_1", "stl_0", "exp_0"]);
  });
});

describe("Member Statement: Former Members", () => {
  it("itemises a Former Member's reopened Balance", () => {
    // C was removed at zero, then a past Expense was edited to give C a Share.
    const group: GroupSnapshot = {
      ...usdGroup([{ amount: 900, payerId: "a", shares: [{ memberId: "c", amount: 900 }] }]),
      members: members.map((m) => (m.id === "c" ? { ...m, former: true } : m)),
    };
    const statement = memberStatement(group, "c");
    expect(statement.lines).toMatchObject([{ kind: "expense", paid: 0, share: 900, net: -900 }]);
    expect(statement.balance).toBe(computeLedger(group).balances.find((b) => b.memberId === "c")!.amount);
  });
});
