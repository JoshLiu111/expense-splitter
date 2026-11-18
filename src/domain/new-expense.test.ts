import { describe, expect, it } from "vitest";
import { amountText, CATEGORIES, parseAmount, parseNewExpense, type GroupSnapshot, type NewExpenseFields } from "./index";

const group: GroupSnapshot = {
  id: "grp_flat",
  name: "Flat",
  description: "",
  currency: "USD",
  members: ["alex", "jordan", "sam", "taylor"].map((name) => ({
    id: `mem_${name}`,
    name,
    avatarColor: "#3B82F6",
  })),
  expenses: [],
  settlements: [],
};

const fields = (overrides: Partial<NewExpenseFields> = {}): NewExpenseFields => ({
  amount: "60",
  description: "Pizza",
  date: "2026-01-01",
  category: "Food & Drink",
  payerId: "mem_alex",
  participantIds: ["mem_alex", "mem_jordan", "mem_sam"],
  notes: "",
  splitType: "equal",
  splitValues: {},
  ...overrides,
});

describe("parseNewExpense", () => {
  it("turns the form into an Equal Expense in the Group Currency", () => {
    expect(parseNewExpense(fields(), group)).toEqual({
      ok: true,
      value: {
        description: "Pizza",
        amount: 6000,
        currency: "USD",
        lockedRate: "1",
        payerId: "mem_alex",
        splitType: "equal",
        shares: [
          { memberId: "mem_alex", amount: 2000 },
          { memberId: "mem_jordan", amount: 2000 },
          { memberId: "mem_sam", amount: 2000 },
        ],
        date: "2026-01-01",
        category: "Food & Drink",
      },
    });
  });

  it.each([
    ["", "Enter an amount."],
    ["abc", "Enter the amount as a number, like 12.50."],
    ["0", "Enter an amount greater than zero."],
    ["-5", "Enter an amount greater than zero."],
    ["12.345", "USD amounts can have at most 2 decimal places."],
    ["10000000000", "Enter an amount under $10,000,000,000.00."],
  ])("rejects the amount %j", (amount, message) => {
    expect(parseNewExpense(fields({ amount }), group)).toEqual({
      ok: false,
      errors: { amount: message },
    });
  });

  it("accepts thousands separators and reads the amount in exact minor units", () => {
    const result = parseNewExpense(fields({ amount: " 1,234.56 ", participantIds: ["mem_alex"] }), group);
    expect(result.ok && result.value.amount).toBe(123456);
    // 0.29 * 100 is 28.999… in floating point
    const cents = parseNewExpense(fields({ amount: "0.29", participantIds: ["mem_alex"] }), group);
    expect(cents.ok && cents.value.amount).toBe(29);
  });

  it("takes JPY amounts in whole yen", () => {
    const yenGroup = { ...group, currency: "JPY" as const };
    expect(parseNewExpense(fields({ amount: "1000.5" }), yenGroup)).toEqual({
      ok: false,
      errors: { amount: "JPY amounts must be whole numbers." },
    });
    const result = parseNewExpense(fields({ amount: "1000" }), yenGroup);
    expect(result.ok && result.value.shares.map((s) => s.amount)).toEqual([334, 333, 333]);
  });

  it("offers the nine predefined Categories", () => {
    expect(CATEGORIES).toEqual([
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
  });

  it("reports every problem at once with a specific message", () => {
    expect(
      parseNewExpense(
        fields({
          amount: "",
          description: "  ",
          date: "2026-02-30",
          category: "Snacks",
          payerId: "mem_stranger",
          participantIds: [],
          notes: "x".repeat(1001),
        }),
        group,
      ),
    ).toEqual({
      ok: false,
      errors: {
        amount: "Enter an amount.",
        description: "Describe what the Expense was for.",
        date: "Enter a real date, like 2026-01-31.",
        category: "Choose one of the Categories.",
        payerId: "Choose who paid.",
        participants: "Choose at least one member to split with.",
        notes: "Keep notes to 1000 characters or fewer.",
      },
    });
  });

  it("rejects a description over 120 characters", () => {
    expect(parseNewExpense(fields({ description: "x".repeat(121) }), group)).toEqual({
      ok: false,
      errors: { description: "Keep the description to 120 characters or fewer." },
    });
  });

  it("rejects participants who aren't Members of the Group", () => {
    expect(parseNewExpense(fields({ participantIds: ["mem_alex", "mem_stranger"] }), group)).toEqual({
      ok: false,
      errors: { participants: "Only members of this Group can share an Expense." },
    });
  });

  it("keeps trimmed notes and drops blank ones", () => {
    const withNotes = parseNewExpense(fields({ notes: "  extra cheese " }), group);
    expect(withNotes.ok && withNotes.value.notes).toBe("extra cheese");
    const blank = parseNewExpense(fields({ notes: "   " }), group);
    expect(blank.ok && "notes" in blank.value).toBe(false);
  });
});

describe("parseNewExpense: advanced Split Types", () => {
  it("records a Shares Split with each ratio", () => {
    const result = parseNewExpense(
      fields({
        amount: "10",
        splitType: "shares",
        participantIds: ["mem_alex", "mem_jordan"],
        splitValues: { mem_alex: "2", mem_jordan: "1", mem_sam: "5" },
      }),
      group,
    );
    expect(result.ok && result.value.splitType).toBe("shares");
    expect(result.ok && result.value.shares).toEqual([
      { memberId: "mem_alex", amount: 667, ratio: "2" },
      { memberId: "mem_jordan", amount: 333, ratio: "1" },
    ]);
  });

  it("reports a Split that doesn't add up against the Split, with other problems", () => {
    expect(
      parseNewExpense(
        fields({
          description: "",
          splitType: "percentage",
          splitValues: { mem_alex: "50", mem_jordan: "25", mem_sam: "20" },
        }),
        group,
      ),
    ).toEqual({
      ok: false,
      errors: {
        description: "Describe what the Expense was for.",
        split: "Percentages must add up to 100%. Currently: 95%",
      },
    });
  });

  it("reports which Member's value is wrong", () => {
    expect(
      parseNewExpense(
        fields({
          splitType: "exact",
          participantIds: ["mem_alex", "mem_jordan"],
          splitValues: { mem_alex: "60", mem_jordan: "abc" },
        }),
        group,
      ),
    ).toEqual({
      ok: false,
      errors: { split: "Fix the highlighted Shares." },
      splitValueErrors: { mem_jordan: "Enter the amount as a number, like 12.50." },
    });
  });

  it("doesn't judge the Split until the amount is valid", () => {
    expect(parseNewExpense(fields({ amount: "", splitType: "exact" }), group)).toEqual({
      ok: false,
      errors: { amount: "Enter an amount." },
    });
  });

  it("rejects an unknown Split Type", () => {
    expect(parseNewExpense(fields({ splitType: "itemised" }), group)).toEqual({
      ok: false,
      errors: { splitType: "Choose how to split the Expense." },
    });
  });
});

describe("parseNewExpense: Former Members", () => {
  const withFormer: GroupSnapshot = {
    ...group,
    members: group.members.map((m) => (m.id === "mem_taylor" ? { ...m, former: true } : m)),
  };

  it("keeps Former Members out of new Expenses", () => {
    expect(parseNewExpense(fields({ payerId: "mem_taylor" }), withFormer)).toMatchObject({
      ok: false,
      errors: { payerId: "Choose who paid." },
    });
    expect(
      parseNewExpense(fields({ participantIds: ["mem_alex", "mem_taylor"] }), withFormer),
    ).toMatchObject({
      ok: false,
      errors: { participants: "Only members of this Group can share an Expense." },
    });
  });

  it("keeps a Former Member on an Expense they were already part of when it is edited", () => {
    const past = parseNewExpense(fields({ payerId: "mem_taylor", participantIds: ["mem_alex", "mem_taylor"] }), group);
    if (!past.ok) throw new Error("fixture should be valid");
    const existing = { ...past.value, id: "exp_past", createdAt: "2026-01-01T00:00:00.000Z" };

    const edited = parseNewExpense(
      fields({ amount: "80", payerId: "mem_taylor", participantIds: ["mem_alex", "mem_taylor"] }),
      withFormer,
      existing,
    );
    expect(edited).toMatchObject({ ok: true, value: { amount: 8000, payerId: "mem_taylor" } });
  });
});

describe("amountText", () => {
  it.each([
    [6000, "USD", "60.00"],
    [5, "USD", "0.05"],
    [84000, "JPY", "84000"],
  ] as const)("shows %i %s as %j for editing, and reads back the same", (amount, currency, text) => {
    expect(amountText(amount, currency)).toBe(text);
    expect(parseAmount(text, currency)).toEqual({ ok: true, amount });
  });
});
