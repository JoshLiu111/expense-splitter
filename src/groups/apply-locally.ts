import type { GroupSnapshot } from "@/domain";
import { createSessionStorageRepository } from "@/guest/guest-repository";
import { memoryStorage } from "@/lib/memory-storage";
import type { GroupRepository } from "./group-repository";

/**
 * Runs a write (`saveExpense`, `recordSettlement`, …) against an in-memory
 * copy of `group`, the way a Guest's writes run against sessionStorage, and
 * returns its result with the Group it leaves. `group` itself is untouched.
 * The signed-in Group page shows that Group while the server makes the same
 * write, so Balances change at once rather than after the round-trip.
 */
export async function applyLocally<Result extends { ok: boolean }>(
  group: GroupSnapshot,
  write: (repo: GroupRepository, groupId: string) => Promise<Result>,
): Promise<{ result: Result; group: GroupSnapshot }> {
  const repo = createSessionStorageRepository(memoryStorage(), () => [group]);
  const result = await write(repo, group.id);
  return { result, group: result.ok ? ((await repo.getGroup(group.id)) ?? group) : group };
}
