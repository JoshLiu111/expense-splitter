import type { Expense, GroupSnapshot, Member, Settlement } from "@/domain";
import {
  AVATAR_COLORS,
  nextAvatarColor,
  type GroupRepository,
} from "@/groups/group-repository";

/** The Name-only Member standing for the Guest in Groups they create. */
export const GUEST_MEMBER_NAME = "You";

// v2: Shares keep the percentages and ratios they were entered with.
const STORAGE_KEY = "expense-splitter:guest:v2";

interface StoredState {
  version: 1;
  groups: GroupSnapshot[];
}

/** A Guest repository that can also be read synchronously for rendering. */
export interface GuestGroupRepository extends GroupRepository {
  /** The current Groups; the same array until something changes. */
  snapshot(): GroupSnapshot[];
}

/**
 * Guest Groups live in sessionStorage: seeded with the sample Groups on the
 * first visit of a browser session, kept across reloads, gone when the
 * session ends, and never carried into a User account.
 */
export function createSessionStorageRepository(
  storage: Storage,
  seed: () => GroupSnapshot[],
  newId: () => string = () => crypto.randomUUID(),
): GuestGroupRepository {
  let cachedRaw: string | null = null;
  let cachedGroups: GroupSnapshot[] = [];

  function read(): GroupSnapshot[] {
    let raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = JSON.stringify({ version: 1, groups: seed() } satisfies StoredState);
      storage.setItem(STORAGE_KEY, raw);
    }
    if (raw !== cachedRaw) {
      const parsed = JSON.parse(raw) as StoredState;
      cachedGroups = parsed.version === 1 ? parsed.groups : seed();
      cachedRaw = raw;
    }
    return cachedGroups;
  }

  /** Applies `change` to one Group; `null` if the Group is missing. */
  function changeGroup(
    groupId: string,
    change: (group: GroupSnapshot) => GroupSnapshot,
  ): GroupSnapshot | null {
    const groups = read();
    const group = groups.find((g) => g.id === groupId);
    if (!group) return null;
    const changed = change(group);
    write(groups.map((g) => (g.id === groupId ? changed : g)));
    return changed;
  }

  /** Applies `change` to one Group's Expenses; `false` if the Group is missing. */
  function updateExpenses(groupId: string, change: (expenses: Expense[]) => Expense[]): boolean {
    return changeGroup(groupId, (g) => ({ ...g, expenses: change(g.expenses) })) !== null;
  }

  function findExpense(groupId: string, expenseId: string): Expense | undefined {
    return read()
      .find((g) => g.id === groupId)
      ?.expenses.find((e) => e.id === expenseId);
  }

  function write(groups: GroupSnapshot[]) {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, groups } satisfies StoredState));
  }

  return {
    snapshot: read,
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
        members: [{ id: `mem_${newId()}`, name: GUEST_MEMBER_NAME, avatarColor: AVATAR_COLORS[0] }],
        expenses: [],
        settlements: [],
      };
      write([...read(), group]);
      return group;
    },
    async addExpense(groupId, input) {
      const expense: Expense = {
        ...input,
        id: `exp_${newId()}`,
        createdAt: new Date().toISOString(),
      };
      return updateExpenses(groupId, (expenses) => [...expenses, expense]) ? expense : null;
    },
    async updateExpense(groupId, expenseId, input) {
      const existing = findExpense(groupId, expenseId);
      if (!existing) return null;
      const expense: Expense = { ...input, id: existing.id, createdAt: existing.createdAt };
      updateExpenses(groupId, (expenses) => expenses.map((e) => (e.id === expenseId ? expense : e)));
      return expense;
    },
    async deleteExpense(groupId, expenseId) {
      if (!findExpense(groupId, expenseId)) return false;
      return updateExpenses(groupId, (expenses) => expenses.filter((e) => e.id !== expenseId));
    },
    async addSettlement(groupId, input) {
      const settlement: Settlement = {
        ...input,
        id: `stl_${newId()}`,
        createdAt: new Date().toISOString(),
      };
      const changed = changeGroup(groupId, (g) => ({ ...g, settlements: [...g.settlements, settlement] }));
      return changed ? settlement : null;
    },
    async deleteSettlement(groupId, settlementId) {
      const group = read().find((g) => g.id === groupId);
      if (!group?.settlements.some((s) => s.id === settlementId)) return false;
      changeGroup(groupId, (g) => ({
        ...g,
        settlements: g.settlements.filter((s) => s.id !== settlementId),
      }));
      return true;
    },
    async updateGroup(id, details) {
      return changeGroup(id, (g) => ({ ...g, ...details }));
    },
    async addMember(groupId, name) {
      let member: Member | null = null;
      changeGroup(groupId, (g) => {
        member = { id: `mem_${newId()}`, name, avatarColor: nextAvatarColor(g.members) };
        return { ...g, members: [...g.members, member] };
      });
      return member;
    },
    async removeMember(groupId, memberId) {
      const group = read().find((g) => g.id === groupId);
      if (!group?.members.some((m) => m.id === memberId)) return false;
      changeGroup(groupId, (g) => ({
        ...g,
        members: g.members.map((m) => (m.id === memberId ? { ...m, former: true } : m)),
      }));
      return true;
    },
    async deleteGroup(id) {
      const groups = read();
      if (!groups.some((g) => g.id === id)) return false;
      write(groups.filter((g) => g.id !== id));
      return true;
    },
  };
}
