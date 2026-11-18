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
