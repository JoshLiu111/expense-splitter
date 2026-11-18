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
  /** Set for a Linked Member: the User this Member is tied to. */
  userId?: string;
  avatarColor: string;
  /**
   * A Former Member: removed at zero Balance, so no longer selectable for
   * new Expenses but still shown on past ones.
   */
  former?: boolean;
}

export interface Share {
  memberId: string;
  /** In the Expense Currency's minor unit. */
  amount: MinorUnits;
  /** Percentage Split only: the percentage typed, e.g. "33.33". */
  percentage?: string;
  /** Shares Split only: the ratio typed, e.g. "2" in a 2:1 Split. */
  ratio?: string;
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
  /** True when a Member overrode the Locked Rate by hand. */
  manualRate?: boolean;
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
  /** The Group Creator's User id; absent for Groups made by a Guest. */
  creatorUserId?: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
}
