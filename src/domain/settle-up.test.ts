import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import {
  computeLedger,
  importSampleGroups,
  parseNewSettlement,
  validateSettlement,
  type GroupSnapshot,
} from "./index";

const groups = importSampleGroups(sampleData);
const sample = (id: string) => {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`No sample Group ${id}`);
  return found;
};

describe("Compute Ledger: Suggested Settlements", () => {
  it("ends the Birthday Group at Chloe pays Ben $14.37", () => {
    expect(computeLedger(sample("grp_birthday")).suggestions).toEqual([
      { fromId: "mem_chloe", toId: "mem_ben", amount: 1437, sharedAnExpense: true },
    ]);
  });
});

/** The Group after every Suggested Settlement is recorded. */
function afterRecording(group: GroupSnapshot, payments: { fromId: string; toId: string; amount: number }[]) {
  return {
    ...group,
    settlements: [
      ...group.settlements,
      ...payments.map((p, i) => ({ ...p, id: `stl_new_${i}`, date: "2026-11-18", createdAt: `2026-11-18T00:00:0${i}Z` })),
    ],
  };
}

/**
 * A USD Group whose Members end at the given Balances (which sum to zero):
 * each Member after the first settles their Balance against the first.
 */
function groupWithBalances(amounts: number[]): GroupSnapshot {
  const members = amounts.map((_, i) => ({ id: `m${i}`, name: `M${i}`, avatarColor: "#000000" }));
  return {
    id: "grp_test",
    name: "Test",
    description: "",
    currency: "USD",
    members,
    settlements: [],
    expenses: amounts.slice(1).map((amount, i) => ({
      id: `e${i}`,
      description: "Dinner",
      amount: Math.abs(amount),
      currency: "USD" as const,
      lockedRate: "1",
      payerId: amount > 0 ? `m${i + 1}` : "m0",
      splitType: "exact" as const,
      shares: [{ memberId: amount > 0 ? "m0" : `m${i + 1}`, amount: Math.abs(amount) }],
      date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00Z",
      category: "Other",
    })),
  };
}

describe("Debt Simplification", () => {
  it.each(groups.map((g) => [g.name, g] as const))(
    "%s settles up in at most n−1 payments",
    (_name, g) => {
      const { suggestions, smallChange } = computeLedger(g);
      const payments = [...suggestions, ...smallChange];
      expect(payments.length).toBeLessThanOrEqual(g.members.length - 1);
      expect(computeLedger(afterRecording(g, payments)).settledUp).toBe(true);
    },
  );

  it("pays the largest creditor from the largest debtor first, leaving Small Change out", () => {
    // Camping: jake +177.79, lily +79.29, omar −86.96, rachel −78.97, dev −91.15
    const ledger = computeLedger(sample("grp_camping"));
    expect(ledger.suggestions).toEqual([
      { fromId: "mem_dev", toId: "mem_jake", amount: 9115, sharedAnExpense: true },
      { fromId: "mem_omar", toId: "mem_jake", amount: 8664, sharedAnExpense: true },
      { fromId: "mem_rachel", toId: "mem_lily", amount: 7897, sharedAnExpense: true },
    ]);
    expect(ledger.smallChange).toEqual([
      { fromId: "mem_omar", toId: "mem_lily", amount: 32, sharedAnExpense: true },
    ]);
  });

  it("flags a payment between Members who never shared an Expense", () => {
    // M1 paid for M0, and M0 paid for M2: M2 ends up paying M1 directly.
    expect(computeLedger(groupWithBalances([0, 1000, -1000])).suggestions).toEqual([
      { fromId: "m2", toId: "m1", amount: 1000, sharedAnExpense: false },
    ]);
  });

  it("settles 20 Members in at most 19 payments, quickly", () => {
    const amounts = Array.from({ length: 19 }, (_, i) => (i % 2 === 0 ? 1 : -1) * (1000 + i * 137));
    amounts.push(-amounts.reduce((s, a) => s + a, 0));
    const group = groupWithBalances(amounts);
    expect(computeLedger(group).balances.map((b) => b.amount)).toEqual(amounts);

    const start = performance.now();
    const { suggestions, smallChange } = computeLedger(group);
    // Well inside the 500ms budget for recomputing Balances.
    expect(performance.now() - start).toBeLessThan(500);
    const payments = [...suggestions, ...smallChange];
    expect(payments.length).toBeLessThanOrEqual(19);
    expect(computeLedger(afterRecording(group, payments)).settledUp).toBe(true);
  });
});

describe("Validate Settlement", () => {
  // Birthday: ben +14.37, chloe −14.37, olivia 0, marcus 0
  const birthday = sample("grp_birthday");
  const validate = (fromId: string, toId: string, amount: number) =>
    validateSettlement(birthday, { fromId, toId, amount });

  it("accepts paying off the whole debt, or part of it", () => {
    expect(validate("mem_chloe", "mem_ben", 1437)).toEqual({ ok: true });
    expect(validate("mem_chloe", "mem_ben", 1)).toEqual({ ok: true });
  });

  it("rejects paying more than can be settled, with the maximum", () => {
    expect(validate("mem_chloe", "mem_ben", 1438)).toEqual({
      ok: false,
      field: "amount",
      error: "Chloe Yun can pay at most $14.37.",
      maxAmount: 1437,
    });
  });

  it("caps the amount at the smaller of the two Balances", () => {
    // Japan: alex +216.46, jordan −219.49
    const japan = sample("grp_japan_2024");
    expect(validateSettlement(japan, { fromId: "mem_jordan", toId: "mem_alex", amount: 21647 })).toMatchObject({
      ok: false,
      error: "Jordan Park can pay at most $216.46.",
      maxAmount: 21646,
    });
  });

  it("rejects a payer who doesn't owe anything", () => {
    expect(validate("mem_olivia", "mem_ben", 100)).toEqual({
      ok: false,
      field: "fromId",
      error: "Olivia Hayes doesn't owe anything.",
    });
    expect(validate("mem_ben", "mem_chloe", 100)).toMatchObject({ field: "fromId", error: "Ben Gutierrez doesn't owe anything." });
  });

  it("rejects a recipient who isn't owed anything", () => {
    expect(validate("mem_chloe", "mem_marcus", 100)).toEqual({
      ok: false,
      field: "toId",
      error: "Marcus Webb isn't owed anything.",
    });
  });

  it("rejects paying yourself, a zero amount, and Members not in the Group", () => {
    expect(validate("mem_chloe", "mem_chloe", 100)).toMatchObject({ field: "toId", error: "Choose someone other than Chloe Yun." });
    expect(validate("mem_chloe", "mem_ben", 0)).toMatchObject({ field: "amount", error: "Enter an amount greater than zero." });
    expect(validate("mem_nobody", "mem_ben", 100)).toMatchObject({ field: "fromId", error: "Choose who paid." });
    expect(validate("mem_chloe", "mem_nobody", 100)).toMatchObject({ field: "toId", error: "Choose who was paid." });
  });
});

describe("parseNewSettlement", () => {
  const birthday = sample("grp_birthday");
  const fields = { fromId: "mem_chloe", toId: "mem_ben", amount: "10.00", date: "2026-11-18" };

  it("reads a partial Settlement typed into the form", () => {
    expect(parseNewSettlement(fields, birthday)).toEqual({
      ok: true,
      value: { fromId: "mem_chloe", toId: "mem_ben", amount: 1000, date: "2026-11-18" },
    });
  });

  it("reports each problem against its field", () => {
    expect(parseNewSettlement({ ...fields, amount: "14.38", date: "2026-02-30" }, birthday)).toEqual({
      ok: false,
      errors: { amount: "Chloe Yun can pay at most $14.37.", date: "Enter a real date, like 2026-01-31." },
    });
    expect(parseNewSettlement({ ...fields, amount: "abc" }, birthday)).toEqual({
      ok: false,
      errors: { amount: "Enter the amount as a number, like 12.50." },
    });
    expect(parseNewSettlement({ ...fields, toId: "mem_marcus" }, birthday)).toEqual({
      ok: false,
      errors: { toId: "Marcus Webb isn't owed anything." },
    });
  });
});
