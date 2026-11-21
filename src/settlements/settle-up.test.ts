import { describe, expect, it } from "vitest";
import { computeLedger, type GroupSnapshot, type RateSnapshot } from "@/domain";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/lib/memory-storage";
import { clearSmallChange, deleteSettlement, recordSettlement } from "./settle-up";

const GUEST = { userId: undefined };
const NO_RATES = async () => null;
const RATES: RateSnapshot = { perUsd: { USD: 1, JPY: 150 }, fetchedOn: "2026-03-02", stale: false };

/** Today's Rates that count how often they were asked for. */
function countedRates(rates: RateSnapshot | null = RATES) {
  const counted = Object.assign(async () => {
    counted.calls += 1;
    return rates;
  }, { calls: 0 });
  return counted;
}

/** A Group with "You" and Chloe, where Chloe owes You `owed` cents. */
async function flatWithDebt(owed = 1000) {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  const you = group.members[0];
  const chloe = (await repo.addMember(group.id, { name: "Chloe" }))!;
  await repo.addExpense(group.id, {
    description: "Pizza",
    amount: owed,
    currency: "USD",
    lockedRate: "1",
    payerId: you.id,
    splitType: "exact",
    shares: [{ memberId: chloe.id, amount: owed }],
    date: "2026-03-01",
    category: "Food & Drink",
  });
  const balances = async () =>
    computeLedger((await repo.getGroup(group.id))!).balances.map((b) => b.amount);
  return { repo, group, you, chloe, balances };
}

describe("recordSettlement", () => {
  it("records a partial Settlement, reducing Balances", async () => {
    const { repo, group, you, chloe, balances } = await flatWithDebt();

    const rates = countedRates();
    const result = await recordSettlement(
      repo,
      group.id,
      { fromId: chloe.id, toId: you.id, amount: "4.00", currency: "USD", rate: "", date: "2026-03-02" },
      rates,
    );

    expect(result).toEqual({ ok: true });
    expect(await balances()).toEqual([600, -600]);
    // A Settlement in the Group Currency needs no exchange rate.
    expect(rates.calls).toBe(0);
  });

  it("locks Today's Rate on a Settlement in another Settlement Currency", async () => {
    const { repo, group, you, chloe, balances } = await flatWithDebt();
    const rates = countedRates();
    const yen = { fromId: chloe.id, toId: you.id, amount: "600", currency: "JPY", rate: "", date: "2026-03-02" };

    expect(await recordSettlement(repo, group.id, yen, rates)).toEqual({ ok: true });
    expect(rates.calls).toBe(1);
    // ¥600 at 0.00666667 is $4.00.
    expect(await balances()).toEqual([600, -600]);
    expect((await repo.getGroup(group.id))!.settlements).toMatchObject([
      { amount: 600, currency: "JPY", lockedRate: "0.00666667" },
    ]);
  });

  it("doesn't ask for Today's Rate when a rate is typed", async () => {
    const { repo, group, you, chloe } = await flatWithDebt();
    const rates = countedRates();
    const yen = { fromId: chloe.id, toId: you.id, amount: "600", currency: "JPY", rate: "0.0067", date: "2026-03-02" };

    expect(await recordSettlement(repo, group.id, yen, rates)).toEqual({ ok: true });
    expect(rates.calls).toBe(0);
    expect((await repo.getGroup(group.id))!.settlements).toMatchObject([{ lockedRate: "0.0067", manualRate: true }]);
  });

  it("leaves the Group unchanged when no rate can be had", async () => {
    const { repo, group, you, chloe, balances } = await flatWithDebt();
    const yen = { fromId: chloe.id, toId: you.id, amount: "600", currency: "JPY", rate: "", date: "2026-03-02" };

    expect(await recordSettlement(repo, group.id, yen, countedRates(null))).toEqual({
      ok: false,
      errors: { rate: "Exchange rates are unavailable right now. Enter the rate yourself." },
    });
    expect(await balances()).toEqual([1000, -1000]);
  });

  it("refuses an overpayment against the Balances as stored now", async () => {
    const { repo, group, you, chloe, balances } = await flatWithDebt();
    const fields = { fromId: chloe.id, toId: you.id, amount: "6.00", currency: "USD", rate: "", date: "2026-03-02" };
    await recordSettlement(repo, group.id, fields, NO_RATES);

    expect(await recordSettlement(repo, group.id, fields, NO_RATES)).toEqual({
      ok: false,
      errors: { amount: "Chloe can pay at most $4.00." },
    });
    expect(await balances()).toEqual([400, -400]);
  });

  it("treats anything but text fields as empty", async () => {
    const { repo, group } = await flatWithDebt();
    expect(await recordSettlement(repo, group.id, { amount: 5 }, NO_RATES)).toMatchObject({
      ok: false,
      errors: { fromId: "Choose who paid.", amount: "Enter an amount." },
    });
  });
});

describe("deleteSettlement", () => {
  it("deletes a Settlement, restoring the debt", async () => {
    const { repo, group, you, chloe, balances } = await flatWithDebt();
    await recordSettlement(
      repo,
      group.id,
      { fromId: chloe.id, toId: you.id, amount: "10", currency: "USD", rate: "", date: "2026-03-02" },
      NO_RATES,
    );
    const [settlement] = (await repo.getGroup(group.id))!.settlements;

    expect(await deleteSettlement(repo, group.id, settlement.id, GUEST)).toEqual({ ok: true });
    expect(await balances()).toEqual([1000, -1000]);
    expect(await deleteSettlement(repo, group.id, settlement.id, GUEST)).toEqual({
      ok: false,
      errors: { form: "This Settlement no longer exists. It may have been deleted." },
    });
  });
  it("in Own Records Only, refuses another Member, leaving the Settlement", async () => {
    const group: GroupSnapshot = {
      id: "grp_flat",
      name: "Flat",
      description: "",
      currency: "USD",
      creatorUserId: "user_alex",
      editingMode: "own-records-only",
      members: [
        { id: "mem_alex", name: "Alex", userId: "user_alex", avatarColor: "#3B82F6" },
        { id: "mem_jo", name: "Jo", userId: "user_jo", avatarColor: "#F59E0B" },
      ],
      expenses: [],
      settlements: [
        { id: "stl_1", fromId: "mem_jo", toId: "mem_alex", amount: 500, currency: "USD", lockedRate: "1", date: "2026-03-02", createdAt: "2026-03-02T00:00:00.000Z" },
      ],
    };
    const repo = createSessionStorageRepository(memoryStorage(), () => [group]);

    expect(await deleteSettlement(repo, group.id, "stl_1", { userId: "user_jo" })).toEqual({
      ok: false,
      errors: {
        form: "This Group is set to Own Records Only, and no one is known to have recorded this Settlement: only the Group Creator, Alex, can delete it.",
      },
    });
    expect((await repo.getGroup(group.id))!.settlements).toHaveLength(1);
    expect(await deleteSettlement(repo, group.id, "stl_1", { userId: "user_alex" })).toEqual({ ok: true });
  });
});

describe("clearSmallChange", () => {
  it("records the Settlements that clear Small Change, reaching Settled Up", async () => {
    const { repo, group, balances } = await flatWithDebt(37);

    expect(await clearSmallChange(repo, group.id, "2026-03-02")).toEqual({ ok: true });
    expect(await balances()).toEqual([0, 0]);
    expect((await repo.getGroup(group.id))!.settlements).toMatchObject([{ amount: 37, date: "2026-03-02" }]);
  });

  it("clears the Small Change a Settlement Currency's conversion leaves, in the Group Currency", async () => {
    const { repo, group, you, chloe, balances } = await flatWithDebt(3000);
    // ¥4,470 at 0.0067 is $29.95, leaving 5¢.
    const yen = { fromId: chloe.id, toId: you.id, amount: "4470", currency: "JPY", rate: "0.0067", date: "2026-03-02" };
    await recordSettlement(repo, group.id, yen, NO_RATES);
    expect(await balances()).toEqual([5, -5]);

    expect(await clearSmallChange(repo, group.id, "2026-03-03")).toEqual({ ok: true });
    expect(await balances()).toEqual([0, 0]);
    expect((await repo.getGroup(group.id))!.settlements[1]).toMatchObject({ amount: 5, currency: "USD", lockedRate: "1" });
  });

  it("does nothing while a Suggested Settlement of a unit or more remains", async () => {
    const { repo, group, balances } = await flatWithDebt(100);

    expect(await clearSmallChange(repo, group.id, "2026-03-02")).toEqual({
      ok: false,
      errors: { form: "There's more than Small Change left to settle." },
    });
    expect(await balances()).toEqual([100, -100]);
  });
});
