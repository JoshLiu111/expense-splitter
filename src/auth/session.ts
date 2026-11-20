import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { GroupUser } from "@/groups/postgres-group-repository";
import { auth } from "./auth";
import { signInPath } from "./return-to";

/** The signed-in User, and whether they have verified their email. */
export interface SessionUser extends GroupUser {
  emailVerified: boolean;
  /** The URL of the User's avatar image, if they have one. */
  image?: string;
}

/** The signed-in User, or `null`. Reads the request, so call it inside Suspense. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const result = await auth().api.getSession({ headers: await headers() });
  if (!result) return null;
  const { id, name, email, emailVerified, image } = result.user;
  return { id, name, email, emailVerified, ...(image ? { image } : {}) };
}

/** The signed-in User; otherwise redirects to sign-in and back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(returnTo));
  return user;
}
