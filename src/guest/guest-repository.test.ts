import { describe, expect, it } from "vitest";
import type { GroupSnapshot } from "@/domain";
import { groupRepositoryContract } from "@/groups/group-repository.contract";
import { memoryStorage } from "@/test/memory-storage";
import { createSessionStorageRepository } from "./guest-repository";

const seed = (): GroupSnapshot[] => [
  {
    id: "grp_seed",
    name: "Seeded",
    description: "",
    currency: "USD",
    members: [],
    expenses: [],
    settlements: [],
  },
];

describe("Guest GroupRepository", () => {
  groupRepositoryContract(async () => createSessionStorageRepository(memoryStorage(), seed));

  it("records the Guest as a Name-only Member called You", async () => {
    const repo = createSessionStorageRepository(memoryStorage(), seed);
    const group = await repo.createGroup({ name: "Picnic", description: "", currency: "USD" });

    expect(group.members.map((m) => [m.name, m.userId])).toEqual([["You", undefined]]);
    expect(group.creatorUserId).toBeUndefined();
  });

  it("keeps created Groups after the sample Groups for the rest of the session", async () => {
    const storage = memoryStorage();
    const group = await createSessionStorageRepository(storage, seed).createGroup({
      name: "Picnic",
      description: "",
      currency: "USD",
    });

    const reopened = createSessionStorageRepository(storage, seed);
    expect((await reopened.listGroups()).map((g) => g.id)).toEqual(["grp_seed", group.id]);
  });
});
