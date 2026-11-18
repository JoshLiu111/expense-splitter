import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "@/db/client";
import { user } from "@/db/schema";
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

  it("lists a User's Groups oldest first", async () => {
    const repo = createPostgresGroupRepository(db, await aUser());
    const first = await repo.createGroup({ name: "First", description: "", currency: "USD" });
    const second = await repo.createGroup({ name: "Second", description: "", currency: "JPY" });

    expect((await repo.listGroups()).map((g) => g.id)).toEqual([first.id, second.id]);
  });
});
