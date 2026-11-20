import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, type Database } from "@/db/client";
import { user } from "@/db/schema";
import { createPostgresGroupRepository } from "@/groups/postgres-group-repository";
import { failClaiming } from "@/test/fail-claiming";
import { createInvitations } from "./invitations";
import { signUpByInvitation } from "./sign-up-by-invitation";

// The real Better Auth server, kept in the test database.
vi.mock("server-only", () => ({}));
const { createAuth } = await import("@/auth/auth");

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Signing up through an Invitation", () => {
  let db: Database;
  let auth: ReturnType<typeof createAuth>;
  let close: () => Promise<void>;
  let count = 0;
  const now = () => new Date("2026-03-01T09:00:00Z");

  // The database is migrated and emptied once per run (src/test/database-setup.ts).
  beforeAll(() => {
    const created = createDatabase(url!);
    db = created.db;
    auth = createAuth(db);
    close = () => created.pool.end();
  });

  afterAll(async () => {
    await close();
  });

  /** Maya's Group with a Pending Member for a fresh email, and its Invitation. */
  async function anInvitation(email = `dev${count + 1}@signup-invite.test`) {
    count += 1;
    const maya = { id: `usr_signup_inv_${count}`, name: "Maya", email: `maya${count}@signup-invite.test` };
    await db.insert(user).values({ ...maya, emailVerified: true });
    const repo = createPostgresGroupRepository(db, maya, undefined, now);
    const group = await repo.createGroup({ name: "Flat 3B", description: "", currency: "USD" });
    const pending = (await repo.addMember(group.id, { name: "Dev Shah", email }))!;
    const token = (await repo.issueInvitation(group.id, pending.id))!;
    return { group, pending, token, email };
  }

  it("creates a verified account for the invited email that has claimed the Pending Member", async () => {
    const { group, token, email } = await anInvitation();

    const result = await signUpByInvitation(auth, createInvitations(db, now), {
      token,
      name: "Dev Shah",
      password: "correct horse battery",
      // The form's email field is locked, but a hand-made request could still send one.
      email: "someone-else@signup-invite.test",
    });

    expect(result).toEqual({ ok: true, email, groupId: group.id });
    const { user: dev } = await auth.api.signInEmail({ body: { email, password: "correct horse battery" } });
    expect(dev.emailVerified).toBe(true);
    const devsGroups = await createPostgresGroupRepository(db, dev).listGroups();
    expect(devsGroups.map((g) => g.id)).toEqual([group.id]);
    expect(devsGroups[0].members.find((m) => m.userId === dev.id)?.name).toBe("Dev Shah");
  });

  it("checks the name and password as sign-up does", async () => {
    const { token } = await anInvitation();

    expect(await signUpByInvitation(auth, createInvitations(db, now), { token, name: " ", password: "short" })).toEqual({
      ok: false,
      errors: { name: "Enter your name.", password: expect.stringMatching(/at least/i) },
    });
  });

  it("sends an email that already has an account to sign in instead", async () => {
    const { token, email } = await anInvitation();
    await db.insert(user).values({ id: `usr_signup_inv_dup_${count}`, name: "Dev", email });

    expect(
      await signUpByInvitation(auth, createInvitations(db, now), { token, name: "Dev", password: "correct horse battery" }),
    ).toEqual({ ok: false, errors: { form: "This email is already registered. Sign in instead." } });
  });

  it("creates no account from a link that no longer works", async () => {
    const { token, email } = await anInvitation();
    const later = () => new Date("2026-03-09T09:00:00Z");

    expect(
      await signUpByInvitation(auth, createInvitations(db, later), {
        token,
        name: "Dev",
        password: "correct horse battery",
      }),
    ).toEqual({ ok: false, errors: { form: expect.stringMatching(/expired/i) } });
    await expect(
      auth.api.signInEmail({ body: { email, password: "correct horse battery" } }),
    ).rejects.toThrow();
  });

  it("creates no account when claiming fails, so signing up again works", async () => {
    const { group, pending, token, email } = await anInvitation();
    const invitations = createInvitations(db, now);
    const input = { token, name: "Dev Shah", password: "correct horse battery" };
    const restore = await failClaiming(db, pending.id);

    await expect(signUpByInvitation(auth, invitations, input)).rejects.toThrow();
    await restore();

    expect(await invitations.lookUp(token)).toMatchObject({ status: "valid", hasAccount: false });
    expect(await signUpByInvitation(auth, invitations, input)).toEqual({ ok: true, email, groupId: group.id });
  });

  it("answers a second submit of the same link with a form error, not a crash", async () => {
    const { token } = await anInvitation();
    const invitations = createInvitations(db, now);
    const input = { token, name: "Dev Shah", password: "correct horse battery" };

    const results = await Promise.all([
      signUpByInvitation(auth, invitations, input),
      signUpByInvitation(auth, invitations, input),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, errors: { form: expect.any(String) } });
  });

  it("answers signing up twice at once as one email, through two Groups' links, with a form error", async () => {
    const first = await anInvitation();
    const second = await anInvitation(first.email);
    const invitations = createInvitations(db, now);
    const input = { name: "Dev Shah", password: "correct horse battery" };

    const results = await Promise.all([
      signUpByInvitation(auth, invitations, { ...input, token: first.token }),
      signUpByInvitation(auth, invitations, { ...input, token: second.token }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      errors: { form: expect.stringMatching(/already registered|already used/) },
    });
  });

  // Signing in through an Invitation's link (an account exists) relies on
  // Better Auth letting a User with an unverified email sign in.
  it("lets a User whose email isn't verified yet sign in, to use an Invitation sent to it", async () => {
    count += 1;
    const email = `unverified${count}@signup-invite.test`;
    await auth.api.signUpEmail({ body: { email, name: "Dev", password: "correct horse battery" } });

    const { user: dev } = await auth.api.signInEmail({ body: { email, password: "correct horse battery" } });

    expect(dev.emailVerified).toBe(false);
  });
});
