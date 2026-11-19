import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { computeLedger, explainSettlements, formatMoney, importSampleGroups, type GroupSnapshot } from "@/domain";
import { layoutDebtGraph, overlap, SIZE } from "./debt-graph-layout";

const groups = importSampleGroups(sampleData);

function layout(group: GroupSnapshot, scale: number) {
  const { before, suggestions, smallChange } = explainSettlements(group);
  const balances = new Map(computeLedger(group).balances.map((b) => [b.memberId, b.amount]));
  const involved = new Set([...before, ...suggestions, ...smallChange].flatMap((e) => [e.fromId, e.toId]));
  return layoutDebtGraph({
    members: group.members.filter((m) => involved.has(m.id)),
    balanceOf: (id) => balances.get(id) ?? 0,
    before,
    after: suggestions,
    label: (e) => formatMoney(e.amount, group.currency),
    scale,
  });
}

// 1 on desktop; about 0.81 in a 390px-wide phone.
describe.each([1, 0.81])("at scale %s", (scale) => {
  describe.each(groups.map((g) => [g.id, g] as const))("%s", (_, group) => {
    const graph = layout(group, scale);

    it.each(["before", "after"] as const)("keeps %s labels clear of each other, avatars and names", (phase) => {
      const labels = graph[phase].map((e) => e.labelBox);
      const obstacles = graph.nodes.flatMap((n) => [{ cx: n.x, cy: n.y, w: 44, h: 44 }, n.nameBox]);
      labels.forEach((box, i) => {
        for (const other of [...labels.slice(i + 1), ...obstacles]) expect(overlap(box, other)).toBe(0);
      });
    });

    it("keeps names inside the graph", () => {
      for (const { nameBox } of graph.nodes) {
        expect(nameBox.cx - nameBox.w / 2).toBeGreaterThanOrEqual(0);
        expect(nameBox.cx + nameBox.w / 2).toBeLessThanOrEqual(SIZE);
      }
    });

    it("renders amounts at 11px or more", () => {
      expect(graph.fontSize.label * scale).toBeGreaterThanOrEqual(11);
    });
  });
});

it("puts those owed on the left and those who owe on the right", () => {
  const japan = groups.find((g) => g.id === "grp_japan_2024")!;
  const balances = new Map(computeLedger(japan).balances.map((b) => [b.memberId, b.amount]));
  for (const node of layout(japan, 1).nodes) {
    expect(Math.sign(SIZE / 2 - node.x)).toBe(Math.sign(balances.get(node.id)!));
  }
});
