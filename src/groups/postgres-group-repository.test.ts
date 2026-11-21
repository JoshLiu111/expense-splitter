import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removeAvatar, setAvatar, updateDisplayName } from "@/account/account";
import { createMemoryAvatarStore } from "@/account/avatar-store";
import { anImage } from "@/test/images";
import { createDatabase, type Database } from "@/db/client";
import { groups, members, user } from "@/db/schema";
import { createInvitations } from "@/invitations/invitations";
import { groupRepositoryContract } from "./group-repository.contract";
import {
  claimPendingMembers,
  createPostgresGroupRepository,
  type GroupUser,
} from "./postgres-group-repository";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Postgres GroupRepository", () => {
  let db: Database;
  let close: () => Promise<void>;
  let userCount = 0;

  // The database is migrated and emptied once per run (src/test/database-setup.ts).
  beforeAll(() => {
    const created = createDatabase(url!);
    db = created.db;
    close = () => created.pool.end();
  });

  afterAll(async () => {
    await close();
  });

  /** A registered User to act as; created directly as a test fixture. */
  async function aUser({ verified = false } = {}): Promise<GroupUser> {
    userCount += 1;
    const u = { id: `usr_${userCount}`, name: `User ${userCount}`, email: `u${userCount}@example.test` };
    await db.insert(user).values({ ...u, emailVerified: verified });
    return u;
  }

  /** Marks a User's email verified, as following the emailed link does. */
  async function verify(u: GroupUser) {
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, u.id));
  }

  // A User's changes are recorded under their Linked Member: the creator, here.
  groupRepositoryContract(
    async () => createPostgresGroupRepository(db, await aUser()),
    (group) => group.members[0].id,
    {
      aUser: () => aUser({ verified: true }),
      repositoryOf: async (u) => createPostgresGroupRepository(db, u),
      async rename(userId, name) {
        expect(await updateDisplayName(db, { id: userId }, { name })).toEqual({ ok: true });
      },
      async setAvatar(userId) {
        const store = createMemoryAvatarStore();
        expect(await setAvatar(db, store, { id: userId }, anImage("png"))).toEqual({ ok: true });
        return store.urls()[0];
      },
      async removeAvatar(userId) {
        expect(await removeAvatar(db, createMemoryAvatarStore(), { id: userId })).toEqual({ ok: true });
      },
      async invitationStatus(token) {
        return (await createInvitations(db).lookUp(token)).status;
      },
    },
  );

  it("records the creating User as Group Creator and as a Linked Member", async () => {
    const maya = await aUser();
    const group = await createPostgresGroupRepository(db, maya).createGroup({
      name: "Flat 3B",
      description: "",
      currency: "USD",
    });

    expect(group.creatorUserId).toBe(maya.id);
    expect(group.members).toEqual([
      expect.objectContaining({ name: maya.name, email: maya.email, userId: maya.id }),
    ]);
  });

  it("keeps a User's Groups out of another User's view", async () => {
    const maya = await aUser();
    const theo = await aUser();
    const group = await createPostgresGroupRepository(db, maya).createGroup({
      name: "Private",
      description: "",
      currency: "USD",
    });

    const theosRepo = createPostgresGroupRepository(db, theo);
    expect(await theosRepo.listGroups()).toEqual([]);
    expect(await theosRepo.getGroup(group.id)).toBeNull();
  });

  it("keeps another User from changing a Group's Expenses", async () => {
    const maya = await aUser();
    const mayasRepo = createPostgresGroupRepository(db, maya);
    const group = await mayasRepo.createGroup({ name: "Private", description: "", currency: "USD" });
    const me = group.members[0].id;
    const expense = {
      description: "Rent",
      amount: 100000,
      currency: "USD" as const,
      lockedRate: "1",
      payerId: me,
      splitType: "equal" as const,
      shares: [{ memberId: me, amount: 100000 }],
      date: "2026-03-01",
      category: "Housing",
    };
    const rent = await mayasRepo.addExpense(group.id, expense);

    const theosRepo = createPostgresGroupRepository(db, await aUser());
    expect(await theosRepo.addExpense(group.id, expense)).toBeNull();
    expect(await theosRepo.updateExpense(group.id, rent!.id, { ...expense, amount: 1 })).toBeNull();
    expect(await theosRepo.deleteExpense(group.id, rent!.id)).toBe(false);
    expect((await mayasRepo.getGroup(group.id))?.expenses).toEqual([rent]);
  });

  it("lets only the Group Creator delete a Group", async () => {
    const maya = await aUser();
    const theo = await aUser();
    const group = await createPostgresGroupRepository(db, maya).createGroup({
      name: "Shared",
      description: "",
      currency: "USD",
    });
    // Theo is a Linked Member too, inserted directly as a fixture.
    await db.insert(members).values({
      id: "mem_theo_shared",
      groupId: group.id,
      name: theo.name,
      userId: theo.id,
      avatarColor: "#10B981",
      position: 1,
    });

    const theosRepo = createPostgresGroupRepository(db, theo);
    expect(await theosRepo.deleteGroup(group.id)).toBe(false);
    expect(await theosRepo.getGroup(group.id)).not.toBeNull();
  });

  it("lets only the Group Creator change the Editing Mode, which every Member sees", async () => {
    const maya = await aUser();
    const theo = await aUser();
    const group = await createPostgresGroupRepository(db, maya).createGroup({
      name: "Shared",
      description: "",
      currency: "USD",
    });
    await db.insert(members).values({
      id: "mem_theo_editing",
      groupId: group.id,
      name: theo.name,
      userId: theo.id,
      avatarColor: "#10B981",
      position: 1,
    });
    const theosRepo = createPostgresGroupRepository(db, theo);

    expect(await theosRepo.setEditingMode(group.id, "own-records-only")).toBeNull();
    expect(await createPostgresGroupRepository(db, maya).setEditingMode(group.id, "own-records-only")).not.toBeNull();
    expect((await theosRepo.getGroup(group.id))?.editingMode).toBe("own-records-only");
  });

  it("takes the Group away from a Linked Member once they are a Former Member", async () => {
    const maya = await aUser();
    const theo = await aUser();
    const mayasRepo = createPostgresGroupRepository(db, maya);
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    // Theo is a Linked Member too, inserted directly as a fixture.
    await db.insert(members).values({
      id: "mem_theo_removed",
      groupId: group.id,
      name: theo.name,
      userId: theo.id,
      avatarColor: "#10B981",
      position: 1,
    });
    const theosRepo = createPostgresGroupRepository(db, theo);
    expect(await theosRepo.getGroup(group.id)).not.toBeNull();

    await mayasRepo.removeMember(group.id, "mem_theo_removed");

    expect(await theosRepo.getGroup(group.id)).toBeNull();
    expect(await theosRepo.listGroups()).toEqual([]);
  });

  it("lets a Linked Former Member read, but not change, the Group while their Balance is reopened (ADR 0006)", async () => {
    const maya = await aUser();
    const theo = await aUser({ verified: true });
    const mayasRepo = createPostgresGroupRepository(db, maya);
    const theosRepo = createPostgresGroupRepository(db, theo);
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    const mayaMember = group.members[0].id;
    const theoMember = (await mayasRepo.addMember(group.id, { name: "Theo", email: theo.email }))!.id;
    const dinner = {
      description: "Dinner",
      amount: 10000,
      currency: "USD" as const,
      lockedRate: "1",
      payerId: mayaMember,
      splitType: "equal" as const,
      shares: [
        { memberId: mayaMember, amount: 5000 },
        { memberId: theoMember, amount: 5000 },
      ],
      date: "2026-03-01",
      category: "Food & Drink",
    };
    const expense = (await mayasRepo.addExpense(group.id, dinner))!;
    // Theo pays back his $50 in two Settlements, so he can be removed at zero.
    const repaid = { fromId: theoMember, toId: mayaMember, date: "2026-03-02" };
    const kept = (await theosRepo.addSettlement(group.id, { ...repaid, amount: 2000 }))!;
    const paid = (await theosRepo.addSettlement(group.id, { ...repaid, amount: 3000 }))!;
    const category = (await mayasRepo.addCategory(group.id, "Utilities"))!;
    await mayasRepo.removeMember(group.id, theoMember);

    // Deleting one Settlement reopens Theo's Balance at -$30.
    await mayasRepo.deleteSettlement(group.id, paid.id);

    const theosView = await theosRepo.getGroup(group.id);
    expect(theosView).toEqual(await mayasRepo.getGroup(group.id));
    expect((await theosRepo.listGroups()).map((g) => g.id)).toEqual([group.id]);
    expect(await theosRepo.listActivity(group.id)).toEqual(await mayasRepo.listActivity(group.id));

    const settlement = { fromId: theoMember, toId: mayaMember, amount: 3000, date: "2026-03-03" };
    expect(await theosRepo.addExpense(group.id, dinner)).toBeNull();
    expect(await theosRepo.updateExpense(group.id, expense.id, { ...dinner, amount: 1 })).toBeNull();
    expect(await theosRepo.deleteExpense(group.id, expense.id)).toBe(false);
    expect(await theosRepo.addSettlement(group.id, settlement)).toBeNull();
    expect(await theosRepo.updateGroup(group.id, { name: "Mine", description: "", currency: "USD" })).toBeNull();
    expect(await theosRepo.addMember(group.id, { name: "Zoe" })).toBeNull();
    expect(await theosRepo.setMemberEmail(group.id, theoMember, "x@example.test")).toBeNull();
    expect(await theosRepo.removeMember(group.id, mayaMember)).toBe(false);
    expect(await theosRepo.deleteSettlement(group.id, kept.id)).toBe(false);
    expect(await theosRepo.addCategory(group.id, "Mine")).toBeNull();
    expect(await theosRepo.renameCategory(group.id, category.id, "Mine")).toBeNull();
    expect(await theosRepo.deleteCategory(group.id, category.id)).toBe(false);
    expect(await theosRepo.deleteGroup(group.id)).toBe(false);
    expect(await mayasRepo.getGroup(group.id)).toEqual(theosView);
    expect(await mayasRepo.listActivity(group.id)).toHaveLength(4);

    // Once the reopened Balance is settled, the Group is gone again.
    await mayasRepo.addSettlement(group.id, settlement);
    expect(await theosRepo.getGroup(group.id)).toBeNull();
    expect(await theosRepo.listGroups()).toEqual([]);
    expect(await theosRepo.listActivity(group.id)).toBeNull();
  });

  it("keeps a Group Creator who is a Former Member with a reopened Balance from deleting it", async () => {
    const maya = await aUser();
    const theo = await aUser();
    const mayasRepo = createPostgresGroupRepository(db, maya);
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    const mayaMember = group.members[0].id;
    // Theo is a Linked Member too, inserted directly as a fixture.
    await db.insert(members).values({
      id: "mem_theo_reopened",
      groupId: group.id,
      name: theo.name,
      userId: theo.id,
      avatarColor: "#10B981",
      position: 1,
    });
    const theosRepo = createPostgresGroupRepository(db, theo);
    await theosRepo.removeMember(group.id, mayaMember);
    await theosRepo.addSettlement(group.id, {
      fromId: "mem_theo_reopened",
      toId: mayaMember,
      amount: 500,
      date: "2026-03-01",
    });

    expect(await mayasRepo.getGroup(group.id)).not.toBeNull();
    expect(await mayasRepo.deleteGroup(group.id)).toBe(false);
    expect(await theosRepo.getGroup(group.id)).not.toBeNull();
  });

  it("keeps another User from managing a Group's details and Members", async () => {
    const mayasRepo = createPostgresGroupRepository(db, await aUser());
    const group = await mayasRepo.createGroup({ name: "Private", description: "", currency: "USD" });
    const chloe = await mayasRepo.addMember(group.id, { name: "Chloe" });

    const theosRepo = createPostgresGroupRepository(db, await aUser());
    expect(await theosRepo.updateGroup(group.id, { name: "Mine", description: "", currency: "EUR" })).toBeNull();
    expect(await theosRepo.addMember(group.id, { name: "Theo" })).toBeNull();
    expect(await theosRepo.removeMember(group.id, chloe!.id)).toBe(false);
    expect(await theosRepo.deleteGroup(group.id)).toBe(false);
    expect(await mayasRepo.getGroup(group.id)).toMatchObject({
      name: "Private",
      currency: "USD",
      members: [expect.anything(), chloe],
    });
  });

  it("links a Member added by a verified User's email, under that User's name; that User sees and edits the Group", async () => {
    const mayasRepo = createPostgresGroupRepository(db, await aUser());
    const theo = await aUser({ verified: true });
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });

    const added = await mayasRepo.addMember(group.id, { name: "Theo", email: theo.email });

    expect(added).toEqual({
      id: expect.any(String),
      name: theo.name,
      email: theo.email,
      userId: theo.id,
      avatarColor: expect.any(String),
    });
    const theosRepo = createPostgresGroupRepository(db, theo);
    expect((await theosRepo.listGroups()).map((g) => g.id)).toEqual([group.id]);
    expect(await theosRepo.updateGroup(group.id, { name: "Ours", description: "", currency: "USD" })).not.toBeNull();
    expect((await mayasRepo.getGroup(group.id))?.name).toBe("Ours");
  });

  it("makes a Member added by an unknown or unverified email a Pending Member", async () => {
    const mayasRepo = createPostgresGroupRepository(db, await aUser());
    const unverified = await aUser();
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });

    const pending = await mayasRepo.addMember(group.id, { name: "Theo", email: unverified.email });
    const stranger = await mayasRepo.addMember(group.id, { name: "Zoe", email: "zoe@nowhere.test" });

    expect(pending).not.toHaveProperty("userId");
    expect(stranger).not.toHaveProperty("userId");
    expect(await createPostgresGroupRepository(db, unverified).getGroup(group.id)).toBeNull();
  });

  it("links a Name-only Member given a verified User's email, keeping their history, under that User's name", async () => {
    const mayasRepo = createPostgresGroupRepository(db, await aUser());
    const theo = await aUser({ verified: true });
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    const named = await mayasRepo.addMember(group.id, { name: "Theo" });

    expect(await mayasRepo.setMemberEmail(group.id, named!.id, theo.email)).toEqual({
      ...named,
      name: theo.name,
      email: theo.email,
      userId: theo.id,
    });
    expect(await createPostgresGroupRepository(db, theo).getGroup(group.id)).not.toBeNull();
  });

  it("claims a Pending Member only when a User verifies that exact email", async () => {
    const mayasRepo = createPostgresGroupRepository(db, await aUser());
    const theo = await aUser();
    const other = await aUser({ verified: true });
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    const pending = await mayasRepo.addMember(group.id, { name: "Theo", email: theo.email });

    await claimPendingMembers(db, other);
    expect(await createPostgresGroupRepository(db, other).getGroup(group.id)).toBeNull();

    await verify(theo);
    await claimPendingMembers(db, theo);

    const theosView = await createPostgresGroupRepository(db, theo).getGroup(group.id);
    // Linked now, so no longer waiting on an Invitation.
    const { invitationSent, ...member } = pending!;
    expect(invitationSent).toBe(false);
    expect(theosView?.members).toContainEqual({ ...member, name: theo.name, userId: theo.id });
  });

  it("claims nothing in a Group where the User is already a Linked Member", async () => {
    const theo = await aUser({ verified: true });
    const mayasRepo = createPostgresGroupRepository(db, await aUser());
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    await mayasRepo.addMember(group.id, { name: "Theo", email: theo.email });
    // A second Pending Member with Theo's email, slipped in past validation.
    await db.insert(members).values({
      id: "mem_theo_dupe",
      groupId: group.id,
      name: "Theo again",
      email: theo.email,
      avatarColor: "#10B981",
      position: 9,
    });

    await claimPendingMembers(db, theo);

    const linked = (await mayasRepo.getGroup(group.id))?.members.filter((m) => m.userId === theo.id);
    expect(linked).toHaveLength(1);
  });

  it("shows every Linked Member all of a Group's Activity, each change under the Member who made it", async () => {
    const maya = await aUser();
    const theo = await aUser({ verified: true });
    const mayasRepo = createPostgresGroupRepository(db, maya);
    const theosRepo = createPostgresGroupRepository(db, theo);
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    const mayaMember = group.members[0].id;
    const chloe = await mayasRepo.addMember(group.id, { name: "Chloe" });
    const settlement = { fromId: chloe!.id, toId: mayaMember, amount: 100, date: "2026-03-02" };
    await mayasRepo.addSettlement(group.id, settlement);

    // Theo joins after Maya's change, makes one of his own, then leaves.
    const theoMember = await mayasRepo.addMember(group.id, { name: "Theo", email: theo.email });
    await theosRepo.addSettlement(group.id, settlement);
    expect((await theosRepo.listActivity(group.id))?.map((a) => a.actorMemberId)).toEqual([theoMember!.id, mayaMember]);
    await mayasRepo.removeMember(group.id, theoMember!.id);

    expect((await mayasRepo.listActivity(group.id))?.map((a) => a.actorMemberId)).toEqual([theoMember!.id, mayaMember]);
    // A Former Member no longer sees the Group, so nor its Activity.
    expect(await theosRepo.listActivity(group.id)).toBeNull();
  });

  it("marks Groups that existed before Activity launched with the day it started", async () => {
    const repo = createPostgresGroupRepository(db, await aUser());
    const group = await repo.createGroup({ name: "New", description: "", currency: "USD" });
    expect(group.activityStartedOn).toBeUndefined();

    await db.update(groups).set({ activityStartedOn: "2026-11-19" }).where(eq(groups.id, group.id));
    expect((await repo.getGroup(group.id))?.activityStartedOn).toBe("2026-11-19");
  });

  it("lists a User's Groups oldest first", async () => {
    const repo = createPostgresGroupRepository(db, await aUser());
    const first = await repo.createGroup({ name: "First", description: "", currency: "USD" });
    const second = await repo.createGroup({ name: "Second", description: "", currency: "JPY" });

    expect((await repo.listGroups()).map((g) => g.id)).toEqual([first.id, second.id]);
  });
});
