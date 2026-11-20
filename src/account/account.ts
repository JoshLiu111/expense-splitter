import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { user } from "@/db/schema";
import { MAX_MEMBER_NAME_LENGTH } from "@/domain";

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

/** What an Account Settings form shows after it acts. */
export type AccountResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof AccountFields | "form", string>> };

/** The signed-in User an Account Settings operation acts for. */
export interface AccountUser {
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
export async function updateDisplayName(db: Database, account: AccountUser, input: unknown): Promise<AccountResult> {
  const name = text(input, "name").trim();
  // A display name is shown as a Member name, so it keeps to the same limit.
  if (!name) return { ok: false, errors: { name: "Enter your name." } };
  if (name.length > MAX_MEMBER_NAME_LENGTH)
    return { ok: false, errors: { name: `Keep the name to ${MAX_MEMBER_NAME_LENGTH} characters or fewer.` } };
  const rows = await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, account.id))
    .returning({ id: user.id });
  return rows.length > 0 ? { ok: true } : { ok: false, errors: { form: ACCOUNT_GONE } };
}

/** The Account Settings operations the page can call, bound to the signed-in User. */
export interface AccountManagement {
  updateDisplayName(fields: AccountFields): Promise<AccountResult>;
}
