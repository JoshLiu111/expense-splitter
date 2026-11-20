import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { importSampleGroups, type ActivityEntry, type Expense } from "@/domain";
import { activityItems } from "./activity-view";

const apartment = importSampleGroups(sampleData).find((g) => g.id === "grp_apt_4b")!;
const japan = importSampleGroups(sampleData).find((g) => g.id === "grp_japan_2024")!;
const hotel = japan.expenses.find((e) => e.id === "exp_001")!;
const electricity = apartment.expenses.find((e) => e.id === "exp_102")!;

function edited(before: Expense, after: Expense, actorMemberId?: string): ActivityEntry {
  return {
    id: "act_1",
    at: "2024-02-01T10:00:00.000Z",
    ...(actorMemberId ? { actorMemberId } : {}),
    change: { kind: "expense-edited", before, after },
  };
}

describe("activityItems", () => {
  it("lists only the fields an edit changed, before → after", () => {
    const before: Expense = { ...electricity, description: "Jan electricity", date: "2024-01-04" };

    const [item] = activityItems([edited(before, electricity, "mem_casey")], apartment);

    expect(item).toMatchObject({ actor: "Casey Brooks", kind: "expense-edited", title: "January electricity" });
    expect(item.changes).toEqual([
      { label: "Description", before: "Jan electricity", after: "January electricity" },
      { label: "Date", before: "Jan 4, 2024", after: "Jan 5, 2024" },
    ]);
  });

  it("lists Share changes per Member in Group Currency, only for Members whose Share changed", () => {
    // ¥84,000 at 0.0067 USD per yen: ¥42,000 is $281.40, ¥21,000 is $140.70.
    const before: Expense = {
      ...hotel,
      splitType: "exact",
      shares: [
        { memberId: "mem_alex", amount: 42000 },
        { memberId: "mem_jordan", amount: 21000 },
        { memberId: "mem_sam", amount: 21000 },
      ],
    };

    const [item] = activityItems([edited(before, hotel, "mem_alex")], japan);

    expect(item.changes).toEqual([
      { label: "Split Type", before: "Exact", after: "Equal" },
      { label: "Alex Chen’s Share", before: "$281.40", after: "$140.70", money: true },
      { label: "Taylor Kim’s Share", before: "$0.00", after: "$140.70", money: true },
    ]);
  });

  it("shows the other fields an edit changed: amount in its own currency, Locked Rate, Payer, Category and notes", () => {
    const group = { ...japan, customCategories: [{ id: "cat_onsen", name: "Onsen" }] };
    const before: Expense = { ...hotel, amount: 84000, currency: "USD", lockedRate: "1", payerId: "mem_sam", category: "cat_onsen", notes: "Deposit" };
    const after: Expense = { ...hotel, notes: undefined, shares: before.shares };

    const [item] = activityItems([edited({ ...before, shares: hotel.shares }, after)], group);

    expect(item.changes).toEqual([
      { label: "Amount", before: "$840.00", after: "¥84,000", money: true },
      { label: "Locked Rate", before: "1", after: "0.0067" },
      { label: "Payer", before: "Sam Rivera", after: "Alex Chen" },
      { label: "Category", before: "Onsen", after: "Accommodation" },
      { label: "Notes", before: "Deposit", after: "None" },
      // ¥21,000 each at the new rate, against 21,000 cents each before.
      { label: "Alex Chen’s Share", before: "$210.00", after: "$140.70", money: true },
      { label: "Jordan Park’s Share", before: "$210.00", after: "$140.70", money: true },
      { label: "Sam Rivera’s Share", before: "$210.00", after: "$140.70", money: true },
      { label: "Taylor Kim’s Share", before: "$210.00", after: "$140.70", money: true },
    ]);
  });

  it("lists the ratios an edit changed, even when no Share moved", () => {
    // 2:2:1:1 to 4:4:2:2 splits ¥42,600 exactly the same way.
    const izakaya = japan.expenses.find((e) => e.id === "exp_012")!;
    const doubled: Expense = {
      ...izakaya,
      shares: izakaya.shares.map((s) => ({ ...s, ratio: String(Number(s.ratio) * 2) })),
    };

    const [item] = activityItems([edited(izakaya, doubled, "mem_alex")], japan);

    expect(item.changes).toEqual([
      { label: "Alex Chen’s Ratio", before: "2", after: "4" },
      { label: "Jordan Park’s Ratio", before: "2", after: "4" },
      { label: "Sam Rivera’s Ratio", before: "1", after: "2" },
      { label: "Taylor Kim’s Ratio", before: "1", after: "2" },
    ]);
  });

  it("lists percentages an edit changed, and a Locked Rate typed by hand", () => {
    const group = importSampleGroups(sampleData).find((g) => g.expenses.some((e) => e.id === "exp_207"))!;
    const sushi = group.expenses.find((e) => e.id === "exp_207")!;
    const typed: Expense = {
      ...sushi,
      manualRate: true,
      shares: sushi.shares.map((s) => (s.memberId === "mem_mia" ? { ...s, percentage: "30.00" } : s)),
    };

    const [item] = activityItems([edited(sushi, typed)], group);

    expect(item.changes).toEqual([
      { label: "Locked Rate", before: "1", after: "1 (manual)" },
      { label: "Mia Torres’s Percentage", before: "30%", after: "30.00%" },
    ]);
  });

  it("names the acting Member, labelled once they're a Former Member, and the Guest as You", () => {
    const before: Expense = { ...electricity, description: "Power" };
    const group = {
      ...apartment,
      members: apartment.members.map((m) => (m.id === "mem_drew" ? { ...m, former: true } : m)),
    };

    const items = activityItems(
      [edited(before, electricity, "mem_drew"), edited(before, electricity, "mem_riley"), edited(before, electricity)],
      group,
    );

    expect(items.map((i) => i.actor)).toEqual(["Drew Patel (Former Member)", "Riley Morgan", "You"]);
  });

  it("shows a deleted Expense's description, amount, Payer and date, and a deleted Settlement's Members, amount and date", () => {
    const settlement = apartment.settlements.find((s) => s.id === "stl_101")!;
    const entries: ActivityEntry[] = [
      { id: "act_2", at: "2024-02-02T10:00:00.000Z", actorMemberId: "mem_riley", change: { kind: "expense-deleted", expense: electricity } },
      { id: "act_1", at: "2024-02-01T10:00:00.000Z", actorMemberId: "mem_drew", change: { kind: "settlement-deleted", settlement } },
    ];

    expect(activityItems(entries, apartment)).toEqual([
      {
        id: "act_2",
        at: "2024-02-02T10:00:00.000Z",
        actor: "Riley Morgan",
        kind: "expense-deleted",
        subject: { kind: "expense", id: "exp_102" },
        title: "January electricity",
        details: [
          { label: "Amount", value: "$142.37", money: true },
          { label: "Payer", value: "Casey Brooks" },
          { label: "Date", value: "Jan 5, 2024" },
        ],
        changes: [],
      },
      {
        id: "act_1",
        at: "2024-02-01T10:00:00.000Z",
        actor: "Drew Patel",
        kind: "settlement-deleted",
        subject: { kind: "settlement", id: "stl_101" },
        title: "Casey Brooks paid Riley Morgan",
        details: [
          { label: "Amount", value: "$1,104.56", money: true },
          { label: "Date", value: "Jan 31, 2024" },
        ],
        changes: [],
      },
    ]);
  });
});
