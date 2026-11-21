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
      { label: "Alex Chen’s Share", before: "$281.40", after: "$140.70", money: true, memberId: "mem_alex" },
      { label: "Taylor Kim’s Share", before: "$0.00", after: "$140.70", money: true, memberId: "mem_taylor" },
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
      { label: "Alex Chen’s Share", before: "$210.00", after: "$140.70", money: true, memberId: "mem_alex" },
      { label: "Jordan Park’s Share", before: "$210.00", after: "$140.70", money: true, memberId: "mem_jordan" },
      { label: "Sam Rivera’s Share", before: "$210.00", after: "$140.70", money: true, memberId: "mem_sam" },
      { label: "Taylor Kim’s Share", before: "$210.00", after: "$140.70", money: true, memberId: "mem_taylor" },
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
      { label: "Alex Chen’s Ratio", before: "2", after: "4", memberId: "mem_alex" },
      { label: "Jordan Park’s Ratio", before: "2", after: "4", memberId: "mem_jordan" },
      { label: "Sam Rivera’s Ratio", before: "1", after: "2", memberId: "mem_sam" },
      { label: "Taylor Kim’s Ratio", before: "1", after: "2", memberId: "mem_taylor" },
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
      { label: "Mia Torres’s Percentage", before: "30%", after: "30.00%", memberId: "mem_mia" },
    ]);
  });

  it("tells apart the Share changes of Members with the same name by their Member", () => {
    const group = { ...japan, members: japan.members.map((m) => (m.id === "mem_jordan" ? { ...m, name: "Alex Chen" } : m)) };
    const before: Expense = { ...hotel, splitType: "exact", shares: [{ memberId: "mem_sam", amount: 84000 }] };

    const [item] = activityItems([edited(before, hotel)], group);

    expect(item.changes.filter((c) => c.label === "Alex Chen’s Share").map((c) => c.memberId)).toEqual([
      "mem_alex",
      "mem_jordan",
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

  it("gives the acting Member for their avatar, image included, and none for the Guest", () => {
    const before: Expense = { ...electricity, description: "Power" };
    const drewsImage = "https://blob.example/drew.webp";
    const group = {
      ...apartment,
      members: apartment.members.map((m) => (m.id === "mem_drew" ? { ...m, avatarUrl: drewsImage } : m)),
    };

    const items = activityItems(
      [edited(before, electricity, "mem_drew"), edited(before, electricity, "mem_riley"), edited(before, electricity)],
      group,
    );

    expect(items.map((i) => i.actorMember && [i.actorMember.name, i.actorMember.avatarUrl])).toEqual([
      ["Drew Patel", drewsImage],
      ["Riley Morgan", undefined],
      undefined,
    ]);
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
        actorMember: expect.objectContaining({ id: "mem_riley" }),
        kind: "expense-deleted",
        subject: { kind: "expense", id: "exp_102" },
        action: "deleted the Expense",
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
        actorMember: expect.objectContaining({ id: "mem_drew" }),
        kind: "settlement-deleted",
        subject: { kind: "settlement", id: "stl_101" },
        action: "deleted a Settlement:",
        title: "Casey Brooks paid Riley Morgan",
        details: [
          { label: "Amount", value: "$1,104.56", money: true },
          { label: "Date", value: "Jan 31, 2024" },
        ],
        changes: [],
      },
    ]);
  });

  it("shows each change to a Member as one sentence, under the name they had then", () => {
    const at = "2024-02-01T10:00:00.000Z";
    const drewThen = { id: "mem_drew", name: "Drew" };
    const entries: ActivityEntry[] = [
      { id: "act_6", at, actorMemberId: "mem_riley", change: { kind: "member-removed", member: drewThen } },
      { id: "act_5", at, actorMemberId: "mem_drew", change: { kind: "member-joined", member: drewThen } },
      { id: "act_4", at, actorMemberId: "mem_riley", change: { kind: "member-invited", member: drewThen, email: "drew@example.com", resent: true } },
      { id: "act_3", at, actorMemberId: "mem_riley", change: { kind: "member-invited", member: drewThen, email: "drew@example.com", resent: false } },
      { id: "act_2", at, actorMemberId: "mem_riley", change: { kind: "member-email-set", member: drewThen, email: "drew@example.com" } },
      { id: "act_1", at, change: { kind: "member-added", member: drewThen } },
    ];

    const items = activityItems(entries, apartment);

    const sentences = items.map((i) => [i.actor, i.action, i.title, i.rest].filter(Boolean).join(" "));
    expect(sentences).toEqual([
      "Riley Morgan removed Drew from the Group",
      "Drew Patel joined the Group",
      "Riley Morgan sent Drew a new Invitation at drew@example.com",
      "Riley Morgan sent Drew an Invitation at drew@example.com",
      "Riley Morgan gave Drew the email drew@example.com",
      "You added Drew to the Group",
    ]);
    for (const item of items) {
      expect(item).toMatchObject({ subject: { kind: "member", id: "mem_drew" }, details: [], changes: [] });
    }
  });

  it("shows each change to the Group, its Custom Categories and Editing Mode as one sentence, an edit's details before → after", () => {
    const at = "2024-02-01T10:00:00.000Z";
    const cleaning = { id: "cat_cleaning", name: "Cleaning" };
    const entries: ActivityEntry[] = [
      { id: "act_7", at, actorMemberId: "mem_riley", change: { kind: "editing-mode-changed", before: "open", after: "own-records-only" } },
      { id: "act_6", at, actorMemberId: "mem_riley", change: { kind: "currency-changed", from: "EUR", to: "USD", rate: "1.08" } },
      { id: "act_5", at, actorMemberId: "mem_casey", change: { kind: "category-deleted", category: { ...cleaning, name: "Cleaning supplies" } } },
      { id: "act_4", at, actorMemberId: "mem_casey", change: { kind: "category-renamed", before: cleaning, after: { ...cleaning, name: "Cleaning supplies" } } },
      { id: "act_3", at, change: { kind: "category-added", category: cleaning } },
      {
        id: "act_2",
        at,
        actorMemberId: "mem_drew",
        change: { kind: "group-details-edited", before: { name: "Apt 4B", description: "" }, after: { name: "Apartment 4B", description: "Bills" } },
      },
      {
        id: "act_1",
        at,
        actorMemberId: "mem_drew",
        change: { kind: "group-details-edited", before: { name: "Apt 4B", description: "Rent" }, after: { name: "Apt 4B", description: "" } },
      },
    ];

    const items = activityItems(entries, apartment);

    expect(items.map((i) => [i.actor, i.action, i.title, i.rest].filter(Boolean).join(" "))).toEqual([
      "Riley Morgan changed the Editing Mode from Open to Own Records Only",
      "Riley Morgan changed the Group Currency from EUR to USD at 1 EUR = 1.08 USD",
      "Casey Brooks deleted the Category Cleaning supplies",
      "Casey Brooks renamed the Category Cleaning to Cleaning supplies",
      "You added the Category Cleaning",
      "Drew Patel edited the Group’s details",
      "Drew Patel edited the Group’s details",
    ]);
    expect(items.map((i) => i.subject)).toEqual([
      ...Array(2).fill({ kind: "group", id: apartment.id }),
      ...Array(3).fill({ kind: "category", id: "cat_cleaning" }),
      ...Array(2).fill({ kind: "group", id: apartment.id }),
    ]);
    // Only what the edit changed; a cleared description reads as None.
    expect(items.map((i) => i.changes)).toEqual([
      ...Array(5).fill([]),
      [
        { label: "Name", before: "Apt 4B", after: "Apartment 4B" },
        { label: "Description", before: "None", after: "Bills" },
      ],
      [{ label: "Description", before: "Rent", after: "None" }],
    ]);
    expect(items.every((i) => i.details.length === 0)).toBe(true);
  });

  it("reads each entry in the Group Currency it was recorded in, older ones before a Group Currency change in the old one", () => {
    // Japan's Group Currency is now EUR; it was JPY, and USD before that.
    const euros = { ...japan, currency: "EUR" as const };
    const at = "2024-03-01T10:00:00.000Z";
    const repaid = { id: "stl_x", fromId: "mem_sam", toId: "mem_alex", amount: 1000, date: "2024-03-01", createdAt: at };
    const entries: ActivityEntry[] = [
      { id: "act_5", at, change: { kind: "settlement-added", settlement: { ...repaid, currency: "USD", lockedRate: "0.925" } } },
      { id: "act_4", at, change: { kind: "currency-changed", from: "JPY", to: "EUR", rate: "0.0062" } },
      { id: "act_3", at, change: { kind: "settlement-deleted", settlement: { ...repaid, currency: "USD", lockedRate: "150" } } },
      { id: "act_2", at, change: { kind: "currency-changed", from: "USD", to: "JPY", rate: "150" } },
      { id: "act_1", at, change: { kind: "settlement-added", settlement: { ...repaid, currency: "USD", lockedRate: "1" } } },
      { id: "act_0", at, change: { kind: "expense-edited", before: { ...hotel, lockedRate: "0.0068" }, after: hotel } },
    ];

    const items = activityItems(entries, euros);

    expect(items.map((i) => i.details.find((d) => d.label === "Amount")?.value)).toEqual([
      "$10.00 ≈ €9.25",
      undefined,
      "$10.00 ≈ ¥1,500",
      undefined,
      "$10.00",
      undefined,
    ]);
    expect(items[0].details.find((d) => d.label === "Locked Rate")).toEqual({ label: "Locked Rate", value: "0.925" });
    expect(items[4].details.find((d) => d.label === "Locked Rate")).toBeUndefined();
    // ¥21,000 each at 0.0068 then 0.0067 USD per yen.
    expect(items[5].changes).toContainEqual({
      label: "Alex Chen’s Share",
      before: "$142.80",
      after: "$140.70",
      money: true,
      memberId: "mem_alex",
    });
  });
});
