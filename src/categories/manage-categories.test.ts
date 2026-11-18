import { describe, expect, it } from "vitest";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/test/memory-storage";
import { addCategory, deleteCategory, renameCategory } from "./manage-categories";

async function flat() {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  return { repo, group };
}

describe("Custom Category management", () => {
  it("adds, renames and deletes an unused Custom Category", async () => {
    const { repo, group } = await flat();

    expect(await addCategory(repo, group.id, { name: " Cleaning " })).toEqual({ ok: true });
    const [cleaning] = (await repo.getGroup(group.id))!.customCategories!;
    expect(cleaning.name).toBe("Cleaning");

    expect(await renameCategory(repo, group.id, cleaning.id, { name: "Cleaning supplies" })).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([{ id: cleaning.id, name: "Cleaning supplies" }]);

    expect(await deleteCategory(repo, group.id, cleaning.id)).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([]);
  });

  it("refuses a name another Category already has", async () => {
    const { repo, group } = await flat();
    expect(await addCategory(repo, group.id, { name: "groceries" })).toEqual({
      ok: false,
      errors: { name: "Groceries is already a Category." },
    });
  });

  it("refuses to delete a Custom Category an Expense uses, whatever the caller sends", async () => {
    const { repo, group } = await flat();
    await addCategory(repo, group.id, { name: "Pets" });
    const [pets] = (await repo.getGroup(group.id))!.customCategories!;
    const me = group.members[0].id;
    await repo.addExpense(group.id, {
      description: "Cat food",
      amount: 1200,
      currency: "USD",
      lockedRate: "1",
      payerId: me,
      splitType: "equal",
      shares: [{ memberId: me, amount: 1200 }],
      date: "2026-03-01",
      category: pets.id,
    });

    expect(await deleteCategory(repo, group.id, pets.id)).toEqual({
      ok: false,
      errors: { form: "1 Expense uses Pets. Move it to another Category first." },
    });
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([pets]);
  });

  it("refuses to change a Category that isn't a Custom Category of the Group", async () => {
    const { repo, group } = await flat();
    expect(await renameCategory(repo, group.id, "Groceries", { name: "Food" })).toEqual({
      ok: false,
      errors: { form: "That Category is no longer available." },
    });
    expect(await deleteCategory(repo, "grp_missing", "cat_x")).toEqual({
      ok: false,
      errors: { form: "This Group is no longer available." },
    });
  });
});
