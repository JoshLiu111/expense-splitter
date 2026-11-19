import { describe, expect, it } from "vitest";
import { ledgerDays } from "./ledger-days";

const entry = (id: string, date: string) => ({ id, date });

describe("ledgerDays", () => {
  it("puts entries on the same day under one date, keeping their order", () => {
    const days = ledgerDays([
      entry("a", "2024-03-27"),
      entry("b", "2024-03-26"),
      entry("c", "2024-03-26"),
    ]);

    expect(days.map((d) => [d.date, d.entries.map((e) => e.id)])).toEqual([
      ["2024-03-27", ["a"]],
      ["2024-03-26", ["b", "c"]],
    ]);
    expect(days[1]).toMatchObject({ day: "26", month: "Mar", label: "Mar 26, 2024" });
  });

  it("shows the year on the first date and wherever the year changes", () => {
    const days = ledgerDays([
      entry("a", "2025-01-02"),
      entry("b", "2025-01-01"),
      entry("c", "2024-12-31"),
      entry("d", "2024-12-30"),
    ]);

    expect(days.map((d) => d.year)).toEqual(["2025", undefined, "2024", undefined]);
  });
});
