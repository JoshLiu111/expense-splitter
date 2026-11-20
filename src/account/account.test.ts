import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "@/db/client";
import { user } from "@/db/schema";
import { createPostgresGroupRepository, type GroupUser } from "@/groups/postgres-group-repository";
import { updateDisplayName } from "./account";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Account Settings", () => {
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

  /** A registered User, created directly as a test fixture. */
  async function aUser(): Promise<GroupUser> {
    userCount += 1;
    // Ids of their own: other test files create Users in the same database.
    const u = { id: `usr_acct_${userCount}`, name: `User ${userCount}`, email: `acct${userCount}@example.test` };
    await db.insert(user).values(u);
    return u;
  }

  /** The User's name as their own Group shows it. */
  async function shownName(u: GroupUser): Promise<string> {
    const repo = createPostgresGroupRepository(db, u);
    const [group] = await repo.listGroups();
    return (group ?? (await repo.createGroup({ name: "Mine", description: "", currency: "USD" }))).members[0].name;
  }

  describe("display name", () => {
    it("changes the User's name, trimmed", async () => {
      const maya = await aUser();

      expect(await updateDisplayName(db, maya, { name: "  Maya Chen  " })).toEqual({ ok: true });

      expect(await shownName(maya)).toBe("Maya Chen");
    });

    it("refuses a blank name, keeping the old one", async () => {
      const maya = await aUser();

      expect(await updateDisplayName(db, maya, { name: "   " })).toEqual({
        ok: false,
        errors: { name: "Enter your name." },
      });
      expect(await updateDisplayName(db, maya, {})).toEqual({ ok: false, errors: { name: "Enter your name." } });
      expect(await shownName(maya)).toBe(maya.name);
    });

    it("refuses a name over 60 characters, keeping the old one", async () => {
      const maya = await aUser();

      expect(await updateDisplayName(db, maya, { name: "M".repeat(61) })).toEqual({
        ok: false,
        errors: { name: "Keep the name to 60 characters or fewer." },
      });
      expect(await shownName(maya)).toBe(maya.name);
      expect(await updateDisplayName(db, maya, { name: "M".repeat(60) })).toEqual({ ok: true });
    });

    it("says so when the User no longer exists", async () => {
      expect(await updateDisplayName(db, { id: "usr_missing" }, { name: "Maya" })).toEqual({
        ok: false,
        errors: { form: "Your account is no longer available." },
      });
    });
  });
});
