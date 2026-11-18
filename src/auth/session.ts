import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { GroupUser } from "@/groups/postgres-group-repository";
import { auth } from "./auth";
import { signInPath } from "./return-to";

/** The signed-in User, or `null`. Reads the request, so call it inside Suspense. */
export async function getCurrentUser(): Promise<GroupUser | null> {
  const result = await auth().api.getSession({ headers: await headers() });
  if (!result) return null;
  const { id, name, email } = result.user;
  return { id, name, email };
}

/** The signed-in User; otherwise redirects to sign-in and back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<GroupUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(returnTo));
  return user;
}
