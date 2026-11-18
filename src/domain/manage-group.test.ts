import { describe, expect, it } from "vitest";
import type { Expense, GroupSnapshot, Member, Settlement } from "./types";
import {
  groupDeletionBlock,
  memberRemovalBlock,
  parseGroupDetails,
  parseNewMember,
} from "./manage-group";

const member = (id: string, extra: Partial<Member> = {}): Member => ({
  id,
  name: id,
  avatarColor: "#3B82F6",
  ...extra,
});

/** An Exact Expense paid by `payerId`, with the given Shares. */
const expense = (payerId: string, shares: [string, number][]): Expense => ({
  id: `exp_${payerId}_${shares.length}`,
  description: "Lunch",
  amount: shares.reduce((sum, [, amount]) => sum + amount, 0),
  currency: "USD",
  lockedRate: "1",
  payerId,
  splitType: "exact",
  shares: shares.map(([memberId, amount]) => ({ memberId, amount })),
  date: "2026-03-01",
  createdAt: "2026-03-01T12:00:00.000Z",
  category: "Food & Drink",
});

const settlement = (fromId: string, toId: string, amount: number): Settlement => ({
  id: `set_${fromId}_${toId}`,
  fromId,
  toId,
  amount,
  date: "2026-03-02",
  createdAt: "2026-03-02T12:00:00.000Z",
});

const group = (overrides: Partial<GroupSnapshot> = {}): GroupSnapshot => ({
  id: "grp_flat",
  name: "Flat",
  description: "",
  currency: "USD",
  members: [member("mem_ana"), member("mem_ben")],
  expenses: [],
  settlements: [],
  ...overrides,
});

describe("parseGroupDetails", () => {
  it("changes the name, description and Group Currency of a Group with no Expenses or Settlements", () => {
    expect(
      parseGroupDetails({ name: " Flat 3B ", description: " Rent ", currency: "EUR" }, group()),
    ).toEqual({ ok: true, value: { name: "Flat 3B", description: "Rent", currency: "EUR" } });
  });

  it("refuses to change the Group Currency once the Group has an Expense, saying why", () => {
    const withExpense = group({ expenses: [expense("mem_ana", [["mem_ben", 500]])] });

    expect(
      parseGroupDetails({ name: "Flat", description: "", currency: "EUR" }, withExpense),
    ).toEqual({
      ok: false,
      errors: {
        currency:
          "The Group Currency can't change once the Group has Expenses or Settlements.",
      },
    });
  });

  it("refuses to change the Group Currency once the Group has a Settlement", () => {
    const withSettlement = group({ settlements: [settlement("mem_ana", "mem_ben", 500)] });

    expect(
      parseGroupDetails({ name: "Flat", description: "", currency: "GBP" }, withSettlement).ok,
    ).toBe(false);
  });

  it("still edits the name of a Group with Expenses when the Group Currency is unchanged", () => {
    const withExpense = group({ expenses: [expense("mem_ana", [["mem_ben", 500]])] });

    expect(
      parseGroupDetails({ name: "Flat 4C", description: "", currency: "USD" }, withExpense),
    ).toEqual({ ok: true, value: { name: "Flat 4C", description: "", currency: "USD" } });
  });

  it("reports name problems the same way as creating a Group", () => {
    expect(parseGroupDetails({ name: " ", description: "", currency: "USD" }, group())).toEqual({
      ok: false,
      errors: { name: "Enter a name for the Group." },
    });
  });
});

describe("parseNewMember", () => {
  it("accepts a trimmed name for a Name-only Member", () => {
    expect(parseNewMember("  Chloe Park ", group())).toEqual({ ok: true, value: { name: "Chloe Park" } });
  });

  it("rejects a blank or overlong name", () => {
    expect(parseNewMember("  ", group())).toEqual({ ok: false, error: "Enter the Member's name." });
    expect(parseNewMember("x".repeat(61), group())).toEqual({
      ok: false,
      error: "Keep the name to 60 characters or fewer.",
    });
  });

  it("rejects a name a current Member already has, ignoring case", () => {
    const flat = group({ members: [member("mem_ana", { name: "Ana Silva" })] });
    expect(parseNewMember("ana silva", flat)).toEqual({
      ok: false,
      error: "Ana Silva is already a Member of this Group.",
    });
  });

  it("allows the name of a Former Member, who is no longer in the Group", () => {
    const flat = group({ members: [member("mem_ana", { name: "Ana Silva", former: true })] });
    expect(parseNewMember("Ana Silva", flat).ok).toBe(true);
  });
});

describe("memberRemovalBlock", () => {
  it("lets a Member with a zero Balance be removed", () => {
    const settled = group({
      members: [member("mem_ana"), member("mem_ben"), member("mem_cat")],
      expenses: [expense("mem_ana", [["mem_ben", 500]])],
    });
    expect(memberRemovalBlock(settled, "mem_cat")).toBeNull();
  });

  it("keeps a Member who is owed or owes money, saying why", () => {
    const owing = group({
      members: [member("mem_ana", { name: "Ana Silva" }), member("mem_ben", { name: "Ben Ito" })],
      expenses: [expense("mem_ana", [["mem_ben", 500]])],
    });
    expect(memberRemovalBlock(owing, "mem_ana")).toBe(
      "Ana Silva can't be removed until their Balance is zero.",
    );
    expect(memberRemovalBlock(owing, "mem_ben")).toBe(
      "Ben Ito can't be removed until their Balance is zero.",
    );
  });

  it("lets a Member be removed once a Settlement brings their Balance to zero", () => {
    const settled = group({
      expenses: [expense("mem_ana", [["mem_ben", 500]])],
      settlements: [settlement("mem_ben", "mem_ana", 500)],
    });
    expect(memberRemovalBlock(settled, "mem_ben")).toBeNull();
  });

  it("keeps the Group's last current Member", () => {
    const flat = group({ members: [member("mem_ana"), member("mem_ben", { former: true })] });
    expect(memberRemovalBlock(flat, "mem_ana")).toBe("A Group needs at least one Member.");
  });

  it("keeps the Group Creator, who alone can delete the Group", () => {
    const flat = group({
      creatorUserId: "usr_ana",
      members: [member("mem_ana", { name: "Ana", userId: "usr_ana" }), member("mem_ben")],
    });
    expect(memberRemovalBlock(flat, "mem_ana")).toBe("Ana is the Group Creator and can't be removed.");
  });

  it("refuses Former Members and Members of other Groups", () => {
    const flat = group({ members: [member("mem_ana"), member("mem_ben", { name: "Ben", former: true })] });
    expect(memberRemovalBlock(flat, "mem_ben")).toBe("Ben has already been removed.");
    expect(memberRemovalBlock(flat, "mem_zed")).toBe("That Member isn't in this Group.");
  });
});

describe("groupDeletionBlock", () => {
  const maya = member("mem_maya", { name: "Maya Lee", userId: "usr_maya" });
  const owned = (overrides: Partial<GroupSnapshot> = {}) =>
    group({ creatorUserId: "usr_maya", members: [maya, member("mem_ben")], ...overrides });

  it("lets the Group Creator delete a Settled Up Group", () => {
    const settled = owned({
      expenses: [expense("mem_maya", [["mem_ben", 500]])],
      settlements: [settlement("mem_ben", "mem_maya", 500)],
    });
    expect(groupDeletionBlock(settled, { isCreator: true })).toBeNull();
  });

  it("names the Group Creator to anyone else", () => {
    expect(groupDeletionBlock(owned(), { isCreator: false })).toBe(
      "Only the Group Creator, Maya Lee, can delete this Group.",
    );
  });

  it("keeps a Group that isn't Settled Up, even for its Group Creator", () => {
    const owing = owned({ expenses: [expense("mem_maya", [["mem_ben", 500]])] });
    expect(groupDeletionBlock(owing, { isCreator: true })).toBe(
      "Everyone must be Settled Up before this Group can be deleted.",
    );
  });
});
