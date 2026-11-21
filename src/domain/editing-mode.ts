import type { GroupSnapshot } from "./types";

/**
 * Who may edit or delete a Group's Expenses and Settlements. Open: any
 * Member. Own Records Only: their Recorder and the Group Creator; records
 * with no Recorder, the Group Creator alone. Adding is never restricted.
 */
export type EditingMode = "open" | "own-records-only";

export const EDITING_MODES: readonly EditingMode[] = ["open", "own-records-only"];

export const EDITING_MODE_LABELS: Record<EditingMode, string> = {
  open: "Open",
  "own-records-only": "Own Records Only",
};

export const isEditingMode = (value: unknown): value is EditingMode =>
  EDITING_MODES.includes(value as EditingMode);

/** A Group's Editing Mode; a Group without one is Open. */
export const editingModeOf = (group: Pick<GroupSnapshot, "editingMode">): EditingMode =>
  group.editingMode ?? "open";

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

/** A change to an existing record that the Editing Mode may restrict. */
export type RecordAction = "edit-expense" | "delete-expense" | "delete-settlement";

const ACTION_WORDS: Record<RecordAction, { verb: string; record: string }> = {
  "edit-expense": { verb: "edit", record: "Expense" },
  "delete-expense": { verb: "delete", record: "Expense" },
  "delete-settlement": { verb: "delete", record: "Settlement" },
};

/**
 * "the Group Creator, Alex," (the closing comma ends the aside), or just
 * "the Group Creator" if no Member is theirs.
 */
function groupCreatorPhrase(group: GroupSnapshot): string {
  const creator = group.members.find((m) => m.userId && m.userId === group.creatorUserId);
  return creator ? `the Group Creator, ${creator.name},` : "the Group Creator";
}

/**
 * Why the visitor can't make `action` on a record with `target`'s Recorder,
 * or `null` if they can. The one rule behind both the use cases, which
 * re-check it against the Group as stored now, and the controls shown.
 */
export function recordChangeBlock(
  group: GroupSnapshot,
  visitor: Visitor,
  action: RecordAction,
  target: { recorderId?: string },
): string | null {
  if (editingModeOf(group) === "open" || isGroupCreator(group, visitor)) return null;
  const own = group.members.find((m) => m.userId && m.userId === visitor.userId);
  if (own && target.recorderId === own.id) return null;

  const { verb, record } = ACTION_WORDS[action];
  const creator = groupCreatorPhrase(group);
  const recorder = target.recorderId && group.members.find((m) => m.id === target.recorderId);
  if (!recorder)
    return `This Group is set to Own Records Only, and no one is known to have recorded this ${record}: only ${creator} can ${verb} it.`;
  if (recorder.userId && recorder.userId === group.creatorUserId)
    return `This Group is set to Own Records Only: only the Group Creator, ${recorder.name}, who recorded this ${record}, can ${verb} it.`;
  return `This Group is set to Own Records Only: only ${recorder.name}, who recorded this ${record}, or ${creator} can ${verb} it.`;
}

/** Why the visitor can't change the Group's Editing Mode, or `null` if they can. */
export function editingModeBlock(group: GroupSnapshot, visitor: Visitor): string | null {
  if (isGroupCreator(group, visitor)) return null;
  return `Only ${groupCreatorPhrase(group)} can change the Editing Mode.`;
}
