import type { GroupSnapshot } from "@/domain";

/** Persistence for a Guest's Groups. Balances are never stored (ADR 0004). */
export interface GroupRepository {
  listGroups(): GroupSnapshot[];
  saveGroup(group: GroupSnapshot): void;
}

const STORAGE_KEY = "expense-splitter:guest:v1";

interface StoredState {
  version: 1;
  groups: GroupSnapshot[];
}

/**
 * Guest Groups live in sessionStorage: seeded with the sample Groups on the
 * first visit of a browser session, kept across reloads, gone when the
 * session ends, and never carried into a User account.
 */
export function createSessionStorageRepository(
  storage: Storage,
  seed: () => GroupSnapshot[],
): GroupRepository {
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

  return {
    listGroups: read,
    saveGroup(group) {
      const groups = read();
      const next = groups.some((g) => g.id === group.id)
        ? groups.map((g) => (g.id === group.id ? group : g))
        : [...groups, group];
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, groups: next } satisfies StoredState),
      );
    },
  };
}
