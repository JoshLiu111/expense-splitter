"use server";

import { refresh } from "next/cache";
import { updateDisplayName, type AccountResult } from "@/account/account";
import { requireUser } from "@/auth/session";
import { db } from "@/db";

// Server Actions are public endpoints: each one re-checks the session and
// acts only on the signed-in User's own account.

export async function updateUserDisplayName(fields: unknown): Promise<AccountResult> {
  const user = await requireUser("/account");
  const result = await updateDisplayName(db(), user, fields);
  // The new name shows in the user menu and every Group at once.
  if (result.ok) refresh();
  return result;
}
