// PROTOTYPE (JoshLiu111/issue-track#19): throwaway, never merged to main.
// Derives the four settle-up hero states from a seed Group, in memory only.

import { computeLedger, type GroupSnapshot, type Ledger, type Settlement, type SuggestedSettlement } from "@/domain";

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
  // Small Change: the seed Group has none of its own, so record every
  // suggestion with the last one two minor units short (USD seed only).
  const payments = ledger.suggestions.map((p, i, all) =>
    i === all.length - 1 ? { ...p, amount: p.amount - 2 } : p,
  );
  return { ...group, settlements: [...group.settlements, ...settlementsFor(payments, "small")] };
}

export function heroKind(ledger: Ledger): HeroState {
  if (ledger.expenseCount === 0) return "empty";
  if (ledger.settledUp) return "settled";
  if (ledger.suggestions.length === 0) return "small";
  return "open";
}

/** One clause of the personal line: words, then a figure set in mono. */
export interface PersonalClause {
  words: string;
  amount?: number;
}

/**
 * "You pay Taylor Kim $3.03" first, as the parent spec asks; null for a
 * Guest or an empty Group.
 */
export function personalAction(
  group: GroupSnapshot,
  ledger: Ledger,
  youId: string | undefined,
): { tone: "owe" | "owed" | "settled"; clauses: PersonalClause[] } | null {
  if (!youId || ledger.expenseCount === 0) return null;
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown";
  const pays = ledger.suggestions.filter((s) => s.fromId === youId);
  if (pays.length > 0)
    return { tone: "owe", clauses: pays.map((s) => ({ words: `You pay ${name(s.toId)}`, amount: s.amount })) };
  const gets = ledger.suggestions.filter((s) => s.toId === youId);
  if (gets.length > 0)
    return { tone: "owed", clauses: gets.map((s) => ({ words: `${name(s.fromId)} pays you`, amount: s.amount })) };
  const mine = ledger.balances.find((b) => b.memberId === youId)?.amount ?? 0;
  if (mine < 0) return { tone: "owe", clauses: [{ words: "You owe Small Change of", amount: -mine }] };
  if (mine > 0) return { tone: "owed", clauses: [{ words: "You get back Small Change of", amount: mine }] };
  return { tone: "settled", clauses: [{ words: "You're settled up" }] };
}

/**
 * The signed-in perspective: the seed Member with the largest debt that
 * isn't the long-named one, so "You pay …" is what the screenshots show.
 */
export function pickYou(seed: GroupSnapshot): string {
  const ledger = computeLedger(seed);
  const debtors = ledger.balances.filter((b, i) => b.amount < 0 && seed.members[i] && i !== 1);
  debtors.sort((a, b) => a.amount - b.amount);
  return debtors[0]?.memberId ?? seed.members[0].id;
}

/** Total still to move between Members, in Group Currency. */
export function outstanding(ledger: Ledger): number {
  return ledger.suggestions.reduce((sum, s) => sum + s.amount, 0);
}

export function smallChangeTotal(ledger: Ledger): number {
  return ledger.smallChange.reduce((sum, s) => sum + s.amount, 0);
}
