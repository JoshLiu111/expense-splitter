import type { ActivityChange } from "@/domain";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (ADR 0005). Field names follow Better Auth's defaults.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Ledger tables. Balances are derived, never stored (ADR 0004); money is in
// integer minor units (ADR 0001).
// ---------------------------------------------------------------------------

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  currency: text("currency").notNull(),
  /** The Group Creator. */
  creatorUserId: text("creator_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /**
   * Set on Groups created before Activity launched: the day it started, so
   * the Activity page can say earlier Expenses and Settlements aren't listed.
   */
  activityStartedOn: date("activity_started_on", { mode: "string" }),
});

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    /** Set for a Linked Member. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    avatarColor: text("avatar_color").notNull(),
    /** Member order in the Group; breaks Leftover Cent ties. */
    position: integer("position").notNull(),
    /** A Former Member: removed at zero Balance, kept for past Expenses. */
    former: boolean("former").notNull().default(false),
  },
  (t) => [
    uniqueIndex("members_group_user_idx").on(t.groupId, t.userId),
    index("members_user_id_idx").on(t.userId),
  ],
);

/** Custom Categories: visible only in their Group. Expenses store the id. */
export const customCategories = pgTable(
  "custom_categories",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("custom_categories_group_id_idx").on(t.groupId)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    /** Locked Rate as a plain decimal string. */
    lockedRate: text("locked_rate").notNull(),
    /** True when a Member overrode the Locked Rate by hand. */
    manualRate: boolean("manual_rate").notNull().default(false),
    payerId: text("payer_id")
      .notNull()
      .references(() => members.id),
    splitType: text("split_type").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    category: text("category").notNull(),
    notes: text("notes"),
  },
  (t) => [index("expenses_group_id_idx").on(t.groupId)],
);

export const expenseShares = pgTable(
  "expense_shares",
  {
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** Percentage Split only: the percentage entered, as a decimal string. */
    percentage: text("percentage"),
    /** Shares Split only: the ratio entered, as a decimal string. */
    ratio: text("ratio"),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.memberId] })],
);

export const settlements = pgTable(
  "settlements",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromMemberId: text("from_member_id")
      .notNull()
      .references(() => members.id),
    toMemberId: text("to_member_id")
      .notNull()
      .references(() => members.id),
    /** Always in the Group Currency (ADR 0003). */
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("settlements_group_id_idx").on(t.groupId)],
);

/**
 * Activity: one row per change to a Group's Expenses and Settlements, never
 * updated or deleted except with its Group. `change` holds the Expense or
 * Settlement as it was before and/or after; never a Balance (ADR 0004).
 */
export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    /** Recording order; breaks ties between entries made at the same moment. */
    seq: integer("seq").notNull().generatedAlwaysAsIdentity(),
    /** The acting User's Linked Member; kept, and still named, if they later leave. */
    actorMemberId: text("actor_member_id")
      .notNull()
      .references(() => members.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    change: jsonb("change").$type<ActivityChange>().notNull(),
  },
  (t) => [index("activity_group_seq_idx").on(t.groupId, t.seq)],
);

/**
 * Invitations (ADR 0007): one-time links emailed to a Pending Member. Only
 * the token's hash is stored. Only a Pending Member's latest Invitation
 * works; removing or claiming the Pending Member, or using it, ends it.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    /** SHA-256 of the token in the emailed link, hex. */
    tokenHash: text("token_hash").notNull().unique(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    /** The (lower-cased) email it was sent to: the only one it can claim. */
    email: text("email").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** Issue order: a Pending Member's highest is their latest Invitation. */
    seq: integer("seq").notNull().generatedAlwaysAsIdentity(),
  },
  (t) => [index("invitations_member_seq_idx").on(t.memberId, t.seq)],
);

// ---------------------------------------------------------------------------
// Exchange Rate cache: the latest rates from ExchangeRate-API, refreshed at
// most daily. Units of `quote` per one unit of `base`.
// ---------------------------------------------------------------------------

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    /** As returned by the API; Locked Rates are derived from it. */
    rate: text("rate").notNull(),
    /** The day (UTC) the rate was fetched. */
    fetchedOn: date("fetched_on", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);
