import type { GroupSnapshot } from "./types";
import { groupCreatorPhrase, isGroupCreator, type Visitor } from "./visitor";

/**
 * Who may edit or delete a Group's Expenses and Settlements, and manage the
 * Group. Open: any Member. Own Records Only: a record's Recorder and the
 * Group Creator; records with no Recorder, and managing the Group, the
 * Group Creator alone. Adding records is never restricted.
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

/** A change to an existing record that the Editing Mode may restrict. */
export type RecordAction = "edit-expense" | "delete-expense" | "delete-settlement";

const ACTION_WORDS: Record<RecordAction, { verb: string; record: string }> = {
  "edit-expense": { verb: "edit", record: "Expense" },
  "delete-expense": { verb: "delete", record: "Expense" },
  "delete-settlement": { verb: "delete", record: "Settlement" },
};

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

/**
 * A change to the Group itself, its Members or its Custom Categories that
 * the Editing Mode may restrict to the Group Creator.
 */
export type ManagementAction =
  | "edit-details"
  | "add-member"
  | "remove-member"
  | "set-member-email"
  | "resend-invitation"
  | "add-category"
  | "rename-category"
  | "delete-category";

// One phrase per Group settings section, so the reason a section shows
// reads right for every control it hides.
const MANAGEMENT_WORDS: Record<ManagementAction, string> = {
  "edit-details": "change the Group's details",
  "add-member": "add, remove or invite Members, or give them an email",
  "remove-member": "add, remove or invite Members, or give them an email",
  "set-member-email": "add, remove or invite Members, or give them an email",
  "resend-invitation": "add, remove or invite Members, or give them an email",
  "add-category": "add, rename or delete Categories",
  "rename-category": "add, rename or delete Categories",
  "delete-category": "add, rename or delete Categories",
};

/**
 * Why the visitor can't make `action`, or `null` if they can: in Own
 * Records Only, only the Group Creator manages the Group. The one rule
 * behind both the Group management and Custom Category use cases, which
 * re-check it against the Group as stored now, and the controls shown.
 */
export function groupManagementBlock(group: GroupSnapshot, visitor: Visitor, action: ManagementAction): string | null {
  if (editingModeOf(group) === "open" || isGroupCreator(group, visitor)) return null;
  return `This Group is set to Own Records Only: only ${groupCreatorPhrase(group)} can ${MANAGEMENT_WORDS[action]}.`;
}
