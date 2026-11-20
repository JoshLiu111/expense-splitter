import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, type Database } from "@/db/client";
import { user } from "@/db/schema";
import { createPostgresGroupRepository, type GroupUser } from "@/groups/postgres-group-repository";
import { anImage } from "@/test/images";
import { changePassword, removeAvatar, setAvatar, updateDisplayName } from "./account";
import { createMemoryAvatarStore } from "./avatar-store";

// The real Better Auth server, kept in the test database.
vi.mock("server-only", () => ({}));
const { createAuth } = await import("@/auth/auth");

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Account Settings", () => {
  let db: Database;
  let auth: ReturnType<typeof createAuth>;
  let close: () => Promise<void>;
  let userCount = 0;

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

  /** A registered User, created directly as a test fixture. */
  async function aUser(): Promise<GroupUser> {
    userCount += 1;
    // Ids of their own: other test files create Users in the same database.
    const u = { id: `usr_acct_${userCount}`, name: `User ${userCount}`, email: `acct${userCount}@example.test` };
    await db.insert(user).values(u);
    return u;
  }

  /** The User's avatar as their own Group shows it. */
  async function shownAvatar(u: GroupUser): Promise<string | undefined> {
    const repo = createPostgresGroupRepository(db, u);
    const [group] = await repo.listGroups();
    return (group ?? (await repo.createGroup({ name: "Mine", description: "", currency: "USD" }))).members[0].avatarUrl;
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

  describe("avatar", () => {
    it.each(["jpeg", "png", "webp"] as const)("sets a %s image as the User's avatar", async (kind) => {
      const maya = await aUser();
      const store = createMemoryAvatarStore();

      expect(await setAvatar(db, store, maya, anImage(kind))).toEqual({ ok: true });

      expect(store.urls()).toHaveLength(1);
      expect(await shownAvatar(maya)).toBe(store.urls()[0]);
    });

    it("replaces an avatar, deleting the old image", async () => {
      const maya = await aUser();
      const store = createMemoryAvatarStore();
      await setAvatar(db, store, maya, anImage("png"));
      const [old] = store.urls();

      expect(await setAvatar(db, store, maya, anImage("webp"))).toEqual({ ok: true });

      const [current, ...rest] = store.urls();
      expect(rest).toEqual([]);
      expect(current).not.toBe(old);
      expect(await shownAvatar(maya)).toBe(current);
    });

    it("removes an avatar, deleting its image, so the User's initials show again", async () => {
      const maya = await aUser();
      const store = createMemoryAvatarStore();
      await setAvatar(db, store, maya, anImage("png"));

      expect(await removeAvatar(db, store, maya)).toEqual({ ok: true });

      expect(store.urls()).toEqual([]);
      expect(await shownAvatar(maya)).toBeUndefined();
      // Removing it again changes nothing.
      expect(await removeAvatar(db, store, maya)).toEqual({ ok: true });
    });

    it("accepts an image of exactly 2 MB and refuses a larger one, keeping the old avatar", async () => {
      const maya = await aUser();
      const store = createMemoryAvatarStore();
      await setAvatar(db, store, maya, anImage("png"));
      const [old] = store.urls();

      expect(await setAvatar(db, store, maya, anImage("png", { size: 2 * 1024 * 1024 + 1 }))).toEqual({
        ok: false,
        errors: { avatar: "Choose an image of 2 MB or less." },
      });
      expect(store.urls()).toEqual([old]);
      expect(await shownAvatar(maya)).toBe(old);

      expect(await setAvatar(db, store, maya, anImage("png", { size: 2 * 1024 * 1024 }))).toEqual({ ok: true });
    });

    it.each([
      ["a GIF", anImage("gif")],
      ["a GIF named as a PNG", anImage("gif", { type: "image/png" })],
      ["an empty file", new File([], "avatar.png", { type: "image/png" })],
      ["no file at all", "avatar.png"],
    ])("refuses %s", async (_, file) => {
      const maya = await aUser();
      const store = createMemoryAvatarStore();

      expect(await setAvatar(db, store, maya, file)).toEqual({
        ok: false,
        errors: { avatar: "Choose a JPEG, PNG or WebP image." },
      });
      expect(store.urls()).toEqual([]);
      expect(await shownAvatar(maya)).toBeUndefined();
    });

    it("says so when the User no longer exists, storing nothing", async () => {
      const store = createMemoryAvatarStore();
      const gone = { ok: false, errors: { form: "Your account is no longer available." } };

      expect(await setAvatar(db, store, { id: "usr_missing" }, anImage("png"))).toEqual(gone);
      expect(await removeAvatar(db, store, { id: "usr_missing" })).toEqual(gone);
      expect(store.urls()).toEqual([]);
    });
  });

  describe("password", () => {
    const OLD = "correct-horse-battery";
    let signUps = 0;

    /** A User who signed up with OLD as their password. */
    async function aSignedUpUser(): Promise<string> {
      signUps += 1;
      const email = `pw${signUps}@example.test`;
      await auth.api.signUpEmail({ body: { name: `Pat ${signUps}`, email, password: OLD } });
      return email;
    }

    /** Signs in, answering with the request headers of the new session. */
    async function signIn(email: string, password: string): Promise<Headers> {
      const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
      const cookie = headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
      return new Headers({ cookie });
    }

    const canSignIn = (email: string, password: string) =>
      signIn(email, password).then(
        () => true,
        () => false,
      );

    it("refuses a wrong current password, keeping the old one", async () => {
      const email = await aSignedUpUser();
      const session = await signIn(email, OLD);

      expect(
        await changePassword(auth, session, { currentPassword: "not-my-password", newPassword: "a-brand-new-one" }),
      ).toEqual({ ok: false, errors: { currentPassword: "That isn't your current password." } });
      expect(await canSignIn(email, OLD)).toBe(true);
      expect(await canSignIn(email, "a-brand-new-one")).toBe(false);
    });

    it("holds the new password to the sign-up rules, keeping the old one", async () => {
      const email = await aSignedUpUser();
      const session = await signIn(email, OLD);

      expect(await changePassword(auth, session, { currentPassword: OLD, newPassword: "short12" })).toEqual({
        ok: false,
        errors: { newPassword: "Use a password of at least 8 characters." },
      });
      expect(await changePassword(auth, session, { currentPassword: OLD, newPassword: "p".repeat(129) })).toEqual({
        ok: false,
        errors: { newPassword: "Use a password of 128 characters or fewer." },
      });
      expect(await canSignIn(email, OLD)).toBe(true);
    });

    it("changes the password and signs out every other session", async () => {
      const email = await aSignedUpUser();
      const here = await signIn(email, OLD);
      const elsewhere = await signIn(email, OLD);

      expect(await changePassword(auth, here, { currentPassword: OLD, newPassword: "a-brand-new-one" })).toEqual({
        ok: true,
      });

      expect(await auth.api.getSession({ headers: elsewhere })).toBeNull();
      expect(await canSignIn(email, "a-brand-new-one")).toBe(true);
      expect(await canSignIn(email, OLD)).toBe(false);
    });

    it("asks for the current password when it is left blank", async () => {
      const email = await aSignedUpUser();
      const session = await signIn(email, OLD);

      expect(await changePassword(auth, session, { newPassword: "a-brand-new-one" })).toEqual({
        ok: false,
        errors: { currentPassword: "Enter your current password." },
      });
    });
  });
});
