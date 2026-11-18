import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import {
  computeLedger,
  explainSettlements,
  importSampleGroups,
  type Expense,
  type GroupSnapshot,
  type Settlement,
  type SuggestedSettlement,
} from "./index";

const groups = importSampleGroups(sampleData);
const sample = (id: string) => {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`No sample Group ${id}`);
  return found;
};

const expense = (id: string, payerId: string, shares: [string, number][], date: string): Expense => ({
  id,
  description: id,
  amount: shares.reduce((sum, [, amount]) => sum + amount, 0),
  currency: "USD",
  lockedRate: "1",
  payerId,
  splitType: "exact",
  shares: shares.map(([memberId, amount]) => ({ memberId, amount })),
  date,
  createdAt: `${date}T12:00:00.000Z`,
  category: "Other",
});

const settlement = (fromId: string, toId: string, amount: number): Settlement => ({
  id: `stl_${fromId}_${toId}`,
  fromId,
  toId,
  amount,
  date: "2026-03-05",
  createdAt: "2026-03-05T12:00:00.000Z",
});

/** Ana paid $30 for Ana, Ben and Cai; Ben paid $12 for Ben and Cai. */
const flat = (settlements: Settlement[] = []): GroupSnapshot => ({
  id: "grp_flat",
  name: "Flat",
  description: "",
  currency: "USD",
  members: ["a", "b", "c"].map((id) => ({ id, name: id, avatarColor: "#3B82F6" })),
  expenses: [
    expense("dinner", "a", [["a", 1000], ["b", 1000], ["c", 1000]], "2026-03-01"),
    expense("taxi", "b", [["b", 600], ["c", 600]], "2026-03-02"),
  ],
  settlements,
});

describe("Explain Settlements: before Debt Simplification", () => {
  it("shows what each Member owes each Member they shared Expenses with", () => {
    expect(explainSettlements(flat()).before).toEqual([
      { fromId: "b", toId: "a", amount: 1000 },
      { fromId: "c", toId: "a", amount: 1000 },
      { fromId: "c", toId: "b", amount: 600 },
    ]);
  });

  it("nets out Settlements already recorded", () => {
    expect(explainSettlements(flat([settlement("c", "b", 600), settlement("b", "a", 400)])).before).toEqual([
      { fromId: "b", toId: "a", amount: 600 },
      { fromId: "c", toId: "a", amount: 1000 },
    ]);
  });

  it.each(groups.map((g) => [g.name, g] as const))(
    "%s: each Member's pairwise amounts net to their Balance",
    (_name, group) => {
      const { before } = explainSettlements(group);
      for (const { memberId, amount } of computeLedger(group).balances) {
        const net = before.reduce(
          (sum, edge) => sum + (edge.toId === memberId ? edge.amount : 0) - (edge.fromId === memberId ? edge.amount : 0),
          0,
        );
        expect(net).toBe(amount);
      }
    },
  );
});

describe("Explain Settlements: where each Suggested Settlement comes from", () => {
  it("traces payments to the Expenses behind them, the recipient's own Expenses first", () => {
    // Balances: Ana +20, Ben −4, Cai −16 → Cai pays Ana $16, Ben pays Ana $4.
    expect(explainSettlements(flat()).suggestions).toEqual([
      {
        fromId: "c",
        toId: "a",
        amount: 1600,
        sharedAnExpense: true,
        sources: [
          { kind: "expense", id: "dinner", amount: 1000, full: 1000 },
          { kind: "expense", id: "taxi", amount: 600, full: 600 },
        ],
      },
      {
        // What Ana fronted Ben for dinner, less the taxi Ben paid for.
        fromId: "b",
        toId: "a",
        amount: 400,
        sharedAnExpense: true,
        sources: [{ kind: "expense", id: "dinner", amount: 400, full: 1000 }],
      },
    ]);
  });

  it("traces Sam's payment to Taylor to the Kyoto ryokan first", () => {
    const japan = sample("grp_japan_2024");
    const toTaylor = explainSettlements(japan).suggestions.find(
      (s) => s.fromId === "mem_sam" && s.toId === "mem_taylor",
    )!;
    expect(toTaylor.amount).toBe(31509);
    // Sam's Exact Share of the ryokan: ¥25,000 at 0.0067 = $167.50
    expect(toTaylor.sources[0]).toEqual({ kind: "expense", id: "exp_005", amount: 16750, full: 16750 });
    const description = (id: string) => japan.expenses.find((e) => e.id === id)?.description;
    expect(description(toTaylor.sources[0].id)).toBe("Kyoto ryokan (2 nights)");
  });

  it.each(groups.map((g) => [g.name, g] as const))(
    "%s: the sources of every payment add up to it, never beyond what was owed",
    (_name, group) => {
      const { suggestions, smallChange } = explainSettlements(group);
      const ledger = computeLedger(group);
      const withoutSources = ({ fromId, toId, amount, sharedAnExpense }: SuggestedSettlement) => ({
        fromId,
        toId,
        amount,
        sharedAnExpense,
      });
      expect(suggestions.map(withoutSources)).toEqual(ledger.suggestions);
      expect(smallChange.map(withoutSources)).toEqual(ledger.smallChange);
      for (const payment of [...suggestions, ...smallChange]) {
        expect(payment.sources.reduce((sum, s) => sum + s.amount, 0)).toBe(payment.amount);
        for (const source of payment.sources) {
          expect(source.amount).toBeGreaterThan(0);
          expect(source.amount).toBeLessThanOrEqual(source.full);
        }
      }
    },
  );

  it("traces a debt from a Settlement received back to that Settlement", () => {
    // Ben owed Ana $4, then Ana paid Ben $10 by mistake: Ben pays Ana $14.
    const { suggestions } = explainSettlements(flat([settlement("a", "b", 1000)]));
    expect(suggestions).toContainEqual({
      fromId: "b",
      toId: "a",
      amount: 1400,
      sharedAnExpense: true,
      sources: [
        { kind: "settlement", id: "stl_a_b", amount: 1000, full: 1000 },
        { kind: "expense", id: "dinner", amount: 400, full: 1000 },
      ],
    });
  });
});
