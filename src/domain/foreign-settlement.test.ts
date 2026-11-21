import { describe, expect, it } from "vitest";
import { computeLedger, explainSettlements, memberStatement, myCalendar, type GroupSnapshot } from "./index";

/**
 * A USD Group where Bo owes Ana $30.00 and repays it in yen: ¥4,470 at a
 * Locked Rate of 0.0067 is $29.95, leaving 5¢.
 */
const group: GroupSnapshot = {
  id: "grp_trip",
  name: "Trip",
  description: "",
  currency: "USD",
  members: [
    { id: "ana", name: "Ana", avatarColor: "#000000" },
    { id: "bo", name: "Bo", avatarColor: "#000000" },
  ],
  expenses: [
    {
      id: "exp_hotel",
      description: "Hotel",
      amount: 3000,
      currency: "USD",
      lockedRate: "1",
      payerId: "ana",
      splitType: "exact",
      shares: [{ memberId: "bo", amount: 3000 }],
      date: "2026-03-01",
      createdAt: "2026-03-01T10:00:00.000Z",
      category: "Accommodation",
    },
  ],
  settlements: [
    {
      id: "stl_yen",
      fromId: "bo",
      toId: "ana",
      amount: 4470,
      currency: "JPY",
      lockedRate: "0.0067",
      date: "2026-03-02",
      createdAt: "2026-03-02T10:00:00.000Z",
    },
  ],
};

describe("A Settlement in another Settlement Currency", () => {
  it("moves its converted amount in Compute Ledger, so Balances still sum to zero", () => {
    const ledger = computeLedger(group);
    expect(ledger.balances).toEqual([
      { memberId: "ana", amount: 5 },
      { memberId: "bo", amount: -5 },
    ]);
    expect(ledger.timeline[0]).toMatchObject({ kind: "settlement", id: "stl_yen", groupAmount: 2995 });
  });

  it("leaves the sub-unit Balance from conversion as Small Change", () => {
    const ledger = computeLedger(group);
    expect(ledger.suggestions).toEqual([]);
    expect(ledger.smallChange).toEqual([{ fromId: "bo", toId: "ana", amount: 5, sharedAnExpense: true }]);
  });

  it("shows its converted amount on both Members' Statements, totalling their Balances", () => {
    const bo = memberStatement(group, "bo");
    expect(bo.lines[1]).toMatchObject({ kind: "settlement", direction: "made", groupAmount: 2995, net: 2995 });
    expect(bo.totals.settlementsMade).toBe(2995);
    expect(bo.balance).toBe(-5);
    const ana = memberStatement(group, "ana");
    expect(ana.totals.settlementsReceived).toBe(2995);
    expect(ana.balance).toBe(5);
  });

  it("counts its converted amount on My Calendar", () => {
    expect(myCalendar(group, "bo", "2026-03").totals).toEqual({ paid: 0, settlementsMade: 2995, settlementsReceived: 0 });
    expect(myCalendar(group, "ana", "2026-03").totals).toEqual({
      paid: 3000,
      settlementsMade: 0,
      settlementsReceived: 2995,
    });
  });

  it("nets its converted amount in Explain Settlements", () => {
    const explanation = explainSettlements(group);
    expect(explanation.before).toEqual([{ fromId: "bo", toId: "ana", amount: 5 }]);
    expect(explanation.smallChange[0].sources).toEqual([{ kind: "expense", id: "exp_hotel", amount: 5, full: 3000 }]);
  });
});
