import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/test/memory-storage";
import type { GroupRepository } from "./group-repository";
import { addMember, deleteGroup, removeMember, setMemberEmail, updateGroupDetails } from "./manage-group";
import type { MemberNotifier } from "./member-notifier";

/** A Group with "You" and Chloe, where Chloe owes You $10.00. */
async function flatWithDebt() {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  const you = group.members[0];
  const chloe = (await repo.addMember(group.id, { name: "Chloe" }))!;
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

/** A repository that Links any email to a User called Theo Park, as Postgres does for a verified email. */
function linkingAll(repo: GroupRepository): GroupRepository {
  const link = <T extends { email?: string } | null>(member: T) =>
    member && member.email ? { ...member, name: "Theo Park", userId: "usr_theo" } : member;
  return {
    ...repo,
    addMember: async (groupId, member) => link(await repo.addMember(groupId, member)),
    setMemberEmail: async (groupId, memberId, email) => link(await repo.setMemberEmail(groupId, memberId, email)),
  };
}

/** A notifier that records whom it told they were added. */
function recordingNotifier(inviterName = "Ana") {
  const added: Parameters<NonNullable<MemberNotifier["added"]>>[0][] = [];
  const notifier: MemberNotifier = {
    inviterName,
    async added(args) {
      added.push(args);
    },
  };
  return { notifier, added };
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

    expect(await addMember(repo, group.id, { name: " Dev ", email: "" })).toEqual({ ok: true, name: "Dev" });
    expect((await repo.getGroup(group.id))?.members.map((m) => m.name)).toEqual(["You", "Chloe", "Dev"]);
  });

  it("explains a duplicate name", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, { name: "chloe" })).toEqual({
      ok: false,
      errors: { name: "Chloe is already a Member of this Group." },
    });
  });

  it("adds a Member by email, lower-cased", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, { name: "Dev", email: " Dev@Example.com" })).toEqual({ ok: true, name: "Dev" });
    expect((await repo.getGroup(group.id))?.members.at(-1)).toMatchObject({ name: "Dev", email: "dev@example.com" });
  });

  it("explains a bad name and a bad email together", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, { name: "", email: "dev" })).toEqual({
      ok: false,
      errors: { name: "Enter the Member's name.", email: "Enter an email address like name@example.com." },
    });
  });

  it("refuses an email another Member of the Group already has", async () => {
    const { repo, group } = await flatWithDebt();
    await addMember(repo, group.id, { name: "Dev", email: "dev@example.com" });

    expect(await addMember(repo, group.id, { name: "Devin", email: "DEV@example.com" })).toEqual({
      ok: false,
      errors: { email: "Dev already has that email in this Group." },
    });
  });

  it("answers the name a Linked Member is shown under: their User's, not the one typed", async () => {
    const { repo, group } = await flatWithDebt();
    // A repository that Links the email to a User called Theo Park, as Postgres does.
    const linking: typeof repo = {
      ...repo,
      async addMember(groupId, member) {
        const added = await repo.addMember(groupId, member);
        return added && { ...added, name: "Theo Park", userId: "usr_theo" };
      },
    };

    expect(await addMember(linking, group.id, { name: "Theo", email: "theo@example.com" })).toEqual({
      ok: true,
      name: "Theo Park",
    });
  });

  it("tells an existing User they were added, naming the Group and who added them", async () => {
    const { repo, group } = await flatWithDebt();
    const { notifier, added } = recordingNotifier("Ana");

    expect(await addMember(linkingAll(repo), group.id, { name: "Theo", email: "Theo@example.com" }, notifier)).toEqual({
      ok: true,
      name: "Theo Park",
    });
    expect(added).toEqual([
      { groupId: group.id, groupName: "Flat", email: "theo@example.com", inviterName: "Ana" },
    ]);
  });

  it("tells nobody they were added when the Member is Pending or Name-only", async () => {
    const { repo, group } = await flatWithDebt();
    const { notifier, added } = recordingNotifier();

    await addMember(repo, group.id, { name: "Dev", email: "dev@example.com" }, notifier);
    await addMember(repo, group.id, { name: "Eve", email: "" }, notifier);

    expect(added).toEqual([]);
  });

  it("keeps the added Member when telling them fails", async () => {
    const { repo, group } = await flatWithDebt();
    const failing: MemberNotifier = {
      inviterName: "Ana",
      added: () => Promise.reject(new Error("Resend is down")),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await addMember(linkingAll(repo), group.id, { name: "Theo", email: "theo@example.com" }, failing)).toEqual({
      ok: true,
      name: "Theo Park",
    });
    expect((await repo.getGroup(group.id))?.members.at(-1)).toMatchObject({ email: "theo@example.com" });
    expect(console.error).toHaveBeenCalled();
  });

  it("treats malformed input as empty fields", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, 42)).toEqual({
      ok: false,
      errors: { name: "Enter the Member's name." },
    });
  });
});

describe("setMemberEmail", () => {
  it("gives a Name-only Member an email, keeping their Balance", async () => {
    const { repo, group, chloe } = await flatWithDebt();

    expect(await setMemberEmail(repo, group.id, chloe.id, "chloe@example.com")).toEqual({ ok: true });
    const after = await repo.getGroup(group.id);
    expect(after?.members.find((m) => m.id === chloe.id)?.email).toBe("chloe@example.com");
    expect(after?.expenses).toHaveLength(1);
  });

  it("requires an email, and a valid one", async () => {
    const { repo, group, chloe } = await flatWithDebt();

    expect(await setMemberEmail(repo, group.id, chloe.id, " ")).toEqual({
      ok: false,
      errors: { email: "Enter the Member's email address." },
    });
    expect(await setMemberEmail(repo, group.id, chloe.id, "chloe")).toEqual({
      ok: false,
      errors: { email: "Enter an email address like name@example.com." },
    });
  });

  it("tells an existing User they were added when a Name-only Member is given their email", async () => {
    const { repo, group, chloe } = await flatWithDebt();
    const { notifier, added } = recordingNotifier("Ana");

    expect(await setMemberEmail(linkingAll(repo), group.id, chloe.id, "chloe@example.com", notifier)).toEqual({
      ok: true,
    });
    expect(added).toEqual([
      { groupId: group.id, groupName: "Flat", email: "chloe@example.com", inviterName: "Ana" },
    ]);
  });

  it("tells nobody they were added when the Member stays Pending", async () => {
    const { repo, group, chloe } = await flatWithDebt();
    const { notifier, added } = recordingNotifier();

    await setMemberEmail(repo, group.id, chloe.id, "chloe@example.com", notifier);

    expect(added).toEqual([]);
  });

  it("refuses a Former Member", async () => {
    const { repo, group } = await flatWithDebt();
    const dev = (await repo.addMember(group.id, { name: "Dev" }))!;
    await repo.removeMember(group.id, dev.id);

    expect(await setMemberEmail(repo, group.id, dev.id, "dev@example.com")).toEqual({
      ok: false,
      errors: { form: "Dev has been removed from this Group." },
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
    const dev = (await repo.addMember(group.id, { name: "Dev" }))!;

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
