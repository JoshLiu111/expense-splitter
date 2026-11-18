import { expect, it } from "vitest";
import type { GroupRepository } from "./group-repository";

/** Behaviour every GroupRepository must share, Guest or Postgres. */
export function groupRepositoryContract(makeRepository: () => Promise<GroupRepository>) {
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
}
