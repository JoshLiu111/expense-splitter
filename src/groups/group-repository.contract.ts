import { expect, it } from "vitest";
import type { GroupSnapshot, NewExpense } from "@/domain";
import type { GroupRepository } from "./group-repository";

/** An Equal Expense paid and shared by the Group's first Member. */
function lunch(group: GroupSnapshot, overrides: Partial<NewExpense> = {}): NewExpense {
  const me = group.members[0].id;
  return {
    description: "Lunch",
    amount: 2450,
    currency: group.currency,
    lockedRate: "1",
    payerId: me,
    splitType: "equal",
    shares: [{ memberId: me, amount: 2450 }],
    date: "2026-03-01",
    category: "Food & Drink",
    ...overrides,
  };
}

/** Behaviour every GroupRepository must share, Guest or Postgres. */
export function groupRepositoryContract(makeRepository: () => Promise<GroupRepository>) {
  it("creates a Group with no Expenses whose only Member is its creator", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({
      name: "Flat 3B",
      description: "Rent and bills",
      currency: "GBP",
    });

    expect(group).toMatchObject({
      name: "Flat 3B",
      description: "Rent and bills",
      currency: "GBP",
      expenses: [],
      settlements: [],
    });
    expect(group.id).toEqual(expect.any(String));
    expect(group.members).toHaveLength(1);
  });

  it("lists and fetches a created Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Lisbon", description: "", currency: "EUR" });

    expect((await repo.listGroups()).map((g) => g.id)).toContain(group.id);
    expect(await repo.getGroup(group.id)).toEqual(group);
  });

  it("returns null for a Group that doesn't exist", async () => {
    const repo = await makeRepository();
    expect(await repo.getGroup("grp_missing")).toBeNull();
  });

  it("records an Expense in a Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    const expense = await repo.addExpense(group.id, lunch(group, { notes: "Tacos" }));

    expect(expense).toEqual({
      ...lunch(group, { notes: "Tacos" }),
      id: expect.any(String),
      createdAt: expect.any(String),
    });
    expect((await repo.getGroup(group.id))?.expenses).toEqual([expense]);
  });

  it("edits an Expense, keeping its id and creation time", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const original = await repo.addExpense(group.id, lunch(group, { notes: "Tacos" }));

    const edited = await repo.updateExpense(
      group.id,
      original!.id,
      lunch(group, { description: "Dinner", amount: 9000, shares: [{ memberId: group.members[0].id, amount: 9000 }], date: "2026-03-02", category: "Other" }),
    );

    expect(edited).toEqual({
      ...lunch(group, { description: "Dinner", amount: 9000, shares: [{ memberId: group.members[0].id, amount: 9000 }], date: "2026-03-02", category: "Other" }),
      id: original!.id,
      createdAt: original!.createdAt,
    });
    expect((await repo.getGroup(group.id))?.expenses).toEqual([edited]);
  });

  it("deletes an Expense", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const kept = await repo.addExpense(group.id, lunch(group));
    const gone = await repo.addExpense(group.id, lunch(group, { description: "Oops" }));

    expect(await repo.deleteExpense(group.id, gone!.id)).toBe(true);
    expect((await repo.getGroup(group.id))?.expenses).toEqual([kept]);
  });

  it("refuses to change Expenses that aren't in the Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const other = await repo.createGroup({ name: "Other", description: "", currency: "USD" });
    const expense = await repo.addExpense(other.id, lunch(other));

    expect(await repo.addExpense("grp_missing", lunch(group))).toBeNull();
    expect(await repo.updateExpense(group.id, expense!.id, lunch(group))).toBeNull();
    expect(await repo.deleteExpense(group.id, expense!.id)).toBe(false);
    expect((await repo.getGroup(other.id))?.expenses).toEqual([expense]);
  });
}
