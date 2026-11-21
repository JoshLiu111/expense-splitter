import { describe, expect, it } from "vitest";
import type { GroupSnapshot, NewExpenseFields, RateSnapshot } from "@/domain";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/lib/memory-storage";
import { deleteExpense, saveExpense } from "./save-expense";

const GUEST = { userId: undefined };

const noRates = async () => null;

const paidBy = (payerId: string, participantIds: string[]): NewExpenseFields => ({
  amount: "20",
  currency: "USD",
  rate: "",
  description: "Taxi",
  date: "2026-03-01",
  category: "Transport",
  payerId,
  participantIds,
  notes: "",
  splitType: "equal",
  splitValues: {},
});

it("keeps Former Members off new Expenses but lets their past Expenses be edited", async () => {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  const you = group.members[0].id;
  const dev = (await repo.addMember(group.id, { name: "Dev" }))!.id;
  expect(await saveExpense(repo, group.id, null, paidBy(dev, [dev]), noRates, GUEST)).toEqual({ ok: true });
  const [past] = (await repo.getGroup(group.id))!.expenses;
  await repo.removeMember(group.id, dev);

  expect(await saveExpense(repo, group.id, null, paidBy(dev, [you, dev]), noRates, GUEST)).toMatchObject({
    ok: false,
    errors: { payerId: "Choose who paid." },
  });
  expect(await saveExpense(repo, group.id, past.id, { ...paidBy(dev, [dev]), amount: "25" }, noRates, GUEST)).toEqual({
    ok: true,
  });
  expect((await repo.getGroup(group.id))!.expenses[0].amount).toBe(2500);
});

it("records a foreign-currency Expense at Today's Rate and keeps it on later edits", async () => {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Tokyo", description: "", currency: "USD" });
  const you = group.members[0].id;
  let today: RateSnapshot = { perUsd: { USD: 1, JPY: 149.25 }, fetchedOn: "2026-04-01", stale: false };
  const rates = async () => today;
  const ryokan = { ...paidBy(you, [you]), amount: "84000", currency: "JPY", description: "Ryokan" };

  expect(await saveExpense(repo, group.id, null, ryokan, rates, GUEST)).toEqual({ ok: true });
  const [recorded] = (await repo.getGroup(group.id))!.expenses;
  expect(recorded).toMatchObject({ currency: "JPY", amount: 84000, lockedRate: "0.00670017" });

  today = { perUsd: { USD: 1, JPY: 160 }, fetchedOn: "2026-05-01", stale: false };
  await saveExpense(repo, group.id, recorded.id, { ...ryokan, description: "Ryokan, 2 nights" }, rates, GUEST);
  expect((await repo.getGroup(group.id))!.expenses[0].lockedRate).toBe("0.00670017");
});

describe("in Own Records Only", () => {
  /** Alex created the Group; Sam recorded its one Expense; Jo is another Member. */
  async function ownRecordsOnly() {
    const members = [
      { id: "mem_alex", name: "Alex", userId: "user_alex", avatarColor: "#3B82F6" },
      { id: "mem_sam", name: "Sam", userId: "user_sam", avatarColor: "#10B981" },
      { id: "mem_jo", name: "Jo", userId: "user_jo", avatarColor: "#F59E0B" },
    ];
    const group: GroupSnapshot = {
      id: "grp_flat",
      name: "Flat",
      description: "",
      currency: "USD",
      creatorUserId: "user_alex",
      editingMode: "own-records-only",
      members,
      expenses: [],
      settlements: [],
    };
    const storage = memoryStorage();
    const asSam = createSessionStorageRepository(storage, () => [group], { recorderId: "mem_sam" });
    await saveExpense(asSam, group.id, null, paidBy("mem_sam", ["mem_sam", "mem_jo"]), noRates, sam);
    const repo = createSessionStorageRepository(storage, () => [group]);
    const [expense] = (await repo.getGroup(group.id))!.expenses;
    return { repo, group, expense };
  }
  const sam = { userId: "user_sam" };
  const jo = { userId: "user_jo" };
  const alex = { userId: "user_alex" };

  it("refuses another Member's edit or delete, leaving the Group unchanged", async () => {
    const { repo, group, expense } = await ownRecordsOnly();
    const before = await repo.getGroup(group.id);
    const reason =
      "This Group is set to Own Records Only: only Sam, who recorded this Expense, or the Group Creator, Alex, can";

    expect(
      await saveExpense(repo, group.id, expense.id, { ...paidBy("mem_sam", ["mem_jo"]), amount: "99" }, noRates, jo),
    ).toEqual({ ok: false, errors: { form: `${reason} edit it.` } });
    expect(await deleteExpense(repo, group.id, expense.id, jo)).toEqual({
      ok: false,
      errors: { form: `${reason} delete it.` },
    });
    expect(await repo.getGroup(group.id)).toEqual(before);
  });

  it("lets the Recorder and the Group Creator edit and delete, and anyone add", async () => {
    const { repo, group, expense } = await ownRecordsOnly();
    const edit = (amount: string, visitor: { userId: string }) =>
      saveExpense(repo, group.id, expense.id, { ...paidBy("mem_sam", ["mem_sam"]), amount }, noRates, visitor);

    expect(await edit("30", sam)).toEqual({ ok: true });
    expect(await edit("40", alex)).toEqual({ ok: true });
    expect(await saveExpense(repo, group.id, null, paidBy("mem_jo", ["mem_jo"]), noRates, jo)).toEqual({ ok: true });
    expect(await deleteExpense(repo, group.id, expense.id, alex)).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))!.expenses.map((e) => e.payerId)).toEqual(["mem_jo"]);
  });
});
