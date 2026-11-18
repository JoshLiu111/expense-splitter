import "server-only";
import { db } from "@/db";
import {
  claimPendingMembers,
  createPostgresGroupRepository,
  type GroupUser,
} from "./postgres-group-repository";

/** The signed-in User's Groups. */
export function userGroupRepository(user: GroupUser) {
  return createPostgresGroupRepository(db(), user);
}

/**
 * Links a User to Pending Members with their email, once it is verified
 * (ADR 0005); does nothing before then.
 */
export async function claimUserPendingMembers(user: GroupUser & { emailVerified: boolean }) {
  if (user.emailVerified) await claimPendingMembers(db(), user);
}
