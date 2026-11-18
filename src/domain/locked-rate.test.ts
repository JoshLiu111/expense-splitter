import { describe, expect, it } from "vitest";
import {
  computeLedger,
  parseNewExpense,
  type Expense,
  type GroupSnapshot,
  type NewExpenseFields,
  type RateSnapshot,
} from "./index";

const group: GroupSnapshot = {
  id: "grp_trip",
  name: "Trip",
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
  amount: "84000",
  currency: "JPY",
  rate: "",
  description: "Ryokan",
  date: "2026-04-01",
  category: "Accommodation",
  payerId: "mem_alex",
  participantIds: ["mem_alex", "mem_jordan", "mem_sam", "mem_taylor"],
  notes: "",
  splitType: "equal",
  splitValues: {},
  ...overrides,
});

/** Today's cached rates: units of each currency per one USD. */
const rates = (perUsd: RateSnapshot["perUsd"], stale = false): RateSnapshot => ({
  perUsd,
  fetchedOn: "2026-04-01",
  stale,
});

const april = rates({ USD: 1, JPY: 149.25, EUR: 0.925 });
const may = rates({ USD: 1, JPY: 160, EUR: 0.9 });

function recorded(result: ReturnType<typeof parseNewExpense>): Expense {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { ...result.value, id: "exp_1", createdAt: "2026-04-01T10:00:00Z" };
}

describe("Locked Rate on a foreign-currency Expense", () => {
  it("splits in the Expense Currency and locks today's cached rate", () => {
    const result = parseNewExpense(fields(), group, undefined, april);
    expect(result).toMatchObject({
      ok: true,
      value: {
        amount: 84000,
        currency: "JPY",
        // 1 / 149.25 USD per yen, to six significant digits
        lockedRate: "0.00670017",
        shares: [
          { memberId: "mem_alex", amount: 21000 },
          { memberId: "mem_jordan", amount: 21000 },
          { memberId: "mem_sam", amount: 21000 },
          { memberId: "mem_taylor", amount: 21000 },
        ],
      },
    });
    expect(recorded(result).manualRate).toBeUndefined();
  });

  it("takes a rate typed by a Member as a manual Locked Rate", () => {
    const result = parseNewExpense(fields({ rate: " 0.0067 " }), group, undefined, april);
    expect(result).toMatchObject({ ok: true, value: { lockedRate: "0.0067", manualRate: true } });
  });

  it.each([
    ["abc", "Enter the rate as a number, like 0.0067."],
    ["0", "Enter a rate greater than zero."],
    ["-1", "Enter the rate as a number, like 0.0067."],
  ])("rejects the manual rate %j", (rate, message) => {
    expect(parseNewExpense(fields({ rate }), group, undefined, april)).toEqual({
      ok: false,
      errors: { rate: message },
    });
  });

  it("S1: past Balances never change when rates change", () => {
    const ryokan = recorded(parseNewExpense(fields(), group, undefined, april));
    const trip = { ...group, expenses: [ryokan] };
    const before = computeLedger(trip).balances;
    // Each ¥21,000 Share is $140.70 (per-line rounding, ADR 0001), so the
    // Expense is $562.80 and Alex, who paid, gets back three Shares.
    expect(before.find((b) => b.memberId === "mem_alex")?.amount).toBe(42210);

    // A month later the yen has moved (¥160 per dollar). Renaming the
    // Expense under May's rates leaves every Balance where it was.
    const renamed = recorded(parseNewExpense(fields({ description: "Ryokan, 2 nights" }), trip, ryokan, may));
    expect(computeLedger({ ...group, expenses: [renamed] }).balances).toEqual(before);
    // Editing the Split or amount keeps the Locked Rate too.
    const edited = recorded(
      parseNewExpense(
        fields({ description: "Ryokan, 2 nights", amount: "88000", participantIds: ["mem_alex", "mem_sam"] }),
        trip,
        ryokan,
        may,
      ),
    );
    expect(edited.lockedRate).toBe("0.00670017");
  });

  it("re-locks at Today's Rate when the Expense Currency changes", () => {
    const ryokan = recorded(parseNewExpense(fields(), group, undefined, april));
    const edited = parseNewExpense(fields({ currency: "EUR", amount: "520" }), group, ryokan, may);
    // 1 / 0.9 USD per euro
    expect(edited).toMatchObject({ ok: true, value: { currency: "EUR", amount: 52000, lockedRate: "1.11111" } });
  });

  it("keeps a manual rate on edit, and re-locks once the Member clears it", () => {
    const manual = recorded(parseNewExpense(fields({ rate: "0.0068" }), group, undefined, april));
    // The form shows the manual rate, so it comes back typed.
    expect(parseNewExpense(fields({ rate: "0.0068", description: "Inn" }), group, manual, may)).toMatchObject({
      ok: true,
      value: { lockedRate: "0.0068", manualRate: true },
    });
    const cleared = recorded(parseNewExpense(fields({ rate: "" }), group, manual, may));
    expect(cleared.lockedRate).toBe("0.00625");
    expect(cleared.manualRate).toBeUndefined();
  });

  it("returns to a Locked Rate of 1 in the Group Currency", () => {
    const ryokan = recorded(parseNewExpense(fields(), group, undefined, april));
    expect(
      parseNewExpense(fields({ currency: "USD", amount: "560", rate: "0.0067" }), group, ryokan, may),
    ).toMatchObject({ ok: true, value: { currency: "USD", amount: 56000, lockedRate: "1" } });
  });
});

describe("when the rate service is down", () => {
  it("locks the last cached rate, marked as possibly outdated", () => {
    const lastCached = rates({ USD: 1, JPY: 149.25 }, true);
    expect(parseNewExpense(fields(), group, undefined, lastCached)).toMatchObject({
      ok: true,
      value: { lockedRate: "0.00670017" },
    });
  });

  it("still takes the Expense with a manual rate when no rate was ever cached", () => {
    expect(parseNewExpense(fields(), group, undefined, null)).toEqual({
      ok: false,
      errors: { rate: "Exchange rates are unavailable right now. Enter the rate yourself." },
    });
    expect(parseNewExpense(fields({ rate: "0.0067" }), group, undefined, null)).toMatchObject({
      ok: true,
      value: { lockedRate: "0.0067", manualRate: true },
    });
  });

  it("keeps an edited Expense's Locked Rate without needing rates", () => {
    const ryokan = recorded(parseNewExpense(fields(), group, undefined, april));
    expect(parseNewExpense(fields({ description: "Inn" }), group, ryokan, null)).toMatchObject({
      ok: true,
      value: { lockedRate: "0.00670017" },
    });
  });
});

describe("Group Currency Expenses", () => {
  it("have a Locked Rate of 1 and ignore any typed rate", () => {
    expect(
      parseNewExpense(fields({ currency: "USD", amount: "60", rate: "2" }), group, undefined, null),
    ).toMatchObject({ ok: true, value: { currency: "USD", lockedRate: "1" } });
  });

  it("reject an unsupported currency", () => {
    expect(parseNewExpense(fields({ currency: "XYZ" }), group, undefined, april)).toMatchObject({
      ok: false,
      errors: { currency: "Choose a currency." },
    });
  });
});

describe("Compute Ledger: spending per Expense Currency", () => {
  it("subtotals each currency in its own and the Group Currency, Group Currency first", () => {
    const ryokan = recorded(parseNewExpense(fields(), group, undefined, april));
    const snacks = {
      ...recorded(
        parseNewExpense(
          fields({ amount: "1000", rate: "0.0067", payerId: "mem_jordan", participantIds: ["mem_alex", "mem_jordan"] }),
          group,
          undefined,
          april,
        ),
      ),
      id: "exp_2",
    };
    const taxi = {
      ...recorded(parseNewExpense(fields({ currency: "USD", amount: "20" }), group, undefined, april)),
      id: "exp_3",
    };
    const ledger = computeLedger({ ...group, expenses: [ryokan, snacks, taxi] });
    expect(ledger.currencySubtotals).toEqual([
      { currency: "USD", amount: 2000, groupAmount: 2000 },
      // $562.80 + 2 × ¥500 at 0.0067 ($3.35 each)
      { currency: "JPY", amount: 85000, groupAmount: 56950 },
    ]);
    expect(ledger.totalSpent).toBe(58950);
  });
});
