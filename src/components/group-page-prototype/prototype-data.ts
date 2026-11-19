// PROTOTYPE (JoshLiu111/issue-track#19): throwaway, never merged to main.
// Derives the four settle-up hero states from a seed Group, in memory only.

import { computeLedger, type GroupSnapshot, type Ledger, type Settlement, type SuggestedSettlement } from "@/domain";
import { formatMoney } from "@/domain";

export type HeroState = "open" | "small" | "settled" | "empty";
export const HERO_STATES: HeroState[] = ["open", "small", "settled", "empty"];
export const HERO_LABELS: Record<HeroState, string> = {
  open: "Open Debts",
  small: "Small Change",
  settled: "Settled Up",
  empty: "No Expenses",
};

const LONG_NAME = "Jordan Alexander Park-Featherstonehaugh";

function settlementsFor(payments: SuggestedSettlement[], tag: string): Settlement[] {
  return payments.map((p, i) => ({
    id: `proto_${tag}_${i}`,
    fromId: p.fromId,
    toId: p.toId,
    amount: p.amount,
    date: "2024-04-02",
    createdAt: `2024-04-02T12:00:0${i}Z`,
  }));
}

/** The seed Group pushed into one hero state, with one long Member name. */
export function groupInState(seed: GroupSnapshot, state: HeroState): GroupSnapshot {
  const group: GroupSnapshot = {
    ...seed,
    members: seed.members.map((m, i) => (i === 1 ? { ...m, name: LONG_NAME } : m)),
  };
  if (state === "empty") return { ...group, expenses: [], settlements: [] };
  if (state === "open") return group;

  const ledger = computeLedger(group);
  if (state === "settled") {
    return {
      ...group,
      settlements: [
        ...group.settlements,
        ...settlementsFor([...ledger.suggestions, ...ledger.smallChange], "settle"),
      ],
    };
  }
  // Small Change: record every suggestion, the last one two cents short.
  const payments = ledger.suggestions.map((p, i, all) =>
    i === all.length - 1 ? { ...p, amount: p.amount - 2 } : p,
  );
  return { ...group, settlements: [...group.settlements, ...settlementsFor(payments, "small")] };
}

export type HeroKind = HeroState;

export function heroKind(ledger: Ledger): HeroKind {
  if (ledger.expenseCount === 0) return "empty";
  if (ledger.settledUp) return "settled";
  if (ledger.suggestions.length === 0) return "small";
  return "open";
}

/** "You pay Taylor Kim $3.03", or null for a Guest or when You have nothing to do. */
export function personalAction(
  group: GroupSnapshot,
  ledger: Ledger,
  youId: string | undefined,
): { text: string; tone: "owe" | "owed" | "settled" } | null {
  if (!youId) return null;
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown";
  const money = (n: number) => formatMoney(n, group.currency);
  const pays = ledger.suggestions.filter((s) => s.fromId === youId);
  if (pays.length > 0)
    return { tone: "owe", text: pays.map((s) => `You pay ${name(s.toId)} ${money(s.amount)}`).join(" · ") };
  const gets = ledger.suggestions.filter((s) => s.toId === youId);
  if (gets.length > 0)
    return { tone: "owed", text: gets.map((s) => `${name(s.fromId)} pays you ${money(s.amount)}`).join(" · ") };
  return { tone: "settled", text: "You have nothing to pay or collect" };
}

/** Total still to move between Members, in Group Currency. */
export function outstanding(ledger: Ledger): number {
  return ledger.suggestions.reduce((sum, s) => sum + s.amount, 0);
}

export function smallChangeTotal(ledger: Ledger): number {
  return ledger.smallChange.reduce((sum, s) => sum + s.amount, 0);
}
