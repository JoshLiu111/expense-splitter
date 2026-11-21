import { describe, expect, it } from "vitest";
import type { GroupSnapshot, Member } from "./types";
import { editingModeBlock, recordChangeBlock, type EditingMode, type RecordAction } from "./editing-mode";

const member = (id: string, name: string, userId?: string): Member => ({
  id,
  name,
  avatarColor: "#3B82F6",
  ...(userId ? { userId } : {}),
});

/** Alex created the Group; Sam and Jo are Linked Members; Pat is Name-only. */
const usersGroup = (editingMode?: EditingMode): GroupSnapshot => ({
  id: "grp_1",
  name: "Flat",
  description: "",
  currency: "USD",
  creatorUserId: "user_alex",
  members: [
    member("mem_alex", "Alex", "user_alex"),
    member("mem_sam", "Sam", "user_sam"),
    member("mem_jo", "Jo", "user_jo"),
    member("mem_pat", "Pat"),
  ],
  expenses: [],
  settlements: [],
  ...(editingMode ? { editingMode } : {}),
});

/** A Guest's session Group: no Group Creator User. */
const guestGroup = (editingMode?: EditingMode): GroupSnapshot => ({
  ...usersGroup(editingMode),
  creatorUserId: undefined,
  members: [member("mem_you", "You"), member("mem_pat", "Pat")],
});

const creator = { userId: "user_alex" };
const sam = { userId: "user_sam" };
const jo = { userId: "user_jo" };
const guest = { userId: undefined };

const ACTIONS: RecordAction[] = ["edit-expense", "delete-expense", "delete-settlement"];

describe("recordChangeBlock", () => {
  // Sam recorded the record unless the row says otherwise.
  it.each([
    // mode, visitor, recorder, allowed
    ["open", "Creator", creator, "mem_sam", true],
    ["open", "Recorder", sam, "mem_sam", true],
    ["open", "other Member", jo, "mem_sam", true],
    ["open", "other Member, no Recorder", jo, undefined, true],
    ["own-records-only", "Creator", creator, "mem_sam", true],
    ["own-records-only", "Creator, no Recorder", creator, undefined, true],
    ["own-records-only", "Recorder", sam, "mem_sam", true],
    ["own-records-only", "other Member", jo, "mem_sam", false],
    ["own-records-only", "other Member, no Recorder", jo, undefined, false],
    ["own-records-only", "Recorder of another's record", sam, "mem_jo", false],
  ] as const)("%s, %s: allowed %s", (mode, _who, visitor, recorderId, allowed) => {
    for (const action of ACTIONS) {
      const block = recordChangeBlock(usersGroup(mode), visitor, action, { recorderId });
      expect(block === null, action).toBe(allowed);
    }
  });

  it.each([
    ["open", "mem_pat"],
    ["open", undefined],
    ["own-records-only", "mem_pat"],
    ["own-records-only", undefined],
  ] as const)("lets the Guest, as Group Creator, change anything (%s, Recorder %s)", (mode, recorderId) => {
    for (const action of ACTIONS) {
      expect(recordChangeBlock(guestGroup(mode), guest, action, { recorderId }), action).toBeNull();
    }
  });

  it("treats a Group with no Editing Mode as Open", () => {
    expect(recordChangeBlock(usersGroup(), jo, "edit-expense", { recorderId: "mem_sam" })).toBeNull();
  });

  it("names who can make the change instead", () => {
    const group = usersGroup("own-records-only");
    expect(recordChangeBlock(group, jo, "edit-expense", { recorderId: "mem_sam" })).toBe(
      "This Group is set to Own Records Only: only Sam, who recorded this Expense, or the Group Creator, Alex, can edit it.",
    );
    expect(recordChangeBlock(group, jo, "delete-expense", { recorderId: "mem_sam" })).toBe(
      "This Group is set to Own Records Only: only Sam, who recorded this Expense, or the Group Creator, Alex, can delete it.",
    );
    expect(recordChangeBlock(group, jo, "delete-settlement", { recorderId: "mem_sam" })).toBe(
      "This Group is set to Own Records Only: only Sam, who recorded this Settlement, or the Group Creator, Alex, can delete it.",
    );
    expect(recordChangeBlock(group, jo, "edit-expense", { recorderId: undefined })).toBe(
      "This Group is set to Own Records Only, and no one is known to have recorded this Expense: only the Group Creator, Alex, can edit it.",
    );
    expect(recordChangeBlock(group, jo, "delete-expense", { recorderId: "mem_alex" })).toBe(
      "This Group is set to Own Records Only: only the Group Creator, Alex, who recorded this Expense, can delete it.",
    );
  });

  it("leaves out a Group Creator who has left", () => {
    const group = { ...usersGroup("own-records-only"), creatorUserId: undefined };
    expect(recordChangeBlock(group, jo, "delete-settlement", { recorderId: undefined })).toBe(
      "This Group is set to Own Records Only, and no one is known to have recorded this Settlement: only the Group Creator can delete it.",
    );
  });
});

describe("editingModeBlock", () => {
  it("lets only the Group Creator change the Editing Mode", () => {
    expect(editingModeBlock(usersGroup(), creator)).toBeNull();
    expect(editingModeBlock(guestGroup(), guest)).toBeNull();
    expect(editingModeBlock(usersGroup(), sam)).toBe("Only the Group Creator, Alex, can change the Editing Mode.");
  });
});
