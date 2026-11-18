import { describe, expect, it } from "vitest";
import { computeSplit, describeEqualSplit } from "./index";

const memberOrder = ["a", "b", "c", "d"];

describe("Compute Split: Equal", () => {
  it("splits $100 three ways as 33.34 + 33.33 + 33.33", () => {
    expect(
      computeSplit({
        amount: 10000,
        currency: "USD",
        splitType: "equal",
        participantIds: ["a", "b", "c"],
        memberOrder,
      }),
    ).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 3334 },
        { memberId: "b", amount: 3333 },
        { memberId: "c", amount: 3333 },
      ],
    });
  });

  it("gives Leftover Cents by Member order, not the order participants were picked", () => {
    const result = computeSplit({
      amount: 1002,
      currency: "USD",
      splitType: "equal",
      participantIds: ["d", "c", "b", "a"],
      memberOrder,
    });
    expect(result).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 251 },
        { memberId: "b", amount: 251 },
        { memberId: "c", amount: 250 },
        { memberId: "d", amount: 250 },
      ],
    });
  });

  it("splits JPY in whole yen", () => {
    expect(
      computeSplit({
        amount: 1000,
        currency: "JPY",
        splitType: "equal",
        participantIds: ["a", "c", "d"],
        memberOrder,
      }),
    ).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 334 },
        { memberId: "c", amount: 333 },
        { memberId: "d", amount: 333 },
      ],
    });
  });

  it("rejects a Split with no one in it", () => {
    expect(
      computeSplit({
        amount: 6000,
        currency: "USD",
        splitType: "equal",
        participantIds: [],
        memberOrder,
      }),
    ).toEqual({ ok: false, error: "Choose at least one member to split with." });
  });
});

describe("describeEqualSplit", () => {
  const shares = (...amounts: number[]) => amounts.map((amount, i) => ({ memberId: `m${i}`, amount }));

  it('reads like "$60 split 3 ways = $20 each"', () => {
    expect(describeEqualSplit(6000, "USD", shares(2000, 2000, 2000))).toBe(
      "$60.00 split 3 ways = $20.00 each",
    );
  });

  it("shows the range when a Leftover Cent makes Shares uneven", () => {
    expect(describeEqualSplit(10000, "USD", shares(3334, 3333, 3333))).toBe(
      "$100.00 split 3 ways = $33.33 to $33.34 each",
    );
  });

  it("says who pays it all when one Member is in the Split", () => {
    expect(describeEqualSplit(84000, "JPY", shares(84000))).toBe("¥84,000 for 1 member");
  });
});

describe("Compute Split: Exact", () => {
  it("uses each typed Share when they sum to the amount, allowing $0", () => {
    expect(
      computeSplit({
        amount: 5000,
        currency: "USD",
        splitType: "exact",
        participantIds: ["a", "b", "c"],
        memberOrder,
        values: { a: "15", b: "35.00", c: "0" },
      }),
    ).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 1500 },
        { memberId: "b", amount: 3500 },
        { memberId: "c", amount: 0 },
      ],
    });
  });

  const exact = (values: Record<string, string>, currency: "USD" | "JPY" = "USD") =>
    computeSplit({
      amount: 5000,
      currency,
      splitType: "exact",
      participantIds: ["a", "b"],
      memberOrder,
      values,
    });

  it("rejects Shares that fall short, showing what is left to assign", () => {
    expect(exact({ a: "20", b: "25" })).toEqual({
      ok: false,
      error: "Shares must add up to $50.00. Currently: $45.00 ($5.00 left to assign).",
    });
  });

  it("rejects Shares that add up to too much, showing the excess", () => {
    expect(exact({ a: "30", b: "20.01" })).toEqual({
      ok: false,
      error: "Shares must add up to $50.00. Currently: $50.01 ($0.01 too much).",
    });
  });

  it("points at the Member whose Share isn't an amount", () => {
    expect(exact({ a: "20", b: "2.555" })).toEqual({
      ok: false,
      error: "Fix the highlighted Shares.",
      memberErrors: { b: "USD amounts can have at most 2 decimal places." },
    });
    expect(exact({ a: "-5", b: "x" }, "JPY")).toEqual({
      ok: false,
      error: "Fix the highlighted Shares.",
      memberErrors: {
        a: "Enter an amount of zero or more.",
        b: "Enter the amount as a number, like 12.50.",
      },
    });
  });
});

describe("Compute Split: Percentage", () => {
  const percentage = (amount: number, values: Record<string, string>) =>
    computeSplit({
      amount,
      currency: "USD",
      splitType: "percentage",
      participantIds: Object.keys(values),
      memberOrder,
      values,
    });

  it("splits $89.20 as 30/20/30/20 and keeps each percentage", () => {
    expect(percentage(8920, { a: "30", b: "20", c: "30.0", d: "20" })).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 2676, percentage: "30" },
        { memberId: "b", amount: 1784, percentage: "20" },
        { memberId: "c", amount: 2676, percentage: "30" },
        { memberId: "d", amount: 1784, percentage: "20" },
      ],
    });
  });

  it("gives the Leftover Cent to the largest remainder so Shares sum to the amount", () => {
    expect(percentage(1000, { a: "33.33", b: "33.33", c: "33.34" })).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 333, percentage: "33.33" },
        { memberId: "b", amount: 333, percentage: "33.33" },
        { memberId: "c", amount: 334, percentage: "33.34" },
      ],
    });
  });

  it.each([
    [{ a: "50", b: "45" }, "Percentages must add up to 100%. Currently: 95%"],
    [{ a: "60", b: "40.5" }, "Percentages must add up to 100%. Currently: 100.5%"],
  ])("rejects %j", (values, error) => {
    expect(percentage(1000, values)).toEqual({ ok: false, error });
  });

  it("points at a percentage that isn't a number", () => {
    expect(percentage(1000, { a: "half", b: "50.001" })).toEqual({
      ok: false,
      error: "Fix the highlighted percentages.",
      memberErrors: {
        a: "Enter a percentage as a number, like 25.",
        b: "Percentages can have at most 2 decimal places.",
      },
    });
  });
});

describe("Compute Split: Shares", () => {
  const ratios = (amount: number, currency: "USD" | "JPY", values: Record<string, string>) =>
    computeSplit({
      amount,
      currency,
      splitType: "shares",
      participantIds: Object.keys(values),
      memberOrder,
      values,
    });

  it("gives the first Member two thirds of $10 in a 2:1 Split", () => {
    expect(ratios(1000, "USD", { a: "2", b: "1" })).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 667, ratio: "2" },
        { memberId: "b", amount: 333, ratio: "1" },
      ],
    });
  });

  it("splits ¥42,600 as 2:2:1:1 in whole yen", () => {
    expect(ratios(42600, "JPY", { a: "2", b: "2", c: "1", d: "1.0" })).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 14200, ratio: "2" },
        { memberId: "b", amount: 14200, ratio: "2" },
        { memberId: "c", amount: 7100, ratio: "1" },
        { memberId: "d", amount: 7100, ratio: "1" },
      ],
    });
  });

  it("allows fractional ratios like 1.5:1", () => {
    expect(ratios(1001, "USD", { a: "1.5", b: "1" })).toEqual({
      ok: true,
      shares: [
        { memberId: "a", amount: 601, ratio: "1.5" },
        { memberId: "b", amount: 400, ratio: "1" },
      ],
    });
  });

  it("rejects a Split where every ratio is zero", () => {
    expect(ratios(1000, "USD", { a: "0", b: "" })).toEqual({
      ok: false,
      error: "Give at least one member a ratio above zero.",
    });
  });

  it("rejects a ratio too large to be meaningful", () => {
    expect(ratios(1000, "USD", { a: "1000000", b: "1" })).toEqual({
      ok: false,
      error: "Fix the highlighted ratios.",
      memberErrors: { a: "Keep each ratio under 1,000,000." },
    });
  });
});
