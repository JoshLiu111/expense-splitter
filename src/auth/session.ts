import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { GroupUser } from "@/groups/postgres-group-repository";
import { auth } from "./auth";
import { signInPath } from "./return-to";

/** The signed-in User, and whether they have verified their email. */
export interface SessionUser extends GroupUser {
  emailVerified: boolean;
}

/** The signed-in User, or `null`. Reads the request, so call it inside Suspense. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // Cookies as they stand now, not as the request sent them: a Server Action
  // that changes the password replaces the session cookie, then re-renders.
  const current = new Headers(await headers());
  current.set("cookie", (await cookies()).toString());
  const result = await auth().api.getSession({ headers: current });
  if (!result) return null;
  const { id, name, email, emailVerified } = result.user;
  return { id, name, email, emailVerified };
}

/** The signed-in User; otherwise redirects to sign-in and back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(returnTo));
  return user;
}
