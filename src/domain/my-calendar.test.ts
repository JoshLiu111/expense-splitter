import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import {
  importSampleGroups,
  memberStatement,
  myCalendar,
  myCalendarOpeningMonth,
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
      date: "2024-03-02",
      createdAt: `2024-03-02T00:00:0${i}.000Z`,
      ...s,
    })),
  };
}

const none = { paid: 0, settlementsMade: 0, settlementsReceived: 0 };

describe("My Calendar: agrees with the Member Statement", () => {
  it.each(groups.flatMap((g) => g.members.map((m) => [g.name, m.name, g, m.id] as const)))(
    "%s: %s's months add up to their Member Statement's totals",
    (_group, _member, g, memberId) => {
      const statement = memberStatement(g, memberId);
      const months = new Set(statement.lines.map((line) => line.date.slice(0, 7)));
      const sum = { ...none };
      for (const month of months) {
        const { totals } = myCalendar(g, memberId, month);
        sum.paid += totals.paid;
        sum.settlementsMade += totals.settlementsMade;
        sum.settlementsReceived += totals.settlementsReceived;
      }
      expect(sum).toEqual({
        paid: statement.totals.paid,
        settlementsMade: statement.totals.settlementsMade,
        settlementsReceived: statement.totals.settlementsReceived,
      });
    },
  );
});

describe("My Calendar: Expenses paid", () => {
  const split = (amount: number) => [
    { memberId: "a", amount: amount / 2 },
    { memberId: "b", amount: amount / 2 },
  ];

  it("counts the full amount of each Expense the Member paid for, not their Share", () => {
    const group = usdGroup([
      { amount: 3000, shares: split(3000), date: "2024-03-05" },
      { amount: 1000, shares: split(1000), date: "2024-03-05" },
    ]);
    expect(myCalendar(group, "a", "2024-03")).toEqual({
      month: "2024-03",
      days: [{ date: "2024-03-05", totals: { ...none, paid: 4000 }, counts: { ...none, paid: 2 } }],
      totals: { ...none, paid: 4000 },
    });
  });

  it("leaves out Expenses where the Member only has a Share", () => {
    const group = usdGroup([{ amount: 3000, shares: split(3000), date: "2024-03-05" }]);
    expect(myCalendar(group, "b", "2024-03")).toEqual({ month: "2024-03", days: [], totals: none });
  });

  it("converts another Expense Currency to the Group Currency at the Locked Rate, as the Member Statement does", () => {
    // ¥1,213 × 0.0067 = $8.13 and ¥1,212 × 0.0067 = $8.12, rounded per Share: $16.25.
    const group = usdGroup([
      {
        amount: 2425,
        currency: "JPY",
        lockedRate: "0.0067",
        shares: [
          { memberId: "a", amount: 1213 },
          { memberId: "b", amount: 1212 },
        ],
        date: "2024-03-05",
      },
      { amount: 1000, currency: "EUR", lockedRate: "1.1", shares: split(1000), date: "2024-03-06" },
    ]);
    const calendar = myCalendar(group, "a", "2024-03");
    expect(calendar.days.map((d) => [d.date, d.totals.paid])).toEqual([
      ["2024-03-05", 1625],
      ["2024-03-06", 1100],
    ]);
    expect(calendar.totals.paid).toBe(memberStatement(group, "a").totals.paid);
  });
});

describe("My Calendar: Settlements", () => {
  it("tells Settlements the Member received from those they made", () => {
    const group = usdGroup(
      [],
      [
        { fromId: "b", toId: "a", amount: 500, date: "2024-03-02" },
        { fromId: "a", toId: "c", amount: 200, date: "2024-03-02" },
        { fromId: "c", toId: "a", amount: 300, date: "2024-03-09" },
        { fromId: "b", toId: "c", amount: 999, date: "2024-03-09" },
      ],
    );
    const calendar = myCalendar(group, "a", "2024-03");
    expect(calendar.days).toEqual([
      {
        date: "2024-03-02",
        totals: { paid: 0, settlementsMade: 200, settlementsReceived: 500 },
        counts: { paid: 0, settlementsMade: 1, settlementsReceived: 1 },
      },
      {
        date: "2024-03-09",
        totals: { ...none, settlementsReceived: 300 },
        counts: { ...none, settlementsReceived: 1 },
      },
    ]);
    expect(calendar.totals).toEqual({ paid: 0, settlementsMade: 200, settlementsReceived: 800 });
  });
});

describe("My Calendar: months", () => {
  const group = usdGroup(
    [
      { amount: 100, shares: [{ memberId: "a", amount: 100 }], date: "2024-02-29" },
      { amount: 200, shares: [{ memberId: "a", amount: 200 }], date: "2024-03-01" },
      { amount: 400, shares: [{ memberId: "a", amount: 400 }], date: "2024-03-31" },
      { amount: 800, shares: [{ memberId: "a", amount: 800 }], date: "2024-04-01" },
    ],
    [{ fromId: "a", toId: "b", amount: 50, date: "2024-05-15" }],
  );

  it("takes only the days of the month asked for, first and last day included", () => {
    expect(myCalendar(group, "a", "2024-02").totals.paid).toBe(100);
    expect(myCalendar(group, "a", "2024-03").days.map((d) => d.date)).toEqual(["2024-03-01", "2024-03-31"]);
    expect(myCalendar(group, "a", "2024-03").totals.paid).toBe(600);
    expect(myCalendar(group, "a", "2024-04").totals.paid).toBe(800);
  });

  it("returns no days and zero totals for a month with nothing for the Member", () => {
    expect(myCalendar(group, "a", "2024-06")).toEqual({ month: "2024-06", days: [], totals: none });
    expect(myCalendar(group, "c", "2024-03")).toEqual({ month: "2024-03", days: [], totals: none });
  });

  it("opens on the current month when it has something for the Member", () => {
    expect(myCalendarOpeningMonth(group, "a", "2024-03-20")).toBe("2024-03");
  });

  it("otherwise opens on the Member's most recent earlier month with something", () => {
    expect(myCalendarOpeningMonth(group, "a", "2024-08-01")).toBe("2024-05");
    expect(myCalendarOpeningMonth(group, "a", "2024-03-01")).toBe("2024-03");
  });

  it("with only later months, opens on the nearest one", () => {
    // B is only paid, in May.
    expect(myCalendarOpeningMonth(group, "b", "2024-01-10")).toBe("2024-05");
  });

  it("counts a zero-amount Expense the Member paid for as something", () => {
    // ¥1 × 0.004 = $0.004 → $0.00.
    const tiny = usdGroup([
      { amount: 1, currency: "JPY", lockedRate: "0.004", shares: [{ memberId: "b", amount: 1 }], date: "2024-01-05" },
    ]);
    expect(myCalendar(tiny, "a", "2024-01").days).toEqual([
      { date: "2024-01-05", totals: none, counts: { ...none, paid: 1 } },
    ]);
    expect(myCalendarOpeningMonth(tiny, "a", "2024-03-01")).toBe("2024-01");
  });

  it("opens on the current month when the Member has nothing at all", () => {
    expect(myCalendarOpeningMonth(group, "c", "2024-08-01")).toBe("2024-08");
  });
});

describe("My Calendar: Former Members", () => {
  it("shows a Former Member's own Expenses and Settlements", () => {
    const group = usdGroup(
      [{ amount: 600, payerId: "c", shares: [{ memberId: "a", amount: 600 }], date: "2024-03-03" }],
      [{ fromId: "a", toId: "c", amount: 600, date: "2024-03-04" }],
    );
    group.members = members.map((m) => (m.id === "c" ? { ...m, former: true } : m));
    expect(myCalendar(group, "c", "2024-03").totals).toEqual({ paid: 600, settlementsMade: 0, settlementsReceived: 600 });
  });
});
