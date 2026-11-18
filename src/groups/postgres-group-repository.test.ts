import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "@/db/client";
import { members, user } from "@/db/schema";
import { groupRepositoryContract } from "./group-repository.contract";
import { createPostgresGroupRepository, type GroupUser } from "./postgres-group-repository";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Postgres GroupRepository", () => {
  let db: Database;
  let close: () => Promise<void>;
  let userCount = 0;

  beforeAll(async () => {
    const created = createDatabase(url!);
    db = created.db;
    close = () => created.pool.end();
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.execute(sql`truncate table "user", groups cascade`);
  });

  afterAll(async () => {
    await close();
  });

  /** A registered User to act as; created directly as a test fixture. */
  async function aUser(): Promise<GroupUser> {
    userCount += 1;
    const u = { id: `usr_${userCount}`, name: `User ${userCount}`, email: `u${userCount}@example.test` };
    await db.insert(user).values(u);
    return u;
  }

  groupRepositoryContract(async () => createPostgresGroupRepository(db, await aUser()));

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
    // Theo is a Linked Member too (fixture: linking isn't built yet).
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

  it("takes the Group away from a Linked Member once they are a Former Member", async () => {
    const maya = await aUser();
    const theo = await aUser();
    const mayasRepo = createPostgresGroupRepository(db, maya);
    const group = await mayasRepo.createGroup({ name: "Shared", description: "", currency: "USD" });
    // Theo is a Linked Member too (fixture: linking isn't built yet).
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

  it("keeps another User from managing a Group's details and Members", async () => {
    const mayasRepo = createPostgresGroupRepository(db, await aUser());
    const group = await mayasRepo.createGroup({ name: "Private", description: "", currency: "USD" });
    const chloe = await mayasRepo.addMember(group.id, "Chloe");

    const theosRepo = createPostgresGroupRepository(db, await aUser());
    expect(await theosRepo.updateGroup(group.id, { name: "Mine", description: "", currency: "EUR" })).toBeNull();
    expect(await theosRepo.addMember(group.id, "Theo")).toBeNull();
    expect(await theosRepo.removeMember(group.id, chloe!.id)).toBe(false);
    expect(await theosRepo.deleteGroup(group.id)).toBe(false);
    expect(await mayasRepo.getGroup(group.id)).toMatchObject({
      name: "Private",
      currency: "USD",
      members: [expect.anything(), chloe],
    });
  });

  it("lists a User's Groups oldest first", async () => {
    const repo = createPostgresGroupRepository(db, await aUser());
    const first = await repo.createGroup({ name: "First", description: "", currency: "USD" });
    const second = await repo.createGroup({ name: "Second", description: "", currency: "JPY" });

    expect((await repo.listGroups()).map((g) => g.id)).toEqual([first.id, second.id]);
  });
});
