import { expect, it } from "vitest";
import type { NewExpenseFields, RateSnapshot } from "@/domain";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/lib/memory-storage";
import { saveExpense } from "./save-expense";

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
  expect(await saveExpense(repo, group.id, null, paidBy(dev, [dev]), noRates)).toEqual({ ok: true });
  const [past] = (await repo.getGroup(group.id))!.expenses;
  await repo.removeMember(group.id, dev);

  expect(await saveExpense(repo, group.id, null, paidBy(dev, [you, dev]), noRates)).toMatchObject({
    ok: false,
    errors: { payerId: "Choose who paid." },
  });
  expect(await saveExpense(repo, group.id, past.id, { ...paidBy(dev, [dev]), amount: "25" }, noRates)).toEqual({
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

  expect(await saveExpense(repo, group.id, null, ryokan, rates)).toEqual({ ok: true });
  const [recorded] = (await repo.getGroup(group.id))!.expenses;
  expect(recorded).toMatchObject({ currency: "JPY", amount: 84000, lockedRate: "0.00670017" });

  today = { perUsd: { USD: 1, JPY: 160 }, fetchedOn: "2026-05-01", stale: false };
  await saveExpense(repo, group.id, recorded.id, { ...ryokan, description: "Ryokan, 2 nights" }, rates);
  expect((await repo.getGroup(group.id))!.expenses[0].lockedRate).toBe("0.00670017");
});
