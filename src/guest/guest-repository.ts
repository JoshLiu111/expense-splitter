import type { Expense, GroupSnapshot } from "@/domain";
import { AVATAR_COLORS, type GroupRepository } from "@/groups/group-repository";

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

  /** Applies `change` to one Group's Expenses; `false` if the Group is missing. */
  function updateExpenses(groupId: string, change: (expenses: Expense[]) => Expense[]): boolean {
    const groups = read();
    if (!groups.some((g) => g.id === groupId)) return false;
    write(groups.map((g) => (g.id === groupId ? { ...g, expenses: change(g.expenses) } : g)));
    return true;
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
  };
}
