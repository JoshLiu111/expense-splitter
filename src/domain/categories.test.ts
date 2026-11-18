import { describe, expect, it } from "vitest";
import {
  categoryDeletionBlock,
  categoryName,
  categoryOptions,
  parseCategoryName,
  parseNewExpense,
  type Expense,
  type GroupSnapshot,
  type NewExpenseFields,
} from "./index";

const expense = (category: string): Expense => ({
  id: `exp_${category}`,
  description: "Sponges",
  amount: 600,
  currency: "USD",
  lockedRate: "1",
  payerId: "mem_ana",
  splitType: "equal",
  shares: [{ memberId: "mem_ana", amount: 600 }],
  date: "2026-03-01",
  createdAt: "2026-03-01T12:00:00.000Z",
  category,
});

const flat = (overrides: Partial<GroupSnapshot> = {}): GroupSnapshot => ({
  id: "grp_flat",
  name: "Flat",
  description: "",
  currency: "USD",
  members: [{ id: "mem_ana", name: "Ana", avatarColor: "#3B82F6" }],
  customCategories: [{ id: "cat_cleaning", name: "Cleaning supplies" }],
  expenses: [],
  settlements: [],
  ...overrides,
});

const trip: GroupSnapshot = { ...flat(), id: "grp_trip", customCategories: [] };

const fields = (category: string): NewExpenseFields => ({
  amount: "6",
  currency: "USD",
  rate: "",
  description: "Sponges",
  date: "2026-03-01",
  category,
  payerId: "mem_ana",
  participantIds: ["mem_ana"],
  notes: "",
  splitType: "equal",
  splitValues: {},
});

describe("Custom Categories", () => {
  it("are offered after the nine predefined Categories, only in their own Group", () => {
    const options = categoryOptions(flat());
    expect(options).toHaveLength(10);
    expect(options.slice(0, 9).map((o) => o.name)).toEqual([
      "Food & Drink",
      "Transport",
      "Accommodation",
      "Housing",
      "Entertainment",
      "Shopping",
      "Utilities",
      "Groceries",
      "Other",
    ]);
    expect(options[9]).toEqual({ id: "cat_cleaning", name: "Cleaning supplies", custom: true });
    expect(categoryOptions(trip).map((o) => o.name)).not.toContain("Cleaning supplies");
  });

  it("can be chosen for an Expense in their Group but not in another", () => {
    const parsed = parseNewExpense(fields("cat_cleaning"), flat());
    expect(parsed.ok && parsed.value.category).toBe("cat_cleaning");
    expect(parseNewExpense(fields("cat_cleaning"), trip)).toMatchObject({
      ok: false,
      errors: { category: "Choose one of the Categories." },
    });
  });

  it("show their current name on Expenses, so a rename applies everywhere", () => {
    const renamed = flat({ customCategories: [{ id: "cat_cleaning", name: "Cleaning" }] });
    expect(categoryName(renamed, "cat_cleaning")).toBe("Cleaning");
    expect(categoryName(renamed, "Transport")).toBe("Transport");
  });

  it("need a name that no other Category in the Group has", () => {
    expect(parseCategoryName("  Pets ", flat())).toEqual({ ok: true, value: "Pets" });
    expect(parseCategoryName(" ", flat())).toEqual({ ok: false, error: "Enter the Category's name." });
    expect(parseCategoryName("transport", flat())).toEqual({
      ok: false,
      error: "Transport is already a Category.",
    });
    expect(parseCategoryName("cleaning SUPPLIES", flat())).toEqual({
      ok: false,
      error: "Cleaning supplies is already a Category.",
    });
    expect(parseCategoryName("x".repeat(41), flat())).toEqual({
      ok: false,
      error: "Keep the name to 40 characters or fewer.",
    });
  });

  it("can be renamed, including to a different capitalisation of their own name", () => {
    expect(parseCategoryName("Cleaning Supplies", flat(), "cat_cleaning")).toEqual({
      ok: true,
      value: "Cleaning Supplies",
    });
  });

  it("can be deleted only when no Expense uses them", () => {
    expect(categoryDeletionBlock(flat(), "cat_cleaning")).toBeNull();
    expect(
      categoryDeletionBlock(flat({ expenses: [expense("cat_cleaning"), expense("cat_cleaning")] }), "cat_cleaning"),
    ).toBe("2 Expenses use Cleaning supplies. Move them to another Category first.");
    expect(categoryDeletionBlock(flat({ expenses: [expense("cat_cleaning")] }), "cat_cleaning")).toBe(
      "1 Expense uses Cleaning supplies. Move it to another Category first.",
    );
  });
});
