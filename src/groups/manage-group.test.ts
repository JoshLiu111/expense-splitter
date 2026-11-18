import { describe, expect, it } from "vitest";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/test/memory-storage";
import { addMember, deleteGroup, removeMember, updateGroupDetails } from "./manage-group";

/** A Group with "You" and Chloe, where Chloe owes You $10.00. */
async function flatWithDebt() {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  const you = group.members[0];
  const chloe = (await repo.addMember(group.id, "Chloe"))!;
  await repo.addExpense(group.id, {
    description: "Pizza",
    amount: 1000,
    currency: "USD",
    lockedRate: "1",
    payerId: you.id,
    splitType: "exact",
    shares: [{ memberId: chloe.id, amount: 1000 }],
    date: "2026-03-01",
    category: "Food & Drink",
  });
  return { repo, group, you, chloe };
}

describe("updateGroupDetails", () => {
  it("saves a new name and description", async () => {
    const { repo, group } = await flatWithDebt();

    expect(
      await updateGroupDetails(repo, group.id, { name: "Flat 3B", description: "Bills", currency: "USD" }),
    ).toEqual({ ok: true });
    expect(await repo.getGroup(group.id)).toMatchObject({ name: "Flat 3B", description: "Bills" });
  });

  it("refuses a Group Currency change once there are Expenses, whatever the caller sends", async () => {
    const { repo, group } = await flatWithDebt();

    expect(
      await updateGroupDetails(repo, group.id, { name: "Flat", description: "", currency: "EUR" }),
    ).toEqual({
      ok: false,
      errors: {
        currency: "The Group Currency can't change once the Group has Expenses or Settlements.",
      },
    });
    expect((await repo.getGroup(group.id))?.currency).toBe("USD");
  });

  it("treats malformed input as empty fields", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await updateGroupDetails(repo, group.id, { name: 42 })).toMatchObject({
      ok: false,
      errors: { name: "Enter a name for the Group." },
    });
  });
});

describe("addMember", () => {
  it("adds a Name-only Member who can then share Expenses", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, " Dev ")).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.members.map((m) => m.name)).toEqual(["You", "Chloe", "Dev"]);
  });

  it("explains a duplicate name", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, "chloe")).toEqual({
      ok: false,
      errors: { name: "Chloe is already a Member of this Group." },
    });
  });
});

describe("removeMember", () => {
  it("refuses to remove a Member whose Balance isn't zero", async () => {
    const { repo, group, chloe } = await flatWithDebt();

    expect(await removeMember(repo, group.id, chloe.id)).toEqual({
      ok: false,
      errors: { form: "Chloe can't be removed until their Balance is zero." },
    });
    expect((await repo.getGroup(group.id))?.members.find((m) => m.id === chloe.id)?.former).toBeFalsy();
  });

  it("makes a Member with a zero Balance a Former Member", async () => {
    const { repo, group } = await flatWithDebt();
    const dev = (await repo.addMember(group.id, "Dev"))!;

    expect(await removeMember(repo, group.id, dev.id)).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.members.find((m) => m.id === dev.id)?.former).toBe(true);
  });
});

describe("deleteGroup", () => {
  it("refuses to delete a Group that isn't Settled Up", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await deleteGroup(repo, group.id, { userId: undefined })).toEqual({
      ok: false,
      errors: { form: "Everyone must be Settled Up before this Group can be deleted." },
    });
    expect(await repo.getGroup(group.id)).not.toBeNull();
  });

  it("refuses a User who isn't the Group Creator", async () => {
    const repo = createSessionStorageRepository(memoryStorage(), () => []);
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    // Guest Groups have no Group Creator User, so no signed-in User created it.
    expect(await deleteGroup(repo, group.id, { userId: "usr_theo" })).toMatchObject({ ok: false });
  });

  it("lets the Guest delete their Settled Up Group", async () => {
    const repo = createSessionStorageRepository(memoryStorage(), () => []);
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    expect(await deleteGroup(repo, group.id, { userId: undefined })).toEqual({ ok: true });
    expect(await repo.getGroup(group.id)).toBeNull();
  });
});
