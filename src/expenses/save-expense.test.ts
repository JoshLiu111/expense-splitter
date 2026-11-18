import { expect, it } from "vitest";
import type { NewExpenseFields } from "@/domain";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/test/memory-storage";
import { saveExpense } from "./save-expense";

const paidBy = (payerId: string, participantIds: string[]): NewExpenseFields => ({
  amount: "20",
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
  expect(await saveExpense(repo, group.id, null, paidBy(dev, [dev]))).toEqual({ ok: true });
  const [past] = (await repo.getGroup(group.id))!.expenses;
  await repo.removeMember(group.id, dev);

  expect(await saveExpense(repo, group.id, null, paidBy(dev, [you, dev]))).toMatchObject({
    ok: false,
    errors: { payerId: "Choose who paid." },
  });
  expect(await saveExpense(repo, group.id, past.id, { ...paidBy(dev, [dev]), amount: "25" })).toEqual({
    ok: true,
  });
  expect((await repo.getGroup(group.id))!.expenses[0].amount).toBe(2500);
});
