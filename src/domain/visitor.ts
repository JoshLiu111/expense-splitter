import type { GroupSnapshot } from "./types";

/** Who is acting: a signed-in User, or a Guest (`userId` undefined). */
export interface Visitor {
  userId: string | undefined;
}

/**
 * The Group Creator is the User who created the Group. A Guest's session
 * Groups have no Group Creator User, so the Guest counts as theirs.
 */
export function isGroupCreator(group: { creatorUserId?: string }, visitor: Visitor): boolean {
  return group.creatorUserId === visitor.userId;
}

/**
 * "the Group Creator, Alex," (the closing comma ends the aside), or just
 * "the Group Creator" if no Member is theirs, for the reasons a visitor
 * who isn't the Group Creator is told.
 */
export function groupCreatorPhrase(group: Pick<GroupSnapshot, "creatorUserId" | "members">): string {
  const creator = group.members.find((m) => m.userId && m.userId === group.creatorUserId);
  return creator ? `the Group Creator, ${creator.name},` : "the Group Creator";
}
