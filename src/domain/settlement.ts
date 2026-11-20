import { formatMoney, parseAmount } from "./currency";
import { computeLedger } from "./ledger";
import { isCalendarDate } from "./new-expense";
import type { CalendarDate, GroupSnapshot, MinorUnits, Settlement } from "./types";

/** A Settlement someone wants to record, in Group Currency minor units. */
export interface ProposedSettlement {
  fromId: string;
  toId: string;
  amount: MinorUnits;
}

export type SettlementCheck =
  | { ok: true }
  | {
      ok: false;
      /** The form field the problem belongs to. */
      field: "fromId" | "toId" | "amount";
      error: string;
      /** When the amount is too big: the most that can be settled. */
      maxAmount?: MinorUnits;
    };

/**
 * Validate Settlement: a Settlement must go from a Member who owes (negative
 * Balance) to one who is owed (positive Balance), and be no more than the
 * smaller of the two, so it can never settle a debt that doesn't exist.
 */
export function validateSettlement(group: GroupSnapshot, proposed: ProposedSettlement): SettlementCheck {
  const from = group.members.find((m) => m.id === proposed.fromId);
  const to = group.members.find((m) => m.id === proposed.toId);
  if (!from) return { ok: false, field: "fromId", error: "Choose who paid." };
  if (!to) return { ok: false, field: "toId", error: "Choose who was paid." };
  if (from.id === to.id) return { ok: false, field: "toId", error: `Choose someone other than ${from.name}.` };

  const balances = new Map(computeLedger(group).balances.map((b) => [b.memberId, b.amount]));
  const owes = -(balances.get(from.id) ?? 0);
  const owed = balances.get(to.id) ?? 0;
  if (owes <= 0) return { ok: false, field: "fromId", error: `${from.name} doesn't owe anything.` };
  if (owed <= 0) return { ok: false, field: "toId", error: `${to.name} isn't owed anything.` };

  if (!Number.isSafeInteger(proposed.amount) || proposed.amount <= 0)
    return { ok: false, field: "amount", error: "Enter an amount greater than zero." };
  const maxAmount = Math.min(owes, owed);
  if (proposed.amount > maxAmount)
    return {
      ok: false,
      field: "amount",
      error: `${from.name} can pay at most ${formatMoney(maxAmount, group.currency)}.`,
      maxAmount,
    };
  return { ok: true };
}

/** A Settlement about to be recorded; the repository assigns id and createdAt. */
export type NewSettlement = Omit<Settlement, "id" | "createdAt" | "recorderId">;

/** The Settlement form as the visitor filled it in; the amount is in the Group Currency. */
export interface NewSettlementFields {
  fromId: string;
  toId: string;
  amount: string;
  date: string;
}

export type NewSettlementErrors = Partial<Record<keyof NewSettlementFields, string>>;

export type ParseSettlementResult =
  | { ok: true; value: NewSettlement }
  | { ok: false; errors: NewSettlementErrors };

/** Validates the Settlement form against the Group's Balances now. */
export function parseNewSettlement(fields: NewSettlementFields, group: GroupSnapshot): ParseSettlementResult {
  const errors: NewSettlementErrors = {};
  const amount = parseAmount(fields.amount, group.currency);
  if (!isCalendarDate(fields.date)) errors.date = "Enter a real date, like 2026-01-31.";

  // An unreadable amount is checked as 1 so the Members are still checked.
  const check = validateSettlement(group, {
    fromId: fields.fromId,
    toId: fields.toId,
    amount: amount.ok ? amount.amount : 1,
  });
  if (!check.ok) errors[check.field] = check.error;
  if (!amount.ok) errors.amount = amount.error;

  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  const date: CalendarDate = fields.date;
  return { ok: true, value: { fromId: fields.fromId, toId: fields.toId, amount: amount.amount, date } };
}
