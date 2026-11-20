import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { Auth } from "@/auth/auth";
import { passwordRuleError } from "@/auth/password";
import type { Database } from "@/db/client";
import { user } from "@/db/schema";
import { MAX_MEMBER_NAME_LENGTH } from "@/domain";
import { avatarExtension, avatarFileError, NOT_AN_IMAGE, sniffAvatarType } from "./avatar-rules";
import type { AvatarStore } from "./avatar-store";

/**
 * Account Settings: what a signed-in User changes about their own account.
 * Every operation acts for the User it is given and answers in the shape
 * Group management does, so a form can show each error by its field.
 * Account changes are never recorded in any Group's Activity.
 */

/** The fields Account Settings forms send. */
export interface AccountFields {
  name: string;
}

/** The fields the change-password form sends. */
export interface PasswordFields {
  currentPassword: string;
  newPassword: string;
}

/** What an Account Settings form shows after it acts. */
export type AccountResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof AccountFields | "avatar" | keyof PasswordFields | "form", string>> };

/** The signed-in User an Account Settings operation acts for. */
export interface SignedInUser {
  id: string;
}

const ACCOUNT_GONE = "Your account is no longer available.";

const text = (record: unknown, key: string): string => {
  const value = typeof record === "object" && record !== null ? (record as Record<string, unknown>)[key] : "";
  return typeof value === "string" ? value : "";
};

/**
 * Changes the User's display name. It is also the name of every Member they
 * are Linked to, so the rename shows in each of their Groups at once.
 */
export async function updateDisplayName(db: Database, signedIn: SignedInUser, input: unknown): Promise<AccountResult> {
  const name = text(input, "name").trim();
  // A display name is shown as a Member name, so it keeps to the same limit.
  if (!name) return { ok: false, errors: { name: "Enter your name." } };
  if (name.length > MAX_MEMBER_NAME_LENGTH)
    return { ok: false, errors: { name: `Keep the name to ${MAX_MEMBER_NAME_LENGTH} characters or fewer.` } };
  const rows = await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, signedIn.id))
    .returning({ id: user.id });
  return rows.length > 0 ? { ok: true } : { ok: false, errors: { form: ACCOUNT_GONE } };
}

/**
 * Sets the User's avatar, replacing any they had. The image must keep to the
 * avatar rules (avatar-rules.ts), its type judged by its bytes, not by what
 * the upload says it is. The old image is deleted once the new one is on the
 * User.
 */
export async function setAvatar(
  db: Database,
  store: AvatarStore,
  signedIn: SignedInUser,
  file: unknown,
): Promise<AccountResult> {
  if (!(file instanceof Blob)) return { ok: false, errors: { avatar: NOT_AN_IMAGE } };
  const refused = avatarFileError({ type: file.type, size: file.size });
  if (refused) return { ok: false, errors: { avatar: refused } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffAvatarType(bytes);
  if (!type) return { ok: false, errors: { avatar: NOT_AN_IMAGE } };

  const url = await store.put(`avatars/${signedIn.id}.${avatarExtension(type)}`, new Blob([bytes], { type }));
  const old = await swapImage(db, signedIn, url);
  if (old === undefined) {
    await store.delete(url);
    return { ok: false, errors: { form: ACCOUNT_GONE } };
  }
  if (old && old !== url) await store.delete(old);
  return { ok: true };
}

/**
 * Puts `image` on the User and answers the one it replaced: `null` if they
 * had none, `undefined` if the User is gone. Locks the row, so two changes at
 * once each answer a different old image and none is left undeleted.
 */
async function swapImage(db: Database, signedIn: SignedInUser, image: string | null) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, signedIn.id))
      .for("update");
    if (!current) return undefined;
    if (current.image !== image) await tx.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, signedIn.id));
    return current.image;
  });
}

/** Removes the User's avatar and deletes its image, so their initials show again. */
export async function removeAvatar(db: Database, store: AvatarStore, signedIn: SignedInUser): Promise<AccountResult> {
  const old = await swapImage(db, signedIn, null);
  if (old === undefined) return { ok: false, errors: { form: ACCOUNT_GONE } };
  if (old) await store.delete(old);
  return { ok: true };
}

/**
 * Changes the password of the User signed in by `session` (the request's
 * headers) from their current one. Every other session is signed out; the
 * current one gets a fresh session cookie and stays signed in.
 */
export async function changePassword(
  auth: Pick<Auth, "api">,
  session: Headers,
  input: unknown,
): Promise<AccountResult> {
  const currentPassword = text(input, "currentPassword");
  const newPassword = text(input, "newPassword");
  if (!currentPassword) return { ok: false, errors: { currentPassword: "Enter your current password." } };
  const ruleError = passwordRuleError(newPassword);
  if (ruleError) return { ok: false, errors: { newPassword: ruleError } };
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: session,
    });
  } catch (error) {
    if (isAPIError(error) && (error.body as { code?: unknown } | undefined)?.code === "INVALID_PASSWORD")
      return { ok: false, errors: { currentPassword: "That isn't your current password." } };
    throw error;
  }
  return { ok: true };
}

/** The Account Settings operations the page can call, bound to the signed-in User. */
export interface AccountManagement {
  updateDisplayName(fields: AccountFields): Promise<AccountResult>;
  /** Takes the cropped image as the form data's `avatar` file. */
  setAvatar(form: FormData): Promise<AccountResult>;
  removeAvatar(): Promise<AccountResult>;
  changePassword(fields: PasswordFields): Promise<AccountResult>;
}
