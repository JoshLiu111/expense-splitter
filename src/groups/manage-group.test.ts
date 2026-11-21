import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/lib/memory-storage";
import { computeLedger, type EditingMode, type GroupSnapshot, type Visitor } from "@/domain";
import type { GroupRepository } from "./group-repository";
import {
  addMember,
  changeCurrency,
  deleteGroup,
  removeMember,
  resendInvitation,
  setEditingMode,
  setMemberEmail,
  updateGroupDetails,
} from "./manage-group";
import type { MemberNotifier } from "./member-notifier";

afterEach(() => vi.restoreAllMocks());

/** The Guest: Group Creator of every session Group, so never restricted. */
const GUEST = { userId: undefined };

/** A Group with "You" and Chloe, where Chloe owes You $10.00. */
async function flatWithDebt() {
  const repo = createSessionStorageRepository(memoryStorage(), () => []);
  const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });
  const you = group.members[0];
  const chloe = (await repo.addMember(group.id, { name: "Chloe" }))!;
  await repo.addExpense(group.id, {
    description: "Pizza",
    amount: 1000,
    currency: "USD",
    lockedRate: "1",
    payerId: you.id,
    splitType: "exact",
    shares: [{ memberId: chloe.id, amount: 1000 }],
    date: "2026-03-01",
    category: "Food & Drink",
  });
  return { repo, group, you, chloe };
}

/** A repository that Links any email to a User called Theo Park, as Postgres does for a verified email. */
function linkingAll(repo: GroupRepository): GroupRepository {
  const link = <T extends { email?: string } | null>(member: T) =>
    member && member.email ? { ...member, name: "Theo Park", userId: "usr_theo" } : member;
  return {
    ...repo,
    addMember: async (groupId, member) => link(await repo.addMember(groupId, member)),
    setMemberEmail: async (groupId, memberId, email) => link(await repo.setMemberEmail(groupId, memberId, email)),
  };
}

/** A notifier that records the Invitations it sent and whom it told they were added. */
function recordingNotifier() {
  const added: Parameters<MemberNotifier["added"]>[0][] = [];
  const invited: Parameters<MemberNotifier["invited"]>[0][] = [];
  const notifier: MemberNotifier = {
    async invited(args) {
      invited.push(args);
    },
    async added(args) {
      added.push(args);
    },
  };
  return { notifier, added, invited };
}

/** A notifier whose email service is down for one kind of email. */
function failingNotifier(kind: keyof MemberNotifier): MemberNotifier {
  return { ...recordingNotifier().notifier, [kind]: () => Promise.reject(new Error("Resend is down")) };
}

/**
 * A repository that issues Invitations to Pending Members as Postgres does
 * (a Guest's issues none), numbering the tokens `tok_1`, `tok_2`, ..., and
 * pushing the token of each one recorded as sent onto `sent`.
 */
function issuingInvitations(repo: GroupRepository, sent: string[] = []): GroupRepository {
  let issued = 0;
  return {
    ...repo,
    async issueInvitation(groupId, memberId) {
      const member = (await repo.getGroup(groupId))?.members.find((m) => m.id === memberId);
      if (!member?.email || member.userId || member.former) return null;
      issued += 1;
      return `tok_${issued}`;
    },
    async recordInvitationSent(_groupId, token) {
      sent.push(token);
      return true;
    },
  };
}

describe("updateGroupDetails", () => {
  it("saves a new name and description", async () => {
    const { repo, group } = await flatWithDebt();

    expect(
      await updateGroupDetails(repo, group.id, { name: "Flat 3B", description: "Bills", currency: "USD" }, GUEST),
    ).toEqual({ ok: true });
    expect(await repo.getGroup(group.id)).toMatchObject({ name: "Flat 3B", description: "Bills" });
  });

  it("never changes the Group Currency, whatever the caller sends", async () => {
    const { repo, group } = await flatWithDebt();

    expect(
      await updateGroupDetails(repo, group.id, { name: "Flat", description: "", currency: "EUR" }, GUEST),
    ).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.currency).toBe("USD");
  });

  it("treats malformed input as empty fields", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await updateGroupDetails(repo, group.id, { name: 42 }, GUEST)).toMatchObject({
      ok: false,
      errors: { name: "Enter a name for the Group." },
    });
  });
});

describe("changeCurrency", () => {
  it("converts every Expense at the rate given, so Balances scale by it", async () => {
    const { repo, group, you, chloe } = await flatWithDebt();

    expect(await changeCurrency(repo, group.id, { from: "USD", to: "JPY", rate: "150" }, GUEST)).toEqual({ ok: true });

    const yen = (await repo.getGroup(group.id))!;
    expect(yen.currency).toBe("JPY");
    expect(computeLedger(yen).balances).toEqual([
      { memberId: you.id, amount: 1500 },
      { memberId: chloe.id, amount: -1500 },
    ]);
  });

  it("refuses anyone but the Group Creator, in any Editing Mode, leaving the Group unchanged", async () => {
    const { repo, group } = await flatWithDebt();
    const before = await repo.getGroup(group.id);

    expect(await changeCurrency(repo, group.id, { from: "USD", to: "JPY", rate: "150" }, { userId: "usr_theo" })).toEqual({
      ok: false,
      errors: { form: "Only the Group Creator can change the Group Currency." },
    });
    expect(await repo.getGroup(group.id)).toEqual(before);
  });

  it("converts only once when the same change is sent twice", async () => {
    const { repo, group } = await flatWithDebt();
    const change = { from: "USD", to: "JPY", rate: "150" };

    const [first, second] = await Promise.all([
      changeCurrency(repo, group.id, change, GUEST),
      changeCurrency(repo, group.id, change, GUEST),
    ]);

    expect([first, second]).toContainEqual({ ok: true });
    expect((await repo.getGroup(group.id))!.expenses[0].lockedRate).toBe("150");
  });

  it("says the Group Currency changed since, when another change got there first", async () => {
    const { repo, group } = await flatWithDebt();
    await changeCurrency(repo, group.id, { from: "USD", to: "EUR", rate: "0.925" }, GUEST);

    expect(await changeCurrency(repo, group.id, { from: "USD", to: "JPY", rate: "150" }, GUEST)).toEqual({
      ok: false,
      errors: { form: "The Group Currency has changed since this page loaded. Check the new Balances again." },
    });
    expect((await repo.getGroup(group.id))!.currency).toBe("EUR");
  });

  it("explains a missing rate and treats malformed input as empty fields", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await changeCurrency(repo, group.id, { from: "USD", to: "JPY", rate: 150 }, GUEST)).toEqual({
      ok: false,
      errors: { rate: "Enter the rate as a number, like 0.0067." },
    });
    expect(await changeCurrency(repo, group.id, null, GUEST)).toMatchObject({ ok: false });
    expect((await repo.getGroup(group.id))!.currency).toBe("USD");
  });
});

describe("addMember", () => {
  it("adds a Name-only Member who can then share Expenses", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, { name: " Dev ", email: "" }, GUEST)).toEqual({ ok: true, name: "Dev" });
    expect((await repo.getGroup(group.id))?.members.map((m) => m.name)).toEqual(["You", "Chloe", "Dev"]);
  });

  it("explains a duplicate name", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, { name: "chloe" }, GUEST)).toEqual({
      ok: false,
      errors: { name: "Chloe is already a Member of this Group." },
    });
  });

  it("adds a Member by email, lower-cased", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, { name: "Dev", email: " Dev@Example.com" }, GUEST)).toEqual({ ok: true, name: "Dev" });
    expect((await repo.getGroup(group.id))?.members.at(-1)).toMatchObject({ name: "Dev", email: "dev@example.com" });
  });

  it("explains a bad name and a bad email together", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, { name: "", email: "dev" }, GUEST)).toEqual({
      ok: false,
      errors: { name: "Enter the Member's name.", email: "Enter an email address like name@example.com." },
    });
  });

  it("refuses an email another Member of the Group already has", async () => {
    const { repo, group } = await flatWithDebt();
    await addMember(repo, group.id, { name: "Dev", email: "dev@example.com" }, GUEST);

    expect(await addMember(repo, group.id, { name: "Devin", email: "DEV@example.com" }, GUEST)).toEqual({
      ok: false,
      errors: { email: "Dev already has that email in this Group." },
    });
  });

  it("answers the name a Linked Member is shown under: their User's, not the one typed", async () => {
    const { repo, group } = await flatWithDebt();
    // A repository that Links the email to a User called Theo Park, as Postgres does.
    const linking: typeof repo = {
      ...repo,
      async addMember(groupId, member) {
        const added = await repo.addMember(groupId, member);
        return added && { ...added, name: "Theo Park", userId: "usr_theo" };
      },
    };

    expect(await addMember(linking, group.id, { name: "Theo", email: "theo@example.com" }, GUEST)).toEqual({
      ok: true,
      name: "Theo Park",
    });
  });

  it("tells an existing User they were added, naming the Group", async () => {
    const { repo, group } = await flatWithDebt();
    const { notifier, added } = recordingNotifier();

    expect(await addMember(linkingAll(repo), group.id, { name: "Theo", email: "Theo@example.com" }, GUEST, notifier)).toEqual({
      ok: true,
      name: "Theo Park",
    });
    expect(added).toEqual([
      { groupId: group.id, groupName: "Flat", email: "theo@example.com" },
    ]);
  });

  it("tells nobody they were added when the Member is Pending or Name-only", async () => {
    const { repo, group } = await flatWithDebt();
    const { notifier, added } = recordingNotifier();

    await addMember(repo, group.id, { name: "Dev", email: "dev@example.com" }, GUEST, notifier);
    await addMember(repo, group.id, { name: "Eve", email: "" }, GUEST, notifier);

    expect(added).toEqual([]);
  });

  it("keeps the added Member when telling them fails", async () => {
    const { repo, group } = await flatWithDebt();
    const failing = failingNotifier("added");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await addMember(linkingAll(repo), group.id, { name: "Theo", email: "theo@example.com" }, GUEST, failing)).toEqual({
      ok: true,
      name: "Theo Park",
    });
    expect((await repo.getGroup(group.id))?.members.at(-1)).toMatchObject({ email: "theo@example.com" });
  });

  it("sends a Pending Member an Invitation, naming the Group", async () => {
    const { repo, group } = await flatWithDebt();
    const { notifier, invited } = recordingNotifier();

    expect(
      await addMember(issuingInvitations(repo), group.id, { name: "Dev", email: "Dev@example.com" }, GUEST, notifier),
    ).toEqual({ ok: true, name: "Dev", invitationSent: true });

    expect(invited).toEqual([
      {
        groupId: group.id,
        groupName: "Flat",
        email: "dev@example.com",
        token: "tok_1",
      },
    ]);
  });

  it("records the Invitation as sent once it is emailed, and not when sending fails", async () => {
    const { repo, group } = await flatWithDebt();
    const sent: string[] = [];
    const failing = failingNotifier("invited");
    vi.spyOn(console, "error").mockImplementation(() => {});

    await addMember(issuingInvitations(repo, sent), group.id, { name: "Dev", email: "dev@example.com" }, GUEST, failing);
    expect(sent).toEqual([]);
    await addMember(
      issuingInvitations(repo, sent),
      group.id,
      { name: "Eve", email: "eve@example.com" },
      GUEST,
      recordingNotifier().notifier,
    );
    expect(sent).toEqual(["tok_1"]);
  });

  it("sends no Invitation for a Name-only Member, nor where no Invitation is issued, as for a Guest", async () => {
    const { repo, group } = await flatWithDebt();
    const { notifier, invited } = recordingNotifier();

    await addMember(issuingInvitations(repo), group.id, { name: "Eve", email: "" }, GUEST, notifier);
    await addMember(repo, group.id, { name: "Dev", email: "dev@example.com" }, GUEST, notifier);

    expect(invited).toEqual([]);
    expect((await repo.getGroup(group.id))!.members.at(-1)).toMatchObject({ email: "dev@example.com" });
  });

  it("keeps the Pending Member when sending the Invitation fails", async () => {
    const { repo, group } = await flatWithDebt();
    const failing = failingNotifier("invited");
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Answered at once, so the Member adding them hears it wasn't sent.
    expect(
      await addMember(issuingInvitations(repo), group.id, { name: "Dev", email: "dev@example.com" }, GUEST, failing),
    ).toEqual({ ok: true, name: "Dev", invitationSent: false });
    expect((await repo.getGroup(group.id))!.members.at(-1)).toMatchObject({ name: "Dev", email: "dev@example.com" });
    expect(console.error).toHaveBeenCalled();
  });

  it("treats malformed input as empty fields", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await addMember(repo, group.id, 42, GUEST)).toEqual({
      ok: false,
      errors: { name: "Enter the Member's name." },
    });
  });
});

describe("setMemberEmail", () => {
  it("gives a Name-only Member an email, keeping their Balance", async () => {
    const { repo, group, chloe } = await flatWithDebt();

    expect(await setMemberEmail(repo, group.id, chloe.id, "chloe@example.com", GUEST)).toEqual({ ok: true });
    const after = await repo.getGroup(group.id);
    expect(after?.members.find((m) => m.id === chloe.id)?.email).toBe("chloe@example.com");
    expect(after?.expenses).toHaveLength(1);
  });

  it("requires an email, and a valid one", async () => {
    const { repo, group, chloe } = await flatWithDebt();

    expect(await setMemberEmail(repo, group.id, chloe.id, " ", GUEST)).toEqual({
      ok: false,
      errors: { email: "Enter the Member's email address." },
    });
    expect(await setMemberEmail(repo, group.id, chloe.id, "chloe", GUEST)).toEqual({
      ok: false,
      errors: { email: "Enter an email address like name@example.com." },
    });
  });

  it("tells an existing User they were added when a Name-only Member is given their email", async () => {
    const { repo, group, chloe } = await flatWithDebt();
    const { notifier, added } = recordingNotifier();

    expect(await setMemberEmail(linkingAll(repo), group.id, chloe.id, "chloe@example.com", GUEST, notifier)).toEqual({
      ok: true,
    });
    expect(added).toEqual([
      { groupId: group.id, groupName: "Flat", email: "chloe@example.com" },
    ]);
  });

  it("tells nobody they were added when the Member stays Pending", async () => {
    const { repo, group, chloe } = await flatWithDebt();
    const { notifier, added } = recordingNotifier();

    await setMemberEmail(repo, group.id, chloe.id, "chloe@example.com", GUEST, notifier);

    expect(added).toEqual([]);
  });

  it("sends an Invitation when a Name-only Member is given an email no User has", async () => {
    const { repo, group, chloe } = await flatWithDebt();
    const { notifier, invited } = recordingNotifier();

    expect(
      await setMemberEmail(issuingInvitations(repo), group.id, chloe.id, "chloe@example.com", GUEST, notifier),
    ).toEqual({ ok: true, invitationSent: true });
    expect(invited).toEqual([
      {
        groupId: group.id,
        groupName: "Flat",
        email: "chloe@example.com",
        token: "tok_1",
      },
    ]);
  });

  it("keeps the email but says so when the Invitation couldn't be sent", async () => {
    const { repo, group, chloe } = await flatWithDebt();
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      await setMemberEmail(issuingInvitations(repo), group.id, chloe.id, "chloe@example.com", GUEST, failingNotifier("invited")),
    ).toEqual({ ok: true, invitationSent: false });
    expect((await repo.getGroup(group.id))?.members.find((m) => m.id === chloe.id)?.email).toBe("chloe@example.com");
  });

  it("refuses a Former Member", async () => {
    const { repo, group } = await flatWithDebt();
    const dev = (await repo.addMember(group.id, { name: "Dev" }))!;
    await repo.removeMember(group.id, dev.id);

    expect(await setMemberEmail(repo, group.id, dev.id, "dev@example.com", GUEST)).toEqual({
      ok: false,
      errors: { form: "Dev has been removed from this Group." },
    });
  });
});

describe("resendInvitation", () => {
  /** Flat with Dev, a Pending Member whose first Invitation (`tok_1`) was never sent. */
  async function withPendingDev() {
    const { repo, group, chloe } = await flatWithDebt();
    const sent: string[] = [];
    const issuing = issuingInvitations(repo, sent);
    const dev = (await repo.addMember(group.id, { name: "Dev", email: "dev@example.com" }))!;
    await issuing.issueInvitation(group.id, dev.id);
    return { repo: issuing, group, chloe, dev, sent };
  }

  it("emails a Pending Member a new Invitation and records it as sent", async () => {
    const { repo, group, dev, sent } = await withPendingDev();
    const { notifier, invited } = recordingNotifier();

    expect(await resendInvitation(repo, group.id, dev.id, GUEST, notifier)).toEqual({ ok: true });

    expect(invited).toEqual([
      {
        groupId: group.id,
        groupName: "Flat",
        email: "dev@example.com",
        token: "tok_2",
      },
    ]);
    expect(sent).toEqual(["tok_2"]);
  });

  it("says so when the Invitation couldn't be sent, so it can be tried again", async () => {
    const { repo, group, dev, sent } = await withPendingDev();
    const failing = failingNotifier("invited");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await resendInvitation(repo, group.id, dev.id, GUEST, failing)).toEqual({
      ok: false,
      errors: { form: "The Invitation couldn't be sent. Try again in a moment." },
    });
    expect(sent).toEqual([]);
  });

  it("refuses a Member who isn't a Pending Member", async () => {
    const { repo, group, chloe } = await withPendingDev();
    const { notifier, invited } = recordingNotifier();

    expect(await resendInvitation(repo, group.id, chloe.id, GUEST, notifier)).toEqual({
      ok: false,
      errors: { form: "Only a Pending Member is sent an Invitation." },
    });
    expect(await resendInvitation(repo, "grp_missing", chloe.id, GUEST, notifier)).toEqual({
      ok: false,
      errors: { form: "This Group is no longer available." },
    });
    expect(invited).toEqual([]);
  });
});

describe("removeMember", () => {
  it("refuses to remove a Member whose Balance isn't zero", async () => {
    const { repo, group, chloe } = await flatWithDebt();

    expect(await removeMember(repo, group.id, chloe.id, GUEST)).toEqual({
      ok: false,
      errors: { form: "Chloe can't be removed until their Balance is zero." },
    });
    expect((await repo.getGroup(group.id))?.members.find((m) => m.id === chloe.id)?.former).toBeFalsy();
  });

  it("makes a Member with a zero Balance a Former Member", async () => {
    const { repo, group } = await flatWithDebt();
    const dev = (await repo.addMember(group.id, { name: "Dev" }))!;

    expect(await removeMember(repo, group.id, dev.id, GUEST)).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))?.members.find((m) => m.id === dev.id)?.former).toBe(true);
  });
});

describe("deleteGroup", () => {
  it("refuses to delete a Group that isn't Settled Up", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await deleteGroup(repo, group.id, { userId: undefined })).toEqual({
      ok: false,
      errors: { form: "Everyone must be Settled Up before this Group can be deleted." },
    });
    expect(await repo.getGroup(group.id)).not.toBeNull();
  });

  it("refuses a User who isn't the Group Creator", async () => {
    const repo = createSessionStorageRepository(memoryStorage(), () => []);
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    // Guest Groups have no Group Creator User, so no signed-in User created it.
    expect(await deleteGroup(repo, group.id, { userId: "usr_theo" })).toMatchObject({ ok: false });
  });

  it("lets the Guest delete their Settled Up Group", async () => {
    const repo = createSessionStorageRepository(memoryStorage(), () => []);
    const group = await repo.createGroup({ name: "Flat", description: "", currency: "USD" });

    expect(await deleteGroup(repo, group.id, { userId: undefined })).toEqual({ ok: true });
    expect(await repo.getGroup(group.id)).toBeNull();
  });
});

describe("setEditingMode", () => {
  it("lets the Group Creator switch to Own Records Only and back", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await setEditingMode(repo, group.id, "own-records-only", { userId: undefined })).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))!.editingMode).toBe("own-records-only");
    expect(await setEditingMode(repo, group.id, "open", { userId: undefined })).toEqual({ ok: true });
    expect((await repo.getGroup(group.id))!.editingMode).toBe("open");
  });

  it("refuses anyone but the Group Creator, and anything but an Editing Mode", async () => {
    const { repo, group } = await flatWithDebt();

    expect(await setEditingMode(repo, group.id, "own-records-only", { userId: "usr_theo" })).toEqual({
      ok: false,
      errors: { form: "Only the Group Creator can change the Editing Mode." },
    });
    expect(await setEditingMode(repo, group.id, "admins-only", { userId: undefined })).toEqual({
      ok: false,
      errors: { form: "Choose an Editing Mode." },
    });
    expect((await repo.getGroup(group.id))!.editingMode).toBe("open");
  });
});

describe("Group management by Editing Mode", () => {
  /** Alex created the Group; Sam is a Linked Member, Kim Name-only, Pat Pending. */
  function flatOf(editingMode: EditingMode) {
    const group: GroupSnapshot = {
      id: "grp_flat",
      name: "Flat",
      description: "",
      currency: "USD",
      creatorUserId: "user_alex",
      editingMode,
      members: [
        { id: "mem_alex", name: "Alex", userId: "user_alex", avatarColor: "#3B82F6" },
        { id: "mem_sam", name: "Sam", userId: "user_sam", avatarColor: "#10B981" },
        { id: "mem_kim", name: "Kim", avatarColor: "#F59E0B" },
        { id: "mem_pat", name: "Pat", email: "pat@example.com", avatarColor: "#EF4444" },
      ],
      expenses: [],
      settlements: [],
    };
    return issuingInvitations(createSessionStorageRepository(memoryStorage(), () => [group]));
  }
  const alex = { userId: "user_alex" };
  const sam = { userId: "user_sam" };

  const ACTIONS: [string, (repo: GroupRepository, visitor: Visitor) => Promise<{ ok: boolean }>][] = [
    [
      "updateGroupDetails",
      (repo, visitor) =>
        updateGroupDetails(repo, "grp_flat", { name: "Flat 3B", description: "Bills", currency: "USD" }, visitor),
    ],
    ["addMember", (repo, visitor) => addMember(repo, "grp_flat", { name: "Dev", email: "" }, visitor)],
    ["setMemberEmail", (repo, visitor) => setMemberEmail(repo, "grp_flat", "mem_kim", "kim@example.com", visitor)],
    [
      "resendInvitation",
      (repo, visitor) => resendInvitation(repo, "grp_flat", "mem_pat", visitor, recordingNotifier().notifier),
    ],
    ["removeMember", (repo, visitor) => removeMember(repo, "grp_flat", "mem_kim", visitor)],
  ];

  it("keeps changing the Group Currency to the Group Creator in either Editing Mode", async () => {
    const change = { from: "USD", to: "EUR", rate: "" };
    for (const mode of ["open", "own-records-only"] as const) {
      expect(await changeCurrency(flatOf(mode), "grp_flat", change, sam)).toEqual({
        ok: false,
        errors: { form: "Only the Group Creator, Alex, can change the Group Currency." },
      });
      expect(await changeCurrency(flatOf(mode), "grp_flat", change, alex)).toEqual({ ok: true });
    }
  });

  it.each(ACTIONS)("%s: in Own Records Only, refuses a Member who isn't the Group Creator", async (_name, act) => {
    const repo = flatOf("own-records-only");
    const before = await repo.getGroup("grp_flat");

    expect(await act(repo, sam)).toEqual({
      ok: false,
      errors: {
        form: expect.stringMatching(/^This Group is set to Own Records Only: only the Group Creator, Alex, can /),
      },
    });
    expect(await repo.getGroup("grp_flat")).toEqual(before);
  });

  it.each(ACTIONS)("%s: in Own Records Only, lets the Group Creator", async (_name, act) => {
    expect(await act(flatOf("own-records-only"), alex)).toMatchObject({ ok: true });
  });

  it.each(ACTIONS)("%s: in Open, lets any Member", async (_name, act) => {
    expect(await act(flatOf("open"), sam)).toMatchObject({ ok: true });
    expect(await act(flatOf("open"), alex)).toMatchObject({ ok: true });
  });

  it("still keeps deleting the Group and changing the Editing Mode to the Group Creator in Open", async () => {
    const repo = flatOf("open");
    expect(await setEditingMode(repo, "grp_flat", "own-records-only", sam)).toMatchObject({ ok: false });
    expect(await deleteGroup(repo, "grp_flat", sam)).toEqual({
      ok: false,
      errors: { form: "Only the Group Creator, Alex, can delete this Group." },
    });
    expect(await repo.getGroup("grp_flat")).not.toBeNull();
  });
});
