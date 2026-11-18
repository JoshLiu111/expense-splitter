import "server-only";
import { db } from "@/db";
import { createPostgresGroupRepository, type GroupUser } from "./postgres-group-repository";

/** The signed-in User's Groups. */
export function userGroupRepository(user: GroupUser) {
  return createPostgresGroupRepository(db(), user);
}
