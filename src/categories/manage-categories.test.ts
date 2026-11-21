import { describe, expect, it } from "vitest";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/lib/memory-storage";
import type { EditingMode, GroupSnapshot, Visitor } from "@/domain";
import type { GroupRepository } from "@/groups/group-repository";
import { addCategory, deleteCategory, renameCategory } from "./manage-categories";

/** The Guest: Group Creator of every session Group, so never restricted. */
const GUEST = { userId: undefined };

async function flat() {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  return { repo, group };
}

describe("Custom Category management", () => {
  it("adds, renames and deletes an unused Custom Category", async () => {
    const { repo, group } = await flat();

    expect(await addCategory(repo, group.id, { name: " Cleaning " }, GUEST)).toEqual({ ok: true });
    const [cleaning] = (await repo.getGroup(group.id))!.customCategories!;
    expect(cleaning.name).toBe("Cleaning");

    expect(await renameCategory(repo, group.id, cleaning.id, { name: "Cleaning supplies" }, GUEST)).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([{ id: cleaning.id, name: "Cleaning supplies" }]);

    expect(await deleteCategory(repo, group.id, cleaning.id, GUEST)).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([]);
  });

  it("refuses a name another Category already has", async () => {
    const { repo, group } = await flat();
    expect(await addCategory(repo, group.id, { name: "groceries" }, GUEST)).toEqual({
      ok: false,
      errors: { name: "Groceries is already a Category." },
    });
  });

  it("refuses to delete a Custom Category an Expense uses, whatever the caller sends", async () => {
    const { repo, group } = await flat();
    await addCategory(repo, group.id, { name: "Pets" }, GUEST);
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

    expect(await deleteCategory(repo, group.id, pets.id, GUEST)).toEqual({
      ok: false,
      errors: { form: "1 Expense uses Pets. Move it to another Category first." },
    });
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([pets]);
  });

  it("refuses to change a Category that isn't a Custom Category of the Group", async () => {
    const { repo, group } = await flat();
    expect(await renameCategory(repo, group.id, "Groceries", { name: "Food" }, GUEST)).toEqual({
      ok: false,
      errors: { form: "That Category is no longer available." },
    });
    expect(await deleteCategory(repo, "grp_missing", "cat_x", GUEST)).toEqual({
      ok: false,
      errors: { form: "This Group is no longer available." },
    });
  });
});

describe("Custom Category management by Editing Mode", () => {
  /** Alex created the Group, which has an unused Custom Category, Pets; Sam is a Linked Member. */
  function flatOf(editingMode: EditingMode) {
    const group: GroupSnapshot = {
      id: "grp_flat",
      name: "Flat",
      description: "",
      currency: "USD",
      creatorUserId: "user_alex",
      editingMode,
      members: [
        { id: "mem_alex", name: "Alex", userId: "user_alex", avatarColor: "#3B82F6" },
        { id: "mem_sam", name: "Sam", userId: "user_sam", avatarColor: "#10B981" },
      ],
      expenses: [],
      settlements: [],
      customCategories: [{ id: "cat_pets", name: "Pets" }],
    };
    return createSessionStorageRepository(memoryStorage(), () => [group]);
  }
  const alex = { userId: "user_alex" };
  const sam = { userId: "user_sam" };

  const ACTIONS: [string, (repo: GroupRepository, visitor: Visitor) => Promise<{ ok: boolean }>][] = [
    ["addCategory", (repo, visitor) => addCategory(repo, "grp_flat", { name: "Cleaning" }, visitor)],
    ["renameCategory", (repo, visitor) => renameCategory(repo, "grp_flat", "cat_pets", { name: "Pet food" }, visitor)],
    ["deleteCategory", (repo, visitor) => deleteCategory(repo, "grp_flat", "cat_pets", visitor)],
  ];

  it.each(ACTIONS)("%s: in Own Records Only, refuses a Member who isn't the Group Creator", async (_name, act) => {
    const repo = flatOf("own-records-only");

    expect(await act(repo, sam)).toEqual({
      ok: false,
      errors: {
        form: "This Group is set to Own Records Only: only the Group Creator, Alex, can add, rename or delete Categories.",
      },
    });
    expect((await repo.getGroup("grp_flat"))?.customCategories).toEqual([{ id: "cat_pets", name: "Pets" }]);
  });

  it.each(ACTIONS)("%s: in Own Records Only, lets the Group Creator", async (_name, act) => {
    expect(await act(flatOf("own-records-only"), alex)).toEqual({ ok: true });
  });

  it.each(ACTIONS)("%s: in Open, lets any Member", async (_name, act) => {
    expect(await act(flatOf("open"), sam)).toEqual({ ok: true });
    expect(await act(flatOf("open"), alex)).toEqual({ ok: true });
  });
});
