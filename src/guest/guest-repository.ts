import type { GroupSnapshot } from "@/domain";
import { AVATAR_COLORS, type GroupRepository } from "@/groups/group-repository";

const STORAGE_KEY = "expense-splitter:guest:v1";

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
        members: [{ id: `mem_${newId()}`, name: "You", avatarColor: AVATAR_COLORS[0] }],
        expenses: [],
        settlements: [],
      };
      write([...read(), group]);
      return group;
    },
  };
}
