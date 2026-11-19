import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { importSampleGroups } from "@/domain";
import { filterChips } from "./filter-chips";

const apartment = importSampleGroups(sampleData).find((g) => g.id === "grp_apt_4b")!;

describe("filterChips", () => {
  it("names each active filter, and removing one keeps the others", () => {
    const chips = filterChips(apartment, { category: "Utilities", memberId: "mem_drew" });

    expect(chips.map((c) => c.label)).toEqual(["Utilities", "Drew Patel"]);
    expect(chips[0].without).toEqual({ memberId: "mem_drew" });
    expect(chips[1].without).toEqual({ category: "Utilities" });
  });

  it("shows a whole calendar month as one chip that clears both dates", () => {
    const chips = filterChips(apartment, { from: "2024-02-01", to: "2024-02-29", category: "Housing" });

    expect(chips.map((c) => c.label)).toEqual(["Housing", "February 2024"]);
    expect(chips[1].without).toEqual({ category: "Housing" });
  });

  it("shows any other date range as a From chip and a To chip", () => {
    expect(filterChips(apartment, { from: "2024-01-15", to: "2024-02-14" }).map((c) => [c.label, c.without])).toEqual([
      ["From Jan 15, 2024", { to: "2024-02-14" }],
      ["To Feb 14, 2024", { from: "2024-01-15" }],
    ]);
    expect(filterChips(apartment, { to: "2024-01-31" }).map((c) => c.label)).toEqual(["To Jan 31, 2024"]);
  });
});
