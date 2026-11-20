"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { changePassword, removeAvatar, setAvatar, updateDisplayName, type AccountResult } from "@/account/account";
import { avatarStore } from "@/account/avatars";
import { auth } from "@/auth/auth";
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

export async function setUserAvatar(form: FormData): Promise<AccountResult> {
  const user = await requireUser("/account");
  const result = await setAvatar(db(), avatarStore(), user, form.get("avatar"));
  if (result.ok) refresh();
  return result;
}

export async function removeUserAvatar(): Promise<AccountResult> {
  const user = await requireUser("/account");
  const result = await removeAvatar(db(), avatarStore(), user);
  if (result.ok) refresh();
  return result;
}

export async function changeUserPassword(fields: unknown): Promise<AccountResult> {
  await requireUser("/account");
  // Better Auth sets this browser's fresh session cookie; other sessions end.
  return changePassword(auth(), await headers(), fields);
}
