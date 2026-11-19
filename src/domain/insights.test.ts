import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { computeInsights, filterMonth, importSampleGroups, monthRange, type GroupSnapshot } from "./index";

const groups = importSampleGroups(sampleData);
const sample = (id: string) => {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`No sample Group ${id}`);
  return found;
};
const apartment = sample("grp_apt_4b");
const ids = (group: GroupSnapshot, filter: Parameters<typeof computeInsights>[1]) =>
  computeInsights(group, filter).expenses.map((e) => e.expense.id);

describe("Compute Insights: filters", () => {
  it("lists every Expense, newest first, with no filter", () => {
    expect(ids(apartment, {})).toEqual([
      "exp_110",
      "exp_109",
      "exp_108",
      "exp_107",
      "exp_106",
      "exp_105",
      "exp_104",
      "exp_102",
      "exp_103",
      "exp_101",
    ]);
  });

  it("filters by month on calendar dates, so the 1 January rent is in January", () => {
    const january = monthRange("2024-01");
    expect(january).toEqual({ from: "2024-01-01", to: "2024-01-31" });
    expect(ids(apartment, january)).toEqual(["exp_105", "exp_104", "exp_102", "exp_103", "exp_101"]);
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("filters by an open-ended date range", () => {
    expect(ids(apartment, { from: "2024-02-15" })).toEqual(["exp_110", "exp_109"]);
    expect(ids(apartment, { to: "2024-01-03" })).toEqual(["exp_103", "exp_101"]);
  });

  it("filters by Category", () => {
    expect(ids(apartment, { category: "Utilities" })).toEqual(["exp_107", "exp_102", "exp_103"]);
  });

  it("filters by a Member who paid or is included in the Split", () => {
    // Priya isn't in the Sandwich shop lunch (exp_205) and paid two others.
    expect(ids(sample("grp_office_lunch"), { memberId: "mem_priya" })).toEqual([
      "exp_208",
      "exp_207",
      "exp_206",
      "exp_204",
      "exp_203",
      "exp_202",
      "exp_201",
    ]);
  });

  it("doesn't count an explicit zero Share as being included", () => {
    const camping = sample("grp_camping");
    const gas = camping.expenses.find((e) => e.id === "exp_404")!;
    const lilyPays = { ...camping, expenses: [{ ...gas, payerId: "mem_lily" }] };
    expect(ids(lilyPays, { memberId: "mem_jake" })).toEqual([]);
    expect(ids(lilyPays, { memberId: "mem_dev" })).toEqual(["exp_404"]);
  });

  it("combines filters freely", () => {
    expect(ids(apartment, { ...monthRange("2024-01"), category: "Utilities", memberId: "mem_drew" })).toEqual([
      "exp_102",
      "exp_103",
    ]);
    expect(ids(apartment, { ...monthRange("2024-02"), category: "Housing", memberId: "mem_casey" })).toEqual([
      "exp_106",
    ]);
    expect(ids(apartment, { ...monthRange("2024-03") })).toEqual([]);
  });

  it("offers the months that have Expenses, newest first", () => {
    expect(computeInsights(apartment, { category: "Housing" }).months).toEqual(["2024-02", "2024-01"]);
  });
});

describe("filterMonth", () => {
  it("names the month a date range covers exactly, and nothing for any other range", () => {
    expect(filterMonth({ from: "2024-02-01", to: "2024-02-29", category: "Housing" })).toBe("2024-02");
    expect(filterMonth({ from: "2024-02-01", to: "2024-02-28" })).toBeUndefined();
    expect(filterMonth({ from: "2024-02-01" })).toBeUndefined();
    expect(filterMonth({})).toBeUndefined();
  });
});

describe("Compute Insights: Category breakdown", () => {
  it("totals each Category in the Group Currency with percentages adding up to 100", () => {
    const { breakdown, total } = computeInsights(apartment, {});
    expect(total).toBe(836798);
    expect(breakdown).toEqual([
      { category: "Housing", name: "Housing", amount: 720000, percentage: "86.0" },
      { category: "Groceries", name: "Groceries", amount: 44421, percentage: "5.3" },
      { category: "Utilities", name: "Utilities", amount: 39128, percentage: "4.7" },
      { category: "Other", name: "Other", amount: 30950, percentage: "3.7" },
      { category: "Entertainment", name: "Entertainment", amount: 2299, percentage: "0.3" },
    ]);
  });

  it("breaks down only the filtered Expenses", () => {
    const { breakdown, total } = computeInsights(apartment, { ...monthRange("2024-02"), category: "Housing" });
    expect(total).toBe(360000);
    expect(breakdown).toEqual([{ category: "Housing", name: "Housing", amount: 360000, percentage: "100.0" }]);
  });

  it("converts foreign Expenses with their Locked Rates and shows Custom Category names", () => {
    const japan = sample("grp_japan_2024");
    const withCustom: GroupSnapshot = {
      ...japan,
      customCategories: [{ id: "cat_insurance", name: "Insurance" }],
      expenses: japan.expenses.map((e) => (e.id === "exp_013" ? { ...e, category: "cat_insurance" } : e)),
    };
    const { breakdown } = computeInsights(withCustom, { category: "cat_insurance" });
    // €96 at 1.08 = $103.68
    expect(breakdown).toEqual([
      { category: "cat_insurance", name: "Insurance", amount: 10368, percentage: "100.0" },
    ]);
  });

  it("is empty when nothing matches", () => {
    expect(computeInsights(apartment, monthRange("2025-01"))).toMatchObject({ breakdown: [], total: 0 });
  });
});

describe("Compute Insights: spending over time", () => {
  it("totals each calendar month in the Group Currency, oldest first, with empty months as zero", () => {
    const withMarch: GroupSnapshot = {
      ...apartment,
      expenses: [
        ...apartment.expenses,
        { ...apartment.expenses[0], id: "exp_april", date: "2024-04-01", createdAt: "2024-04-01T09:00:00.000Z" },
      ],
    };
    expect(computeInsights(withMarch, {}).byMonth).toEqual([
      { month: "2024-01", amount: 414429 },
      { month: "2024-02", amount: 422369 },
      { month: "2024-03", amount: 0 },
      { month: "2024-04", amount: 360000 },
    ]);
  });
});
