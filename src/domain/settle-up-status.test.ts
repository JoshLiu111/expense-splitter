import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { computeLedger, importSampleGroups, settleUpStatus, type GroupSnapshot } from "./index";

const groups = importSampleGroups(sampleData);
const sample = (id: string) => {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`No sample Group ${id}`);
  return found;
};
const statusOf = (group: GroupSnapshot) => settleUpStatus(computeLedger(group));

/** The Group with one more Settlement recorded. */
function withSettlement(group: GroupSnapshot, fromId: string, toId: string, amount: number): GroupSnapshot {
  const settlement = { id: `stl_${group.settlements.length}`, fromId, toId, amount, currency: group.currency, lockedRate: "1", date: "2026-11-18", createdAt: "2026-11-18T00:00:00Z" };
  return { ...group, settlements: [...group.settlements, settlement] };
}

describe("Settle up status", () => {
  it("counts Trip to Japan's three Suggested Settlements and their total", () => {
    // Sam → Taylor $315.09, Jordan → Alex $216.46, Jordan → Taylor $3.03.
    expect(statusOf(sample("grp_japan_2024"))).toEqual({ state: "open", payments: 3, total: 53458 });
  });

  it("is Settled Up once the Birthday Group's last payment, Chloe pays Ben $14.37, is recorded", () => {
    const settled = withSettlement(sample("grp_birthday"), "mem_chloe", "mem_ben", 1437);
    expect(statusOf(settled)).toEqual({ state: "settled" });
  });

  it("leaves Camping with $0.32 of Small Change once its three Suggested Settlements are recorded", () => {
    let camping = sample("grp_camping");
    camping = withSettlement(camping, "mem_dev", "mem_jake", 9115);
    camping = withSettlement(camping, "mem_omar", "mem_jake", 8664);
    camping = withSettlement(camping, "mem_rachel", "mem_lily", 7897);
    expect(statusOf(camping)).toEqual({ state: "small", total: 32 });
  });

  it("has nothing to settle in a Group with nothing recorded", () => {
    expect(statusOf({ ...sample("grp_birthday"), expenses: [], settlements: [] })).toEqual({ state: "empty" });
  });

  it("still has payments to settle when only Settlements are left after deleting every Expense", () => {
    // Birthday's Settlements, Marcus paid Olivia $50.61 and Chloe paid Olivia $18.75, are left to be paid back.
    const onlySettlements = { ...sample("grp_birthday"), expenses: [] };
    expect(statusOf(onlySettlements)).toEqual({ state: "open", payments: 2, total: 6936 });
  });
});
