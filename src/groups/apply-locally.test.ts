import { describe, expect, it } from "vitest";
import { computeLedger, type GroupSnapshot } from "@/domain";
import { deleteExpense, saveExpense } from "@/expenses/save-expense";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/lib/memory-storage";
import { clearSmallChange, deleteSettlement, recordSettlement } from "@/settlements/settle-up";
import { applyLocally } from "./apply-locally";

/** A Group with "You" and Chloe, where Chloe owes You `owed` cents. */
async function flatWithDebt(owed = 1000) {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const created = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  const you = created.members[0];
  const chloe = (await repo.addMember(created.id, { name: "Chloe" }))!;
  await repo.addExpense(created.id, {
    description: "Pizza",
    amount: owed,
    currency: "USD",
    lockedRate: "1",
    payerId: you.id,
    splitType: "exact",
    shares: [{ memberId: chloe.id, amount: owed }],
    date: "2026-03-01",
    category: "Food & Drink",
  });
  const group = (await repo.getGroup(created.id))!;
  return { group, you, chloe };
}

const balances = (group: GroupSnapshot) => computeLedger(group).balances.map((b) => b.amount);
const noRates = async () => null;

describe("applyLocally", () => {
  it("returns the Group a new Expense leaves, without changing the one passed in", async () => {
    const { group, you, chloe } = await flatWithDebt();
    const before = structuredClone(group);

    const { result, group: after } = await applyLocally(group, (repo, groupId) =>
      saveExpense(
        repo,
        groupId,
        null,
        {
          amount: "30",
          currency: "USD",
          rate: "",
          description: "Groceries",
          date: "2026-03-02",
          category: "Groceries",
          payerId: chloe.id,
          participantIds: [you.id, chloe.id],
          notes: "",
          splitType: "equal",
          splitValues: {},
        },
        noRates,
      ),
    );

    expect(result).toEqual({ ok: true });
    expect(after.expenses.map((e) => e.description)).toEqual(["Pizza", "Groceries"]);
    // Chloe owed $10.00 and paid $15.00 of You's Share: You now owe her $5.00.
    expect(balances(after)).toEqual([-500, 500]);
    expect(group).toEqual(before);
  });

  it("returns the write's errors and the Group unchanged when the write is refused", async () => {
    const { group, you, chloe } = await flatWithDebt();

    const { result, group: after } = await applyLocally(group, (repo, groupId) =>
      recordSettlement(repo, groupId, { fromId: chloe.id, toId: you.id, amount: "12.00", date: "2026-03-02" }),
    );

    expect(result.ok).toBe(false);
    expect(after).toEqual(group);
  });

  it("reflects an edited Expense, keeping its id", async () => {
    const { group, you, chloe } = await flatWithDebt();
    const pizza = group.expenses[0];

    const { result, group: after } = await applyLocally(group, (repo, groupId) =>
      saveExpense(
        repo,
        groupId,
        pizza.id,
        {
          amount: "16",
          currency: "USD",
          rate: "",
          description: "Pizza",
          date: pizza.date,
          category: pizza.category,
          payerId: you.id,
          participantIds: [chloe.id],
          notes: "",
          splitType: "equal",
          splitValues: {},
        },
        noRates,
      ),
    );

    expect(result).toEqual({ ok: true });
    expect(after.expenses.map((e) => e.id)).toEqual([pizza.id]);
    expect(balances(after)).toEqual([1600, -1600]);
  });

  it("reflects a deleted Expense", async () => {
    const { group } = await flatWithDebt();

    const { group: after } = await applyLocally(group, (repo, groupId) =>
      deleteExpense(repo, groupId, group.expenses[0].id),
    );

    expect(balances(after)).toEqual([0, 0]);
  });

  it("reflects a recorded Settlement, then its deletion", async () => {
    const { group, you, chloe } = await flatWithDebt();

    const recorded = await applyLocally(group, (repo, groupId) =>
      recordSettlement(repo, groupId, { fromId: chloe.id, toId: you.id, amount: "4.00", date: "2026-03-02" }),
    );
    expect(balances(recorded.group)).toEqual([600, -600]);

    const deleted = await applyLocally(recorded.group, (repo, groupId) =>
      deleteSettlement(repo, groupId, recorded.group.settlements[0].id),
    );
    expect(balances(deleted.group)).toEqual([1000, -1000]);
  });

  it("reflects cleared Small Change", async () => {
    const { group } = await flatWithDebt(40);

    const { result, group: after } = await applyLocally(group, (repo, groupId) =>
      clearSmallChange(repo, groupId, "2026-03-02"),
    );

    expect(result).toEqual({ ok: true });
    expect(balances(after)).toEqual([0, 0]);
  });
});
