import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { importSampleGroups, isSameExpense } from "@/domain";
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
      }
    }
    const times = entries.map((e) => e.at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("seeds each sample Group with the day its Activity started", () => {
    const seeded = seedGuestSession(groups);
    expect(seeded.groups.find((g) => g.id === "grp_apt_4b")?.activityStartedOn).toBe("2024-01-13");
    expect(seeded.activity.grp_apt_4b.map((e) => e.id)).toEqual(["act_apt_2", "act_apt_1"]);
  });
});
