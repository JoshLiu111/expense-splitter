import { isCurrencyCode, toMinorUnits } from "./currency";
import type {
  CalendarDate,
  CurrencyCode,
  Expense,
  GroupSnapshot,
  Settlement,
  SplitType,
} from "./types";

interface RawMember {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
}
interface RawExpense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  paidBy: string;
  splitType: string;
  splits: { memberId: string; amount: number; percentage?: number; shares?: number }[];
  date: string;
  category: string;
  notes?: string;
}
interface RawSettlement {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  date: string;
}
interface RawGroup {
  id: string;
  name: string;
  description: string;
  currency: string;
  members: RawMember[];
  expenses: RawExpense[];
  settlements: RawSettlement[];
}

const SPLIT_TYPES: readonly SplitType[] = ["equal", "exact", "percentage", "shares"];

function currency(code: string): CurrencyCode {
  if (!isCurrencyCode(code)) throw new Error(`Unsupported currency ${code}`);
  return code;
}

function splitType(value: string): SplitType {
  const found = SPLIT_TYPES.find((t) => t === value);
  if (!found) throw new Error(`Unknown split type ${value}`);
  return found;
}

/** Truncates a UTC ISO datetime to its UTC calendar date. */
function calendarDate(isoDateTime: string): CalendarDate {
  const parsed = new Date(isoDateTime);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date ${isoDateTime}`);
  return parsed.toISOString().slice(0, 10);
}

/** Formats a JSON number rate as a plain decimal string (no exponent). */
function rateString(rate: number): string {
  if (!(rate > 0)) throw new Error(`Invalid exchange rate ${rate}`);
  return rate.toFixed(12).replace(/\.?0+$/, "");
}

function importExpense(raw: RawExpense): Expense {
  const expenseCurrency = currency(raw.currency);
  return {
    id: raw.id,
    description: raw.description,
    amount: toMinorUnits(raw.amount, expenseCurrency),
    currency: expenseCurrency,
    lockedRate: rateString(raw.exchangeRate),
    payerId: raw.paidBy,
    splitType: splitType(raw.splitType),
    shares: raw.splits.map((s) => ({
      memberId: s.memberId,
      amount: toMinorUnits(s.amount, expenseCurrency),
      ...(s.percentage !== undefined ? { percentage: String(s.percentage) } : {}),
      ...(s.shares !== undefined ? { ratio: String(s.shares) } : {}),
    })),
    date: calendarDate(raw.date),
    createdAt: new Date(raw.date).toISOString(),
    category: raw.category,
    ...(raw.notes ? { notes: raw.notes } : {}),
  };
}

/**
 * A seed Settlement keeps its own currency as its Settlement Currency, with
 * its `exchangeRate` as the Locked Rate (1 in the Group Currency), as an
 * Expense does (ADR 0009).
 */
function importSettlement(raw: RawSettlement, groupCurrency: CurrencyCode): Settlement {
  const settlementCurrency = currency(raw.currency);
  return {
    id: raw.id,
    fromId: raw.from,
    toId: raw.to,
    amount: toMinorUnits(raw.amount, settlementCurrency),
    currency: settlementCurrency,
    lockedRate: settlementCurrency === groupCurrency ? "1" : rateString(raw.exchangeRate),
    date: calendarDate(raw.date),
    createdAt: new Date(raw.date).toISOString(),
  };
}

/**
 * Converts the spec kit's `sample-groups.json` (float major units, UTC
 * datetimes) into Group snapshots (integer minor units, calendar dates).
 */
export function importSampleGroups(data: unknown): GroupSnapshot[] {
  const groups = (data as { groups?: RawGroup[] }).groups;
  if (!Array.isArray(groups)) throw new Error("Sample data has no groups");
  return groups.map((raw) => {
    const groupCurrency = currency(raw.currency);
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      currency: groupCurrency,
      members: raw.members.map((m) => ({
        id: m.id,
        name: m.name,
        avatarColor: m.avatarColor,
        ...(m.email ? { email: m.email } : {}),
      })),
      expenses: raw.expenses.map(importExpense),
      settlements: raw.settlements.map((s) => importSettlement(s, groupCurrency)),
    };
  });
}
