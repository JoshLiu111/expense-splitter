/** ISO 4217 code of a supported currency. */
export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CAD"
  | "AUD"
  | "CHF"
  | "CNY"
  | "INR"
  | "MXN";

/** A calendar date with no time zone, formatted `YYYY-MM-DD`. */
export type CalendarDate = string;

/** Integer amount in a currency's minor unit (cents for USD, yen for JPY). */
export type MinorUnits = number;

export type SplitType = "equal" | "exact" | "percentage" | "shares";

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
}

export interface Share {
  memberId: string;
  /** In the Expense Currency's minor unit. */
  amount: MinorUnits;
}

export interface Expense {
  id: string;
  description: string;
  /** In the Expense Currency's minor unit. */
  amount: MinorUnits;
  currency: CurrencyCode;
  /**
   * Locked Rate: Group Currency units per one unit of Expense Currency,
   * as a plain decimal string (e.g. "0.0067") so it is never subject to
   * floating-point error.
   */
  lockedRate: string;
  payerId: string;
  splitType: SplitType;
  shares: Share[];
  date: CalendarDate;
  /** ISO timestamp; breaks ties between Expenses on the same date. */
  createdAt: string;
  category: string;
  notes?: string;
}

export interface Settlement {
  id: string;
  fromId: string;
  toId: string;
  /** Always in the Group Currency's minor unit (ADR 0003). */
  amount: MinorUnits;
  date: CalendarDate;
  createdAt: string;
}

/** Everything the domain core needs to know about one Group. */
export interface GroupSnapshot {
  id: string;
  name: string;
  description: string;
  currency: CurrencyCode;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
}
