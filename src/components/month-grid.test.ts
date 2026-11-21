import { describe, expect, it } from "vitest";
import { addMonths, monthWeeks, moveWithinMonth } from "./month-grid";

describe("monthWeeks", () => {
  it("lays a month out in Sunday-first weeks, padded with nulls", () => {
    // March 1, 2024 was a Friday; the 31st a Sunday.
    const weeks = monthWeeks("2024-03");
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, "2024-03-01", "2024-03-02"]);
    expect(weeks[5]).toEqual(["2024-03-31", null, null, null, null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("knows a leap February", () => {
    expect(monthWeeks("2024-02").flat().filter(Boolean).at(-1)).toBe("2024-02-29");
    expect(monthWeeks("2023-02").flat().filter(Boolean).at(-1)).toBe("2023-02-28");
  });
});

describe("addMonths", () => {
  it("steps across years", () => {
    expect(addMonths("2024-01", -1)).toBe("2023-12");
    expect(addMonths("2024-12", 1)).toBe("2025-01");
    expect(addMonths("2024-03", 0)).toBe("2024-03");
  });
});

describe("moveWithinMonth", () => {
  it("moves by days and stays within the month", () => {
    expect(moveWithinMonth("2024-03-05", 1)).toBe("2024-03-06");
    expect(moveWithinMonth("2024-03-05", 7)).toBe("2024-03-12");
    expect(moveWithinMonth("2024-03-05", -7)).toBe("2024-03-01");
    expect(moveWithinMonth("2024-03-28", 7)).toBe("2024-03-31");
    expect(moveWithinMonth("2024-02-28", 1)).toBe("2024-02-29");
  });
});
