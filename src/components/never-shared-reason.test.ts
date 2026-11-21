import { describe, expect, it } from "vitest";
import { computeLedger, type Expense, type GroupSnapshot } from "@/domain";
import { neverSharedReason } from "./never-shared-reason";

const expense = (id: string, payerId: string, shares: [string, number][]): Expense => ({
  id,
  description: id,
  amount: shares.reduce((sum, [, amount]) => sum + amount, 0),
  currency: "USD",
  lockedRate: "1",
  payerId,
  splitType: "exact",
  shares: shares.map(([memberId, amount]) => ({ memberId, amount })),
  date: "2026-03-01",
  createdAt: "2026-03-01T12:00:00.000Z",
  category: "Other",
});

const groupOf = (members: [string, string, boolean?][], expenses: Expense[]): GroupSnapshot => ({
  id: "grp_reason",
  name: "Reason",
  description: "",
  currency: "USD",
  members: members.map(([id, name, former]) => ({ id, name, avatarColor: "#3B82F6", former })),
  expenses,
  settlements: [],
});

const suggestionOf = (group: GroupSnapshot, fromId: string, toId: string) =>
  computeLedger(group).suggestions.find((s) => s.fromId === fromId && s.toId === toId)!;

/** Taylor paid for Taylor, Sam and Riley; Sam and Riley each paid for themselves and Jo. */
const cabin = groupOf(
  [
    ["you", "Jo"],
    ["tay", "Taylor"],
    ["sam", "Sam"],
    ["rio", "Riley"],
  ],
  [
    expense("cabin", "tay", [["tay", 2500], ["sam", 2500], ["rio", 2500]]),
    expense("fuel", "sam", [["sam", 2500], ["you", 2500]]),
    expense("food", "rio", [["rio", 2500], ["you", 2500]]),
  ],
);

describe("neverSharedReason", () => {
  it("tells the payer the recipient is owed the most, and the Debts their payment replaces", () => {
    expect(neverSharedReason(cabin, suggestionOf(cabin, "you", "tay"), "payer")).toBe(
      "You never shared an Expense with Taylor; Debt Simplification goes by Balances, and Taylor is owed $50.00, " +
        "the most in the Group. Instead of 2 Debts with Sam and Riley, you make 1 payment.",
    );
  });

  it("tells the recipient only that Debt Simplification goes by Balances", () => {
    expect(neverSharedReason(cabin, suggestionOf(cabin, "you", "tay"), "recipient")).toBe(
      "You never shared an Expense with Jo; Debt Simplification goes by Balances, so Jo pays you directly.",
    );
  });

  it("names both Members in the panel", () => {
    expect(neverSharedReason(cabin, suggestionOf(cabin, "you", "tay"), "panel")).toBe(
      "Jo and Taylor never shared an Expense; Debt Simplification goes by Balances, and Taylor is owed $50.00, " +
        "the most in the Group. Instead of 2 Debts with Sam and Riley, Jo makes 1 payment.",
    );
  });

  it("agrees with You, a Guest's own Member, in the panel", () => {
    const guest = groupOf(
      [
        ["you", "You"],
        ["tay", "Taylor"],
        ["sam", "Sam"],
        ["rio", "Riley"],
      ],
      cabin.expenses,
    );
    expect(neverSharedReason(guest, suggestionOf(guest, "you", "tay"), "panel")).toBe(
      "You and Taylor never shared an Expense; Debt Simplification goes by Balances, and Taylor is owed $50.00, " +
        "the most in the Group. Instead of 2 Debts with Sam and Riley, You make 1 payment.",
    );
    // The cabin again, with You in Taylor's place.
    const owedToYou = groupOf(
      [
        ["jo", "Jo"],
        ["you", "You"],
        ["sam", "Sam"],
        ["rio", "Riley"],
      ],
      [
        expense("cabin", "you", [["you", 2500], ["sam", 2500], ["rio", 2500]]),
        expense("fuel", "sam", [["sam", 2500], ["jo", 2500]]),
        expense("food", "rio", [["rio", 2500], ["jo", 2500]]),
      ],
    );
    expect(neverSharedReason(owedToYou, suggestionOf(owedToYou, "jo", "you"), "panel")).toBe(
      "Jo and You never shared an Expense; Debt Simplification goes by Balances, and You are owed $50.00, " +
        "the most in the Group. Instead of 2 Debts with Sam and Riley, Jo makes 1 payment.",
    );
  });

  it("says nothing for two Members who shared an Expense", () => {
    const shared = groupOf(
      [
        ["ana", "Ana"],
        ["ben", "Ben"],
      ],
      [expense("dinner", "ana", [["ana", 1000], ["ben", 1000]])],
    );
    expect(neverSharedReason(shared, suggestionOf(shared, "ben", "ana"), "payer")).toBeUndefined();
  });

  it("leaves out the most in the Group on a tie, and the Debts when there are no fewer payments", () => {
    // Quinn paid for Quinn and Pat; Ari and Bea each paid for themselves and Quinn.
    const tie = groupOf(
      [
        ["pat", "Pat"],
        ["qi", "Quinn"],
        ["ari", "Ari"],
        ["bea", "Bea"],
      ],
      [
        expense("hotel", "qi", [["qi", 2000], ["pat", 2000]]),
        expense("ferry", "ari", [["ari", 1000], ["qi", 1000]]),
        expense("lunch", "bea", [["bea", 1000], ["qi", 1000]]),
      ],
    );
    expect(neverSharedReason(tie, suggestionOf(tie, "pat", "ari"), "panel")).toBe(
      "Pat and Ari never shared an Expense; Debt Simplification goes by Balances, and Ari is owed $10.00.",
    );
  });

  it("names at most three Members, then how many others, a Former Member by name alone", () => {
    const others = ["a", "b", "c", "d", "e"];
    const names: Record<string, string> = { a: "Ana", b: "Ben", c: "Cai", d: "Dee", e: "Eli" };
    const big = groupOf(
      [["you", "Jo"], ["tay", "Taylor"], ...others.map((id): [string, string, boolean?] => [id, names[id], id === "b"])],
      [
        expense("villa", "tay", [["tay", 1000], ...others.map((id): [string, number] => [id, 1000])]),
        ...others.map((id) => expense(`back-${id}`, id, [[id, 1000], ["you", 1000]])),
      ],
    );
    expect(neverSharedReason(big, suggestionOf(big, "you", "tay"), "payer")).toBe(
      "You never shared an Expense with Taylor; Debt Simplification goes by Balances, and Taylor is owed $50.00, " +
        "the most in the Group. Instead of 5 Debts with Ana, Ben, Cai and 2 others, you make 1 payment.",
    );
  });
});
