import {
  changedGroupDetails,
  changeGroupCurrency,
  editingModeOf,
  isSameExpense,
  type ActivityChange,
  type ActivityEntry,
  type CustomCategory,
  type Expense,
  type GroupSnapshot,
  type Member,
  type Settlement,
} from "@/domain";
import {
  AVATAR_COLORS,
  nextAvatarColor,
  type GroupRepository,
} from "@/groups/group-repository";

/** The Name-only Member standing for the Guest in Groups they create. */
export const GUEST_MEMBER_NAME = "You";

// v2: Shares keep the percentages and ratios they were entered with.
// v3: Activity, seeded for the sample Groups.
// v4: Settlements have a Settlement Currency and Locked Rate (ADR 0009); a
// v3 session's Settlements (and their Activity) have neither, so it starts
// over from the sample Groups rather than reading them.
const STORAGE_KEY = "expense-splitter:guest:v4";

/** Each Group's Activity, newest first, by Group id. */
export type GuestActivity = Record<string, ActivityEntry[]>;

interface StoredState {
  version: 1;
  groups: GroupSnapshot[];
  activity: GuestActivity;
}

/** A Guest repository that can also be read synchronously for rendering. */
export interface GuestGroupRepository extends GroupRepository {
  /** The current Groups; the same array until something changes. */
  snapshot(): GroupSnapshot[];
  /** A Group's Activity, newest first; the same array until something changes. */
  activitySnapshot(groupId: string): ActivityEntry[];
}

const NO_ACTIVITY: ActivityEntry[] = [];

/**
 * Guest Groups live in sessionStorage: seeded with the sample Groups on the
 * first visit of a browser session, kept across reloads, gone when the
 * session ends, and never carried into a User account.
 */
export function createSessionStorageRepository(
  storage: Storage,
  seed: () => GroupSnapshot[],
  {
    seedActivity = () => ({}),
    newId = () => crypto.randomUUID(),
    recorderId,
  }: {
    /** The sample Groups' Activity, seeded with them. */
    seedActivity?: () => GuestActivity;
    newId?: () => string;
    /**
     * The Recorder of new Expenses and Settlements. A Guest's own records
     * have none, as their Activity entries have no acting Member.
     */
    recorderId?: string;
  } = {},
): GuestGroupRepository {
  let cachedRaw: string | null = null;
  let cached: StoredState = { version: 1, groups: [], activity: {} };

  function readState(): StoredState {
    let raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = JSON.stringify({ version: 1, groups: seed(), activity: seedActivity() } satisfies StoredState);
      storage.setItem(STORAGE_KEY, raw);
    }
    if (raw !== cachedRaw) {
      const parsed = JSON.parse(raw) as StoredState;
      cached = parsed.version === 1 ? parsed : { version: 1, groups: seed(), activity: seedActivity() };
      cachedRaw = raw;
    }
    return cached;
  }

  const read = () => readState().groups;
  const recorded = recorderId ? { recorderId } : {};

  /**
   * Applies `change` to one Group, recording the Activity entry it returns
   * along with it; `null` if the Group is missing.
   */
  function changeGroup(
    groupId: string,
    change: (group: GroupSnapshot) => GroupSnapshot,
    activity?: (group: GroupSnapshot) => ActivityChange | null,
  ): GroupSnapshot | null {
    const state = readState();
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return null;
    const changed = change(group);
    const recorded = activity?.(group);
    write({
      version: 1,
      groups: state.groups.map((g) => (g.id === groupId ? changed : g)),
      activity: recorded
        ? {
            ...state.activity,
            [groupId]: [
              // The Guest's own changes have no acting Member.
              { id: `act_${newId()}`, at: new Date().toISOString(), change: recorded },
              ...(state.activity[groupId] ?? []),
            ],
          }
        : state.activity,
    });
    return changed;
  }

  /** Applies `change` to one Group's Expenses; `false` if the Group is missing. */
  function updateExpenses(
    groupId: string,
    change: (expenses: Expense[]) => Expense[],
    activity: ActivityChange | null,
  ): boolean {
    return changeGroup(groupId, (g) => ({ ...g, expenses: change(g.expenses) }), () => activity) !== null;
  }

  function findExpense(groupId: string, expenseId: string): Expense | undefined {
    return read()
      .find((g) => g.id === groupId)
      ?.expenses.find((e) => e.id === expenseId);
  }

  function findMember(groupId: string, memberId: string): Member | undefined {
    return read()
      .find((g) => g.id === groupId)
      ?.members.find((m) => m.id === memberId);
  }

  /** Replaces one Member of a Group, recording `activity` with it. */
  function replaceMember(groupId: string, member: Member, activity: ActivityChange) {
    changeGroup(
      groupId,
      (g) => ({ ...g, members: g.members.map((m) => (m.id === member.id ? member : m)) }),
      () => activity,
    );
  }

  function write(state: StoredState) {
    storage.setItem(STORAGE_KEY, JSON.stringify(state satisfies StoredState));
  }

  return {
    snapshot: read,
    activitySnapshot: (groupId) => readState().activity[groupId] ?? NO_ACTIVITY,
    async listActivity(groupId) {
      return read().some((g) => g.id === groupId) ? (readState().activity[groupId] ?? NO_ACTIVITY) : null;
    },
    async listGroups() {
      return read();
    },
    async getGroup(id) {
      return read().find((g) => g.id === id) ?? null;
    },
    async createGroup(input) {
      const group: GroupSnapshot = {
        id: `grp_${newId()}`,
        ...input,
        editingMode: "open",
        members: [{ id: `mem_${newId()}`, name: GUEST_MEMBER_NAME, avatarColor: AVATAR_COLORS[0] }],
        customCategories: [],
        expenses: [],
        settlements: [],
      };
      const state = readState();
      write({ ...state, groups: [...state.groups, group] });
      return group;
    },
    async addExpense(groupId, input) {
      const expense: Expense = {
        ...input,
        id: `exp_${newId()}`,
        createdAt: new Date().toISOString(),
        ...recorded,
      };
      return updateExpenses(groupId, (expenses) => [...expenses, expense], { kind: "expense-added", expense })
        ? expense
        : null;
    },
    async updateExpense(groupId, expenseId, input) {
      const existing = findExpense(groupId, expenseId);
      if (!existing) return null;
      const expense: Expense = {
        ...input,
        id: existing.id,
        createdAt: existing.createdAt,
        ...(existing.recorderId ? { recorderId: existing.recorderId } : {}),
      };
      updateExpenses(
        groupId,
        (expenses) => expenses.map((e) => (e.id === expenseId ? expense : e)),
        isSameExpense(existing, expense) ? null : { kind: "expense-edited", before: existing, after: expense },
      );
      return expense;
    },
    async deleteExpense(groupId, expenseId) {
      const expense = findExpense(groupId, expenseId);
      if (!expense) return false;
      return updateExpenses(groupId, (expenses) => expenses.filter((e) => e.id !== expenseId), {
        kind: "expense-deleted",
        expense,
      });
    },
    async addSettlement(groupId, input) {
      const settlement: Settlement = {
        ...input,
        id: `stl_${newId()}`,
        createdAt: new Date().toISOString(),
        ...recorded,
      };
      const changed = changeGroup(
        groupId,
        (g) => ({ ...g, settlements: [...g.settlements, settlement] }),
        () => ({ kind: "settlement-added", settlement }),
      );
      return changed ? settlement : null;
    },
    async deleteSettlement(groupId, settlementId) {
      const settlement = read()
        .find((g) => g.id === groupId)
        ?.settlements.find((s) => s.id === settlementId);
      if (!settlement) return false;
      changeGroup(
        groupId,
        (g) => ({ ...g, settlements: g.settlements.filter((s) => s.id !== settlementId) }),
        () => ({ kind: "settlement-deleted", settlement }),
      );
      return true;
    },
    async updateGroup(id, { name, description }) {
      const after = { name, description };
      return changeGroup(
        id,
        (g) => ({ ...g, ...after }),
        (g) => {
          const before = { name: g.name, description: g.description };
          return changedGroupDetails(before, after).length === 0 ? null : { kind: "group-details-edited", before, after };
        },
      );
    },
    // The Guest is the Group Creator of every session Group, so may make both.
    async setEditingMode(id, mode) {
      return changeGroup(
        id,
        (g) => ({ ...g, editingMode: mode }),
        (g) => (editingModeOf(g) === mode ? null : { kind: "editing-mode-changed", before: editingModeOf(g), after: mode }),
      );
    },
    async changeGroupCurrency(id, change) {
      if (read().find((g) => g.id === id)?.currency !== change.from) return null;
      const { from, to, rate } = change;
      return changeGroup(id, (g) => changeGroupCurrency(g, change), () => ({ kind: "currency-changed", from, to, rate }));
    },
    // Guests have no Users, so a Member with an email stays a Pending Member.
    async addMember(groupId, { name, email }) {
      let member: Member | null = null;
      const id = `mem_${newId()}`;
      changeGroup(
        groupId,
        (g) => {
          member = { id, name, ...(email ? { email } : {}), avatarColor: nextAvatarColor(g.members) };
          return { ...g, members: [...g.members, member] };
        },
        () => ({ kind: "member-added", member: { id, name } }),
      );
      return member;
    },
    async setMemberEmail(groupId, memberId, email) {
      const before = findMember(groupId, memberId);
      if (!before || before.userId) return null;
      if (before.email === email) return before;
      const member: Member = { ...before, email };
      replaceMember(groupId, member, { kind: "member-email-set", member: { id: memberId, name: before.name }, email });
      return member;
    },
    async issueInvitation() {
      return null;
    },
    async recordInvitationSent() {
      return false;
    },
    async removeMember(groupId, memberId) {
      const member = findMember(groupId, memberId);
      if (!member) return false;
      if (member.former) return true;
      replaceMember(groupId, { ...member, former: true }, { kind: "member-removed", member: { id: memberId, name: member.name } });
      return true;
    },
    async addCategory(groupId, name) {
      const category: CustomCategory = { id: `cat_${newId()}`, name };
      const changed = changeGroup(
        groupId,
        (g) => ({ ...g, customCategories: [...(g.customCategories ?? []), category] }),
        () => ({ kind: "category-added", category }),
      );
      return changed ? category : null;
    },
    async renameCategory(groupId, categoryId, name) {
      const before = read()
        .find((g) => g.id === groupId)
        ?.customCategories?.find((c) => c.id === categoryId);
      if (!before) return null;
      const category: CustomCategory = { id: categoryId, name };
      if (before.name === name) return category;
      changeGroup(
        groupId,
        (g) => ({ ...g, customCategories: g.customCategories?.map((c) => (c.id === categoryId ? category : c)) }),
        () => ({ kind: "category-renamed", before, after: category }),
      );
      return category;
    },
    async deleteCategory(groupId, categoryId) {
      const group = read().find((g) => g.id === groupId);
      const category = group?.customCategories?.find((c) => c.id === categoryId);
      // Never delete a Category an Expense uses.
      if (!category || group!.expenses.some((e) => e.category === categoryId)) return false;
      changeGroup(
        groupId,
        (g) => ({ ...g, customCategories: g.customCategories?.filter((c) => c.id !== categoryId) }),
        () => ({ kind: "category-deleted", category }),
      );
      return true;
    },
    async deleteGroup(id) {
      const state = readState();
      if (!state.groups.some((g) => g.id === id)) return false;
      const activity = { ...state.activity };
      delete activity[id];
      write({ version: 1, groups: state.groups.filter((g) => g.id !== id), activity });
      return true;
    },
  };
}
