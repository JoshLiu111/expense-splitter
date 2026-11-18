import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { computeLedger, importSampleGroups } from "./index";

const groups = importSampleGroups(sampleData);
const group = (id: string) => {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`No sample Group ${id}`);
  return found;
};
const balancesOf = (id: string) =>
  Object.fromEntries(
    computeLedger(group(id)).balances.map((b) => [b.memberId, b.amount]),
  );

describe("Compute Ledger: sample Group Balances", () => {
  it("reproduces the documented Apartment 4B Balances", () => {
    expect(balancesOf("grp_apt_4b")).toEqual({
      mem_riley: 226709,
      mem_casey: -113898,
      mem_drew: -112811,
    });
  });

  it("reproduces the documented Trip to Japan Balances across JPY, USD and EUR", () => {
    expect(balancesOf("grp_japan_2024")).toEqual({
      mem_alex: 21646,
      mem_jordan: -21949,
      mem_sam: -31509,
      mem_taylor: 31812,
    });
  });

  it("reproduces the documented Office Lunch Crew Balances", () => {
    expect(balancesOf("grp_office_lunch")).toEqual({
      mem_mia: 1950,
      mem_noah: -3568,
      mem_priya: 5398,
      mem_ethan: -3780,
    });
  });

  it("reproduces the documented Sarah's Birthday Present Balances", () => {
    expect(balancesOf("grp_birthday")).toEqual({
      mem_olivia: 0,
      mem_ben: 1437,
      mem_chloe: -1437,
      mem_marcus: 0,
    });
  });

  it("reproduces the documented Camping Weekend Balances", () => {
    expect(balancesOf("grp_camping")).toEqual({
      mem_jake: 17779,
      mem_lily: 7929,
      mem_omar: -8696,
      mem_rachel: -7897,
      mem_dev: -9115,
    });
  });

  it.each(groups.map((g) => [g.name, g] as const))(
    "%s Balances sum to exactly zero",
    (_name, g) => {
      const sum = computeLedger(g).balances.reduce((s, b) => s + b.amount, 0);
      expect(sum).toBe(0);
    },
  );
});
