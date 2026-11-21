import { describe, expect, it } from "vitest";
import {
  changeGroupCurrency,
  computeLedger,
  currencyChangeBlock,
  multiplyRates,
  parseCurrencyChange,
  type Expense,
  type GroupSnapshot,
  type Settlement,
} from "./index";

const members = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), avatarColor: "#000000" }));

const expense = (overrides: Partial<Expense>): Expense => ({
  id: "exp_0",
  description: "Dinner",
  amount: 0,
  currency: "USD",
  lockedRate: "1",
  payerId: "a",
  splitType: "exact",
  shares: [],
  date: "2024-03-01",
  createdAt: "2024-03-01T00:00:00.000Z",
  category: "Other",
  ...overrides,
});

const settlement = (overrides: Partial<Settlement>): Settlement => ({
  id: "stl_0",
  fromId: "b",
  toId: "a",
  amount: 0,
  currency: "USD",
  lockedRate: "1",
  date: "2024-03-02",
  createdAt: "2024-03-02T00:00:00.000Z",
  ...overrides,
});

const usdGroup = (overrides: Partial<GroupSnapshot> = {}): GroupSnapshot => ({
  id: "grp_test",
  name: "Test",
  description: "",
  currency: "USD",
  creatorUserId: "usr_a",
  members,
  expenses: [],
  settlements: [],
  ...overrides,
});

const balances = (group: GroupSnapshot) =>
  Object.fromEntries(computeLedger(group).balances.map((b) => [b.memberId, b.amount]));

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

/** Every Expense's owing lines add up to what its Payer is credited, and Balances to zero. */
function expectSound(group: GroupSnapshot) {
  const ledger = computeLedger(group);
  expect(sum(ledger.balances.map((b) => b.amount))).toBe(0);
  for (const entry of ledger.timeline) {
    if (entry.kind === "expense") expect(sum(entry.owing.map((line) => line.groupAmount))).toBe(entry.groupAmount);
  }
}

describe("changeGroupCurrency", () => {
  it("scales every Balance by the rate", () => {
    const group = usdGroup({
      expenses: [expense({ amount: 3000, shares: [{ memberId: "b", amount: 3000 }] })],
    });

    const yen = changeGroupCurrency(group, { from: "USD", to: "JPY", rate: "150" });

    expect(yen.currency).toBe("JPY");
    expect(yen.expenses[0]).toEqual({ ...group.expenses[0], lockedRate: "150" });
    expect(balances(yen)).toEqual({ a: 4500, b: -4500, c: 0 });
  });

  it("multiplies a foreign Expense's Locked Rate by the rate", () => {
    const group = usdGroup({
      expenses: [expense({ amount: 1213, currency: "JPY", lockedRate: "0.0067", shares: [{ memberId: "b", amount: 1213 }] })],
    });

    const euros = changeGroupCurrency(group, { from: "USD", to: "EUR", rate: "0.925" });

    // ¥1,213 × 0.0067 × 0.925 = €7.5175675 → €7.52
    expect(euros.expenses[0].lockedRate).toBe("0.0061975");
    expect(balances(euros)).toEqual({ a: 752, b: -752, c: 0 });
  });

  it("gives a record in the new Group Currency exactly 1, keeping its own amount", () => {
    const group = usdGroup({
      expenses: [
        expense({ amount: 1000, currency: "EUR", lockedRate: "1.08", manualRate: true, shares: [{ memberId: "b", amount: 1000 }] }),
      ],
      settlements: [settlement({ amount: 500, currency: "EUR", lockedRate: "1.1", manualRate: true })],
    });

    const euros = changeGroupCurrency(group, { from: "USD", to: "EUR", rate: "0.925" });

    // Not 1.08 × 0.925 = 0.999: an amount in the Group Currency counts as itself.
    expect(euros.expenses[0]).toEqual({ ...group.expenses[0], lockedRate: "1", manualRate: undefined });
    expect(euros.expenses[0]).not.toHaveProperty("manualRate");
    expect(euros.settlements[0]).not.toHaveProperty("manualRate");
    expect(balances(euros)).toEqual({ a: 500, b: -500, c: 0 });
  });

  it("keeps whether a converted Locked Rate was typed by hand", () => {
    const group = usdGroup({
      expenses: [expense({ amount: 1000, currency: "EUR", lockedRate: "1.1", manualRate: true, shares: [{ memberId: "b", amount: 1000 }] })],
    });

    const yen = changeGroupCurrency(group, { from: "USD", to: "JPY", rate: "150" });

    expect(yen.expenses[0]).toMatchObject({ lockedRate: "165", manualRate: true });
  });

  it("rounds each converted Share on its own line, so the Payer is credited their sum and Balances still sum to zero", () => {
    // $10.00 Equal three ways: $3.34, $3.33, $3.33. At 150 each line rounds
    // half up on its own: ¥501, ¥500 (499.5), ¥500 = ¥1,501, not ¥1,500.
    const group = usdGroup({
      expenses: [
        expense({
          amount: 1000,
          splitType: "equal",
          shares: [
            { memberId: "a", amount: 334 },
            { memberId: "b", amount: 333 },
            { memberId: "c", amount: 333 },
          ],
        }),
      ],
    });

    const yen = changeGroupCurrency(group, { from: "USD", to: "JPY", rate: "150" });

    expect(balances(yen)).toEqual({ a: 1000, b: -500, c: -500 });
    expect(computeLedger(yen).totalSpent).toBe(1501);
    expectSound(yen);
  });

  it("converts a yen Group to dollars, where every whole-yen Share rounds to cents", () => {
    // ¥100 split ¥34/¥33/¥33 at 0.0067: $0.2278 → 23¢, $0.2211 → 22¢ twice.
    const group = usdGroup({
      currency: "JPY",
      expenses: [
        expense({
          amount: 100,
          currency: "JPY",
          payerId: "b",
          shares: [
            { memberId: "a", amount: 34 },
            { memberId: "b", amount: 33 },
            { memberId: "c", amount: 33 },
          ],
        }),
      ],
      settlements: [settlement({ fromId: "c", toId: "b", amount: 7, currency: "JPY" })],
    });

    const dollars = changeGroupCurrency(group, { from: "JPY", to: "USD", rate: "0.0067" });

    // The ¥7 Settlement is 4.69¢ → 5¢.
    expect(balances(dollars)).toEqual({ a: -23, b: 45 - 5, c: -22 + 5 });
    expectSound(dollars);
  });

  it("converts a Settlement in another Settlement Currency at its own Locked Rate times the rate", () => {
    const group = usdGroup({
      expenses: [expense({ amount: 5000, shares: [{ memberId: "b", amount: 5000 }] })],
      settlements: [settlement({ amount: 4478, currency: "JPY", lockedRate: "0.0067" })],
    });

    const euros = changeGroupCurrency(group, { from: "USD", to: "EUR", rate: "0.925" });

    // ¥4,478 × 0.0061975 = €27.7524… → €27.75; the $50.00 Expense is €46.25.
    expect(euros.settlements[0].lockedRate).toBe("0.0061975");
    expect(balances(euros)).toEqual({ a: 4625 - 2775, b: -4625 + 2775, c: 0 });
    expectSound(euros);
  });

  it("leaves the Group unchanged apart from its currency and Locked Rates", () => {
    const group = usdGroup({
      expenses: [expense({ amount: 1000, shares: [{ memberId: "b", amount: 1000 }] })],
      settlements: [settlement({ amount: 300 })],
    });

    const converted = changeGroupCurrency(group, { from: "USD", to: "GBP", rate: "0.79" });

    expect(converted).toEqual({
      ...group,
      currency: "GBP",
      expenses: [{ ...group.expenses[0], lockedRate: "0.79" }],
      settlements: [{ ...group.settlements[0], lockedRate: "0.79" }],
    });
  });
});

describe("multiplyRates", () => {
  it("multiplies exactly, without floating point", () => {
    expect(multiplyRates("0.1", "0.2")).toBe("0.02");
    expect(multiplyRates("1.08", "150")).toBe("162");
    expect(multiplyRates("1", "0.925")).toBe("0.925");
  });

  it("rounds half up to the twelve decimals a typed rate may have", () => {
    // 0.00666667² = 0.0000444444888889
    expect(multiplyRates("0.00666667", "0.00666667")).toBe("0.000044444489");
    // 0.0000005 × 0.000001 = 5e-13 → rounds up to 1e-12
    expect(multiplyRates("0.0000005", "0.000001")).toBe("0.000000000001");
    expect(multiplyRates("0.0000004", "0.000001")).toBe("0");
  });
});

describe("parseCurrencyChange", () => {
  const withRecord = usdGroup({ expenses: [expense({ amount: 1000, shares: [{ memberId: "b", amount: 1000 }] })] });

  it("reads the new Group Currency and the rate typed", () => {
    expect(parseCurrencyChange({ from: "USD", to: "JPY", rate: " 150.50 " }, withRecord)).toEqual({
      ok: true,
      value: { from: "USD", to: "JPY", rate: "150.5" },
    });
  });

  it("needs no rate when nothing is recorded", () => {
    expect(parseCurrencyChange({ from: "USD", to: "EUR", rate: "" }, usdGroup())).toEqual({
      ok: true,
      value: { from: "USD", to: "EUR", rate: "1" },
    });
  });

  it("refuses a rate that isn't a positive number", () => {
    expect(parseCurrencyChange({ from: "USD", to: "JPY", rate: "" }, withRecord)).toEqual({
      ok: false,
      errors: { rate: "Enter the rate as a number, like 0.0067." },
    });
    expect(parseCurrencyChange({ from: "USD", to: "JPY", rate: "0" }, withRecord)).toEqual({
      ok: false,
      errors: { rate: "Enter a rate greater than zero." },
    });
  });

  it("refuses a rate that would round a Locked Rate to nothing", () => {
    const tiny = usdGroup({
      expenses: [expense({ amount: 1000, currency: "JPY", lockedRate: "0.0000004", shares: [{ memberId: "b", amount: 1000 }] })],
    });
    expect(parseCurrencyChange({ from: "USD", to: "EUR", rate: "0.000001" }, tiny)).toEqual({
      ok: false,
      errors: { rate: "That rate is too small to convert every Expense and Settlement." },
    });
  });

  it("refuses a rate that would make a Locked Rate too large to type", () => {
    const big = usdGroup({
      expenses: [expense({ amount: 1000, currency: "EUR", lockedRate: "50000", shares: [{ memberId: "b", amount: 1000 }] })],
    });
    expect(parseCurrencyChange({ from: "USD", to: "JPY", rate: "100000" }, big)).toEqual({
      ok: false,
      errors: { rate: "That rate is too large to convert every Expense and Settlement." },
    });
  });

  it("refuses the Group Currency it already has, or one not supported", () => {
    expect(parseCurrencyChange({ from: "USD", to: "USD", rate: "1" }, withRecord)).toEqual({
      ok: false,
      errors: { to: "The Group Currency is already USD." },
    });
    expect(parseCurrencyChange({ from: "USD", to: "XYZ", rate: "1" }, withRecord).ok).toBe(false);
  });

  it("refuses a change worked out against a Group Currency the Group no longer has", () => {
    expect(parseCurrencyChange({ from: "EUR", to: "JPY", rate: "160" }, withRecord)).toEqual({
      ok: false,
      errors: { form: "The Group Currency has changed since this page loaded. Check the new Balances again." },
    });
  });
});

describe("currencyChangeBlock", () => {
  const group = usdGroup({ members: [{ ...members[0], userId: "usr_a" }, members[1]] });

  it("lets only the Group Creator change the Group Currency, in any Editing Mode", () => {
    expect(currencyChangeBlock(group, { userId: "usr_a" })).toBeNull();
    expect(currencyChangeBlock({ ...group, editingMode: "own-records-only" }, { userId: "usr_a" })).toBeNull();
    expect(currencyChangeBlock(group, { userId: "usr_b" })).toBe(
      "Only the Group Creator, A, can change the Group Currency.",
    );
  });

  it("lets the Guest change it in every session Group", () => {
    expect(currencyChangeBlock(usdGroup({ creatorUserId: undefined }), { userId: undefined })).toBeNull();
  });
});
