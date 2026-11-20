import { describe, expect, it } from "vitest";
import type { GroupSnapshot, NewExpense } from "@/domain";
import type { GroupRepository } from "./group-repository";

/** An Equal Expense paid and shared by the Group's first Member. */
function lunch(group: GroupSnapshot, overrides: Partial<NewExpense> = {}): NewExpense {
  const me = group.members[0].id;
  return {
    description: "Lunch",
    amount: 2450,
    currency: group.currency,
    lockedRate: "1",
    payerId: me,
    splitType: "equal",
    shares: [{ memberId: me, amount: 2450 }],
    date: "2026-03-01",
    category: "Food & Drink",
    ...overrides,
  };
}

/** Behaviour every GroupRepository must share, Guest or Postgres. */
export function groupRepositoryContract(
  makeRepository: () => Promise<GroupRepository>,
  /** The `actorMemberId` this repository's changes to a Group are recorded under. */
  actorOf: (group: GroupSnapshot) => string | undefined,
  /**
   * How Users are made and changed, as sign-up and Account Settings do;
   * absent for a Guest, whose Groups have no Linked Members.
   */
  users?: {
    /** A new verified User, whom adding a Member by their email Links. */
    aUser(): Promise<{ id: string; email: string }>;
    rename(userId: string, name: string): Promise<void>;
    /** Sets the User's avatar and answers its URL. */
    setAvatar(userId: string): Promise<string>;
    removeAvatar(userId: string): Promise<void>;
  },
) {
  /**
   * A Group whose Members are its creator, a Name-only Member, a Pending
   * Member and a Former Member who was Linked to `theo`, with an Expense.
   */
  async function everyKindOfMember(repo: GroupRepository, theo: { email: string }) {
    const flat = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const chloe = (await repo.addMember(flat.id, { name: "Chloe Park" }))!;
    const pending = (await repo.addMember(flat.id, { name: "Dev Shah", email: "dev@nowhere.test" }))!;
    const linked = (await repo.addMember(flat.id, { name: "Theo", email: theo.email }))!;
    await repo.removeMember(flat.id, linked.id);
    await repo.addExpense(flat.id, lunch(flat));
    return { flat, me: flat.members[0], chloe, pending, former: { ...linked, former: true } };
  }

  it("creates a Group with no Expenses whose only Member is its creator", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({
      name: "Flat 3B",
      description: "Rent and bills",
      currency: "GBP",
    });

    expect(group).toMatchObject({
      name: "Flat 3B",
      description: "Rent and bills",
      currency: "GBP",
      expenses: [],
      settlements: [],
    });
    expect(group.id).toEqual(expect.any(String));
    expect(group.members).toHaveLength(1);
  });

  it("lists and fetches a created Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Lisbon", description: "", currency: "EUR" });

    expect((await repo.listGroups()).map((g) => g.id)).toContain(group.id);
    expect(await repo.getGroup(group.id)).toEqual(group);
  });

  it("returns null for a Group that doesn't exist", async () => {
    const repo = await makeRepository();
    expect(await repo.getGroup("grp_missing")).toBeNull();
  });

  it("records an Expense in a Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    const expense = await repo.addExpense(group.id, lunch(group, { notes: "Tacos" }));

    expect(expense).toEqual({
      ...lunch(group, { notes: "Tacos" }),
      id: expect.any(String),
      createdAt: expect.any(String),
    });
    expect((await repo.getGroup(group.id))?.expenses).toEqual([expense]);
  });

  it("keeps a foreign-currency Expense's Locked Rate and whether it was manual", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Tokyo", description: "", currency: "USD" });
    const me = group.members[0].id;
    const ryokan = { currency: "JPY" as const, amount: 84000, shares: [{ memberId: me, amount: 84000 }] };

    const manual = await repo.addExpense(group.id, lunch(group, { ...ryokan, lockedRate: "0.0068", manualRate: true }));
    const automatic = await repo.addExpense(group.id, lunch(group, { ...ryokan, lockedRate: "0.00670017" }));

    expect(manual).toMatchObject({ currency: "JPY", lockedRate: "0.0068", manualRate: true });
    expect(automatic?.manualRate).toBeUndefined();
    expect((await repo.getGroup(group.id))?.expenses).toEqual([manual, automatic]);
  });

  it("edits an Expense, keeping its id and creation time", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const original = await repo.addExpense(group.id, lunch(group, { notes: "Tacos" }));

    const edited = await repo.updateExpense(
      group.id,
      original!.id,
      lunch(group, { description: "Dinner", amount: 9000, shares: [{ memberId: group.members[0].id, amount: 9000 }], date: "2026-03-02", category: "Other" }),
    );

    expect(edited).toEqual({
      ...lunch(group, { description: "Dinner", amount: 9000, shares: [{ memberId: group.members[0].id, amount: 9000 }], date: "2026-03-02", category: "Other" }),
      id: original!.id,
      createdAt: original!.createdAt,
    });
    expect((await repo.getGroup(group.id))?.expenses).toEqual([edited]);
  });

  it("keeps the percentages and ratios a Split was entered with", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const me = group.members[0].id;
    const byPercentage = lunch(group, {
      splitType: "percentage",
      shares: [{ memberId: me, amount: 2450, percentage: "100" }],
    });
    const added = await repo.addExpense(group.id, byPercentage);
    expect((await repo.getGroup(group.id))?.expenses).toEqual([
      { ...byPercentage, id: added!.id, createdAt: added!.createdAt },
    ]);

    const byRatio = lunch(group, {
      splitType: "shares",
      shares: [{ memberId: me, amount: 2450, ratio: "1.5" }],
    });
    await repo.updateExpense(group.id, added!.id, byRatio);
    expect((await repo.getGroup(group.id))?.expenses).toEqual([
      { ...byRatio, id: added!.id, createdAt: added!.createdAt },
    ]);
  });

  it("deletes an Expense", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const kept = await repo.addExpense(group.id, lunch(group));
    const gone = await repo.addExpense(group.id, lunch(group, { description: "Oops" }));

    expect(await repo.deleteExpense(group.id, gone!.id)).toBe(true);
    expect((await repo.getGroup(group.id))?.expenses).toEqual([kept]);
  });

  it("refuses to change Expenses that aren't in the Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const other = await repo.createGroup({ name: "Other", description: "", currency: "USD" });
    const expense = await repo.addExpense(other.id, lunch(other));

    expect(await repo.addExpense("grp_missing", lunch(group))).toBeNull();
    expect(await repo.updateExpense(group.id, expense!.id, lunch(group))).toBeNull();
    expect(await repo.deleteExpense(group.id, expense!.id)).toBe(false);
    expect((await repo.getGroup(other.id))?.expenses).toEqual([expense]);
  });

  it("edits a Group's name, description and Group Currency", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    const edited = await repo.updateGroup(group.id, {
      name: "Flat 3B",
      description: "Rent and bills",
      currency: "EUR",
    });

    expect(edited).toEqual({ ...group, name: "Flat 3B", description: "Rent and bills", currency: "EUR" });
    expect(await repo.getGroup(group.id)).toEqual(edited);
  });

  it("adds Name-only Members, each keeping its own avatar colour", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    const chloe = await repo.addMember(group.id, { name: "Chloe Park" });
    const dev = await repo.addMember(group.id, { name: "Dev Shah" });

    expect(chloe).toEqual({ id: expect.any(String), name: "Chloe Park", avatarColor: expect.any(String) });
    const colours = [group.members[0], chloe!, dev!].map((m) => m.avatarColor);
    expect(new Set(colours).size).toBe(3);
    expect((await repo.getGroup(group.id))?.members).toEqual([group.members[0], chloe, dev]);
  });

  it("keeps the email a Member is added by", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    const chloe = await repo.addMember(group.id, { name: "Chloe Park", email: "chloe@nowhere.test" });

    expect(chloe).toEqual({
      id: expect.any(String),
      name: "Chloe Park",
      email: "chloe@nowhere.test",
      avatarColor: expect.any(String),
    });
    expect((await repo.getGroup(group.id))?.members).toEqual([group.members[0], chloe]);
  });

  it("gives a Name-only Member an email, keeping their place on past Expenses", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const chloe = await repo.addMember(group.id, { name: "Chloe Park" });
    const past = await repo.addExpense(group.id, lunch(group, { payerId: chloe!.id }));

    const updated = await repo.setMemberEmail(group.id, chloe!.id, "chloe@nowhere.test");

    expect(updated).toEqual({ ...chloe, email: "chloe@nowhere.test" });
    const after = await repo.getGroup(group.id);
    expect(after?.members).toEqual([group.members[0], updated]);
    expect(after?.expenses).toEqual([past]);
    expect(await repo.setMemberEmail(group.id, "mem_missing", "x@nowhere.test")).toBeNull();
  });

  it("removes a Member by making them a Former Member, still on past Expenses", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const chloe = await repo.addMember(group.id, { name: "Chloe Park" });
    const past = await repo.addExpense(group.id, lunch(group, { payerId: chloe!.id }));

    expect(await repo.removeMember(group.id, chloe!.id)).toBe(true);

    const after = await repo.getGroup(group.id);
    expect(after?.members).toEqual([group.members[0], { ...chloe, former: true }]);
    expect(after?.expenses).toEqual([past]);
  });

  it.skipIf(!users)(
    "shows a Linked Member under their User's current name in every Group, Former Members included, recording no Activity",
    async () => {
      const repo = await makeRepository();
      const theo = await users!.aUser();
      const { flat, me, chloe, pending, former } = await everyKindOfMember(repo, theo);
      const trip = await repo.createGroup({ name: "Trip", description: "", currency: "EUR" });
      const activity = await repo.listActivity(flat.id);

      await users!.rename(me.userId!, "Maya R.");
      await users!.rename(theo.id, "Theo Park");

      // Name-only and Pending Members keep the names they were added by.
      expect((await repo.getGroup(flat.id))?.members).toEqual([
        { ...me, name: "Maya R." },
        chloe,
        pending,
        { ...former, name: "Theo Park" },
      ]);
      expect((await repo.getGroup(trip.id))?.members[0].name).toBe("Maya R.");
      expect((await repo.listGroups()).map((g) => g.members[0].name)).toEqual(["Maya R.", "Maya R."]);
      expect(await repo.listActivity(flat.id)).toEqual(activity);
    },
  );

  it.skipIf(users)("shows no avatar images in a Guest's Groups", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    await repo.addMember(group.id, { name: "Chloe Park" });

    expect((await repo.getGroup(group.id))?.members.map((m) => m.avatarUrl)).toEqual([undefined, undefined]);
  });

  it.skipIf(!users)("shows a Linked Member's avatar, Former Members included, and nobody else's", async () => {
    const repo = await makeRepository();
    const theo = await users!.aUser();
    const { flat, me, chloe, pending, former } = await everyKindOfMember(repo, theo);
    const activity = await repo.listActivity(flat.id);

    const mine = await users!.setAvatar(me.userId!);
    const theos = await users!.setAvatar(theo.id);

    // Name-only and Pending Members have no avatar: they have no User.
    expect((await repo.getGroup(flat.id))?.members).toEqual([
      { ...me, avatarUrl: mine },
      chloe,
      pending,
      { ...former, avatarUrl: theos },
    ]);
    expect((await repo.listGroups())[0].members[0].avatarUrl).toBe(mine);
    expect(await repo.listActivity(flat.id)).toEqual(activity);

    await users!.removeAvatar(me.userId!);
    await users!.removeAvatar(theo.id);
    expect((await repo.getGroup(flat.id))?.members).toEqual([me, chloe, pending, former]);
  });

  it("deletes a Group with everything in it", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    await repo.addExpense(group.id, lunch(group));

    expect(await repo.deleteGroup(group.id)).toBe(true);
    expect(await repo.getGroup(group.id)).toBeNull();
    expect((await repo.listGroups()).map((g) => g.id)).not.toContain(group.id);
  });

  it("refuses to manage Groups and Members that don't exist", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const other = await repo.createGroup({ name: "Other", description: "", currency: "USD" });

    expect(await repo.updateGroup("grp_missing", { name: "X", description: "", currency: "USD" })).toBeNull();
    expect(await repo.addMember("grp_missing", { name: "Chloe" })).toBeNull();
    expect(await repo.removeMember(group.id, other.members[0].id)).toBe(false);
    expect(await repo.deleteGroup("grp_missing")).toBe(false);
    expect((await repo.getGroup(other.id))?.members).toEqual(other.members);
  });

  it("records and deletes Settlements", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const chloe = await repo.addMember(group.id, { name: "Chloe" });
    const me = group.members[0].id;
    await repo.addExpense(group.id, lunch(group, { shares: [{ memberId: chloe!.id, amount: 2450 }] }));

    const first = await repo.addSettlement(group.id, { fromId: chloe!.id, toId: me, amount: 1000, date: "2026-03-02" });
    const second = await repo.addSettlement(group.id, { fromId: chloe!.id, toId: me, amount: 450, date: "2026-03-03" });

    expect(first).toEqual({
      id: expect.any(String),
      fromId: chloe!.id,
      toId: me,
      amount: 1000,
      date: "2026-03-02",
      createdAt: expect.any(String),
    });
    expect((await repo.getGroup(group.id))?.settlements).toEqual(expect.arrayContaining([first, second]));

    expect(await repo.deleteSettlement(group.id, first!.id)).toBe(true);
    expect((await repo.getGroup(group.id))?.settlements).toEqual([second]);
  });

  it("refuses to change Settlements that aren't in the Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const other = await repo.createGroup({ name: "Other", description: "", currency: "USD" });
    const chloe = await repo.addMember(other.id, { name: "Chloe" });
    const settlement = await repo.addSettlement(other.id, {
      fromId: chloe!.id,
      toId: other.members[0].id,
      amount: 100,
      date: "2026-03-02",
    });

    expect(
      await repo.addSettlement("grp_missing", { fromId: "a", toId: "b", amount: 100, date: "2026-03-02" }),
    ).toBeNull();
    expect(await repo.deleteSettlement(group.id, settlement!.id)).toBe(false);
    expect((await repo.getGroup(other.id))?.settlements).toEqual([settlement]);
  });

  it("adds, renames and deletes a Group's Custom Categories, oldest first", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const other = await repo.createGroup({ name: "Trip", description: "", currency: "USD" });

    const cleaning = await repo.addCategory(group.id, "Cleaning");
    const pets = await repo.addCategory(group.id, "Pets");
    expect(cleaning).toEqual({ id: expect.any(String), name: "Cleaning" });
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([cleaning, pets]);
    expect((await repo.getGroup(other.id))?.customCategories ?? []).toEqual([]);

    const past = await repo.addExpense(group.id, lunch(group, { category: cleaning!.id }));
    const renamed = await repo.renameCategory(group.id, cleaning!.id, "Cleaning supplies");
    expect(renamed).toEqual({ id: cleaning!.id, name: "Cleaning supplies" });
    const after = await repo.getGroup(group.id);
    expect(after?.customCategories).toEqual([renamed, pets]);
    expect(after?.expenses).toEqual([past]);

    expect(await repo.deleteCategory(group.id, pets!.id)).toBe(true);
    expect((await repo.getGroup(group.id))?.customCategories).toEqual([renamed]);
  });

  it("refuses to change Custom Categories that aren't in the Group", async () => {
    const repo = await makeRepository();
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
    const other = await repo.createGroup({ name: "Trip", description: "", currency: "USD" });
    const theirs = await repo.addCategory(other.id, "Souvenirs");

    expect(await repo.addCategory("grp_missing", "Pets")).toBeNull();
    expect(await repo.renameCategory(group.id, theirs!.id, "Mine")).toBeNull();
    expect(await repo.deleteCategory(group.id, theirs!.id)).toBe(false);
    expect((await repo.getGroup(other.id))?.customCategories).toEqual([theirs]);
  });

  describe("Activity", () => {
    it("records adding an Expense: who added it, when, and the Expense", async () => {
      const repo = await makeRepository();
      const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
      const before = new Date().toISOString();

      const expense = await repo.addExpense(group.id, lunch(group));

      const activity = await repo.listActivity(group.id);
      expect(activity).toEqual([
        {
          id: expect.any(String),
          at: expect.any(String),
          ...(actorOf(group) ? { actorMemberId: actorOf(group) } : {}),
          change: { kind: "expense-added", expense },
        },
      ]);
      expect(activity![0].at >= before).toBe(true);
    });

    it("records an edit with the Expense before and after, newest first, and nothing for an edit that changes nothing", async () => {
      const repo = await makeRepository();
      const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
      const before = await repo.addExpense(group.id, lunch(group));

      const after = await repo.updateExpense(group.id, before!.id, lunch(group, { description: "Brunch" }));
      await repo.updateExpense(group.id, before!.id, lunch(group, { description: "Brunch" }));

      const activity = await repo.listActivity(group.id);
      expect(activity?.map((a) => a.change)).toEqual([
        { kind: "expense-edited", before, after },
        { kind: "expense-added", expense: before },
      ]);
    });

    it("records deleting an Expense and adding and deleting a Settlement, as they were", async () => {
      const repo = await makeRepository();
      const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
      const chloe = await repo.addMember(group.id, { name: "Chloe" });
      const me = group.members[0].id;
      const expense = await repo.addExpense(group.id, lunch(group, { shares: [{ memberId: chloe!.id, amount: 2450 }] }));
      const settlement = await repo.addSettlement(group.id, { fromId: chloe!.id, toId: me, amount: 1000, date: "2026-03-02" });

      await repo.deleteSettlement(group.id, settlement!.id);
      await repo.deleteExpense(group.id, expense!.id);

      expect((await repo.listActivity(group.id))?.map((a) => a.change)).toEqual([
        { kind: "expense-deleted", expense },
        { kind: "settlement-deleted", settlement },
        { kind: "settlement-added", settlement },
        { kind: "expense-added", expense },
      ]);
    });

    it("records nothing for changes refused, and deletes Activity with its Group", async () => {
      const repo = await makeRepository();
      const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
      await repo.addExpense(group.id, lunch(group));

      await repo.deleteExpense(group.id, "exp_missing");
      await repo.updateExpense(group.id, "exp_missing", lunch(group));
      await repo.deleteSettlement(group.id, "stl_missing");
      expect(await repo.listActivity(group.id)).toHaveLength(1);

      await repo.deleteGroup(group.id);
      expect(await repo.listActivity(group.id)).toBeNull();
      expect(await repo.listActivity("grp_missing")).toBeNull();
    });
  });
}
