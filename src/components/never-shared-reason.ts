import { explainNeverShared, formatMoney, type GroupSnapshot, type SuggestedSettlement } from "@/domain";
import { pluralize, verbFor } from "@/lib/format";

/**
 * Who reads the reason: the visitor paying or being paid, in the main
 * Settle up view, or anyone, in "Why these payments?".
 */
export type ReasonReader = "payer" | "recipient" | "panel";

/** At most this many names, then "and N others". */
const NAMED = 3;

/**
 * The one-line reason under a Suggested Settlement between two Members who
 * never shared an Expense; nothing for a pair who did. Members go by name,
 * as on the Suggested Settlement's own line.
 */
export function neverSharedReason(
  group: GroupSnapshot,
  suggestion: SuggestedSettlement,
  reader: ReasonReader,
): string | undefined {
  const reason = explainNeverShared(group, suggestion);
  if (!reason) return undefined;
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown member";
  const payer = nameOf(suggestion.fromId);
  const recipient = nameOf(suggestion.toId);
  if (reader === "recipient")
    return `You never shared an Expense with ${payer}; Debt Simplification goes by Balances, so ${payer} pays you directly.`;

  const opening =
    reader === "payer"
      ? `You never shared an Expense with ${recipient}`
      : `${payer} and ${recipient} never shared an Expense`;
  const most = reason.owedTheMost ? ", the most in the Group" : "";
  const owed = `${opening}; Debt Simplification goes by Balances, and ${recipient} ${verbFor(recipient, "is", "are")} owed ${formatMoney(reason.recipientBalance, group.currency)}${most}.`;
  if (reason.payments >= reason.debtsWith.length) return owed;

  const names = reason.debtsWith.map(nameOf);
  const who = reader === "payer" ? "you make" : `${payer} ${verbFor(payer, "makes", "make")}`;
  return `${owed} Instead of ${pluralize(names.length, "Debt")} with ${nameList(names)}, ${who} ${pluralize(reason.payments, "payment")}.`;
}

/** "Sam", "Sam and Riley", "Sam, Riley and Drew", "Sam, Riley, Drew and 2 others". */
function nameList(names: string[]): string {
  if (names.length > NAMED) {
    const rest = names.length - NAMED;
    return `${names.slice(0, NAMED).join(", ")} and ${pluralize(rest, "other")}`;
  }
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
