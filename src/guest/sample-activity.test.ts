import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { importSampleGroups, isSameExpense, type CustomCategory } from "@/domain";
import { SAMPLE_ACTIVITY, seedGuestSession } from "./sample-activity";

const groups = importSampleGroups(sampleData);

describe("the sample Groups' Activity", () => {
  it.each(groups.map((g) => [g.name, g] as const))("%s has an edit and a deletion", (_, group) => {
    const kinds = SAMPLE_ACTIVITY[group.id]?.entries.map((e) => e.change.kind);
    expect(kinds).toContain("expense-edited");
    expect(kinds).toContain("expense-deleted");
  });

  it.each(groups.map((g) => [g.name, g] as const))("%s's entries agree with its seed data", (_, group) => {
    const { startedOn, entries } = SAMPLE_ACTIVITY[group.id];
    const memberIds = group.members.map((m) => m.id);
    // The Custom Categories as Activity leaves them, from none before it started.
    let categories: CustomCategory[] = [];
    for (const entry of [...entries].reverse()) {
      const { change } = entry;
      if (change.kind === "category-added") {
        expect(categories.map((c) => c.id)).not.toContain(change.category.id);
        categories = [...categories, change.category];
      } else if (change.kind === "category-renamed") {
        expect(categories).toContainEqual(change.before);
        expect(change.after.name).not.toBe(change.before.name);
        categories = categories.map((c) => (c.id === change.before.id ? change.after : c));
      } else if (change.kind === "category-deleted") {
        expect(categories).toContainEqual(change.category);
        categories = categories.filter((c) => c.id !== change.category.id);
      }
    }
    expect(categories).toEqual(group.customCategories ?? []);
    const detailsEdits = entries.flatMap((e) => (e.change.kind === "group-details-edited" ? [e.change] : []));
    if (detailsEdits.length > 0) {
      // The newest edit left the Group as the seed data has it now.
      expect(detailsEdits[0].after).toEqual({ name: group.name, description: group.description });
    }
    for (const entry of entries) {
      expect(memberIds).toContain(entry.actorMemberId);
      expect(entry.at.slice(0, 10) >= startedOn).toBe(true);
      const { change } = entry;
      switch (change.kind) {
        case "expense-edited":
          // The edit left the Expense as the seed data has it now.
          expect(change.after).toEqual(group.expenses.find((e) => e.id === change.after.id));
          expect(isSameExpense(change.before, change.after)).toBe(false);
          break;
        case "expense-added":
          expect(change.expense).toEqual(group.expenses.find((e) => e.id === change.expense.id));
          break;
        case "expense-deleted":
          expect(group.expenses.map((e) => e.id)).not.toContain(change.expense.id);
          break;
        case "settlement-added":
          expect(change.settlement).toEqual(group.settlements.find((s) => s.id === change.settlement.id));
          break;
        case "settlement-deleted":
          expect(group.settlements.map((s) => s.id)).not.toContain(change.settlement.id);
          break;
        case "member-added":
        case "member-email-set":
        case "member-removed": {
          const member = group.members.find((m) => m.id === change.member.id);
          expect(member?.name).toBe(change.member.name);
          if (change.kind === "member-email-set") expect(member?.email).toBe(change.email);
          expect(member?.former ?? false).toBe(change.kind === "member-removed");
          break;
        }
        case "group-details-edited":
          expect(change.after).not.toEqual(change.before);
          break;
        // Checked above, in order.
        case "category-added":
        case "category-renamed":
        case "category-deleted":
          break;
        // The sample Groups' Members have no Users, so none is sent an
        // Invitation or joins; nor is any the Group Creator, who alone
        // changes the Group Currency or Editing Mode.
        case "member-invited":
        case "member-joined":
        case "currency-changed":
        case "editing-mode-changed":
          expect.unreachable(`${change.kind} in a sample Group`);
      }
    }
    const times = entries.map((e) => e.at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("includes a change to a Member, to a Group's details and to each kind of Custom Category change", () => {
    const kinds = Object.values(SAMPLE_ACTIVITY).flatMap((a) => a.entries.map((e) => e.change.kind));
    expect(kinds).toEqual(
      expect.arrayContaining(["member-email-set", "group-details-edited", "category-added", "category-renamed", "category-deleted"]),
    );
  });

  it("seeds each sample Group with the day its Activity started", () => {
    const seeded = seedGuestSession(groups);
    expect(seeded.groups.find((g) => g.id === "grp_apt_4b")?.activityStartedOn).toBe("2024-01-13");
    expect(seeded.activity.grp_apt_4b.map((e) => e.id)).toEqual(["act_apt_2", "act_apt_1"]);
  });
});
