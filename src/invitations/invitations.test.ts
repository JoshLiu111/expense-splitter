import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "@/db/client";
import { user } from "@/db/schema";
import { createPostgresGroupRepository, type GroupUser } from "@/groups/postgres-group-repository";
import { createInvitations } from "./invitations";

const url = process.env.TEST_DATABASE_URL;

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!url)("Invitations", () => {
  let db: Database;
  let close: () => Promise<void>;
  let count = 0;
  /** The fake clock every repository and Invitation here reads. */
  let clock = new Date("2026-03-01T09:00:00Z");
  const now = () => clock;

  // The database is migrated and emptied once per run (src/test/database-setup.ts).
  beforeAll(() => {
    const created = createDatabase(url!);
    db = created.db;
    close = () => created.pool.end();
  });

  afterAll(async () => {
    await close();
  });

  /** A unique email no User has yet; other test files share the database. */
  function anEmail(): string {
    count += 1;
    return `invitee${count}@invite.test`;
  }

  /** A registered User, created directly as a test fixture. */
  async function aUser({ email = anEmail(), verified = false } = {}): Promise<GroupUser> {
    count += 1;
    const u = { id: `usr_inv_${count}`, name: `User ${count}`, email };
    await db.insert(user).values({ ...u, emailVerified: verified });
    return u;
  }

  /** Maya's Group with a Pending Member for `email`, and its first Invitation. */
  async function anInvitation(email = anEmail(), groupName = "Flat 3B") {
    const maya = await aUser({ verified: true });
    const repo = createPostgresGroupRepository(db, maya, undefined, now);
    const group = await repo.createGroup({ name: groupName, description: "", currency: "USD" });
    const pending = (await repo.addMember(group.id, { name: "Dev Shah", email }))!;
    const token = (await repo.issueInvitation(group.id, pending.id))!;
    return { maya, repo, group, pending, token, email };
  }

  describe("looking up a token", () => {
    it("answers a valid Invitation's email and Group, and whether that email has an account", async () => {
      const { group, token, email } = await anInvitation();
      const invitations = createInvitations(db, now);

      expect(await invitations.lookUp(token)).toEqual({
        status: "valid",
        email,
        groupId: group.id,
        groupName: "Flat 3B",
        hasAccount: false,
      });

      await aUser({ email: email.toUpperCase() });
      expect(await invitations.lookUp(token)).toMatchObject({ status: "valid", hasAccount: true });
    });

    it("expires 7 days after it was issued", async () => {
      const issued = clock;
      const { token } = await anInvitation();
      const invitations = createInvitations(db, now);

      clock = new Date(issued.getTime() + 7 * DAY - 1);
      expect(await invitations.lookUp(token)).toMatchObject({ status: "valid" });
      clock = new Date(issued.getTime() + 7 * DAY);
      expect(await invitations.lookUp(token)).toMatchObject({ status: "expired" });
      clock = issued;
    });

    it("stops working once a newer Invitation is issued for the Pending Member", async () => {
      const { repo, group, pending, token } = await anInvitation();
      const invitations = createInvitations(db, now);

      const newer = (await repo.issueInvitation(group.id, pending.id))!;

      expect(await invitations.lookUp(token)).toMatchObject({ status: "superseded" });
      expect(await invitations.lookUp(newer)).toMatchObject({ status: "valid" });
    });

    it("stops working once the Pending Member is removed", async () => {
      const { repo, group, pending, token } = await anInvitation();

      await repo.removeMember(group.id, pending.id);

      expect(await createInvitations(db, now).lookUp(token)).toMatchObject({ status: "revoked" });
    });

    it("doesn't know a token that was never issued", async () => {
      expect(await createInvitations(db, now).lookUp("not-a-token")).toEqual({ status: "unknown" });
    });
  });

  describe("accepting as the User with its email", () => {
    it("verifies their email and claims every Pending Member with it, in any Group, then names the Group", async () => {
      const { group, token, email } = await anInvitation();
      const other = await anInvitation(email, "Ski trip");
      const dev = await aUser({ email });
      const invitations = createInvitations(db, now);

      expect(await invitations.accept(token, dev)).toEqual({ ok: true, groupId: group.id });

      const devsRepo = createPostgresGroupRepository(db, dev, undefined, now);
      expect((await devsRepo.listGroups()).map((g) => g.name).sort()).toEqual(["Flat 3B", "Ski trip"]);
      // Verified now: being added by that email links them straight away.
      const later = await other.repo.createGroup({ name: "Later", description: "", currency: "USD" });
      expect(await other.repo.addMember(later.id, { name: "Dev", email })).toMatchObject({ userId: dev.id });
      expect(await invitations.lookUp(token)).toMatchObject({ status: "used", groupId: group.id });
      expect(await invitations.lookUp(other.token)).toMatchObject({ status: "used" });
    });

    it("claims nothing for a User with another email, so a forwarded link can't take over the Member", async () => {
      const { group, token, repo } = await anInvitation();
      const eve = await aUser();
      const invitations = createInvitations(db, now);

      expect(await invitations.accept(token, eve)).toEqual({ ok: false, status: "wrong-email" });

      expect(await createPostgresGroupRepository(db, eve).listGroups()).toEqual([]);
      expect((await repo.getGroup(group.id))?.members.some((m) => m.userId === eve.id)).toBe(false);
      expect(await invitations.lookUp(token)).toMatchObject({ status: "valid" });
    });

    it("refuses a link that no longer works", async () => {
      const issued = clock;
      const { token, email } = await anInvitation();
      const dev = await aUser({ email });
      clock = new Date(issued.getTime() + 8 * DAY);

      expect(await createInvitations(db, now).accept(token, dev)).toEqual({ ok: false, status: "expired" });
      expect(await createPostgresGroupRepository(db, dev).listGroups()).toEqual([]);
      clock = issued;
    });

    it("works only once", async () => {
      const { token, email } = await anInvitation();
      const dev = await aUser({ email });
      const invitations = createInvitations(db, now);

      await invitations.accept(token, dev);

      expect(await invitations.accept(token, dev)).toEqual({ ok: false, status: "used" });
    });
  });
});
