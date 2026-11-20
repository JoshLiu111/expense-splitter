import { and, asc, desc, eq, exists, inArray, isNull, max, notExists, sql } from "drizzle-orm";
import {
  computeLedger,
  isSameExpense,
  type ActivityChange,
  type CurrencyCode,
  type Expense,
  type GroupSnapshot,
  type NewExpense,
  type Settlement,
  type SplitType,
} from "@/domain";
import type { Database } from "@/db/client";
import {
  activity,
  customCategories,
  expenseShares,
  expenses,
  groups,
  members,
  settlements,
  user,
} from "@/db/schema";
import { AVATAR_COLORS, nextAvatarColor, type GroupRepository } from "./group-repository";

/** The signed-in User a repository acts for. */
export interface GroupUser {
  id: string;
  name: string;
  email: string;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * The User a Member with this email should be linked to: the one who has
 * verified it (ADR 0005), unless they are already linked to a Member of the
 * Group, since a User is linked to at most one Member per Group.
 */
async function userToLink(tx: Tx, groupId: string, email: string): Promise<string | null> {
  const [found] = await tx
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(sql`lower(${user.email})`, email.toLowerCase()),
        eq(user.emailVerified, true),
        notExists(
          tx
            .select({ one: members.id })
            .from(members)
            .where(and(eq(members.groupId, groupId), eq(members.userId, user.id))),
        ),
      ),
    );
  return found?.id ?? null;
}

/**
 * Links a User who has just verified their email to every Pending Member
 * with that exact email, at most one per Group and never in a Group where
 * they are already linked. Former Members are left as they are.
 */
export async function claimPendingMembers(db: Database, verified: { id: string; email: string }) {
  await db.transaction(async (tx) => {
    const pending = await tx
      .select({ id: members.id, groupId: members.groupId })
      .from(members)
      .where(
        and(
          eq(sql`lower(${members.email})`, verified.email.toLowerCase()),
          isNull(members.userId),
          eq(members.former, false),
        ),
      )
      .orderBy(asc(members.position));
    const linkedGroups = new Set(
      (
        await tx
          .select({ groupId: members.groupId })
          .from(members)
          .where(eq(members.userId, verified.id))
      ).map((m) => m.groupId),
    );
    for (const member of pending) {
      if (linkedGroups.has(member.groupId)) continue;
      linkedGroups.add(member.groupId);
      await tx.update(members).set({ userId: verified.id }).where(eq(members.id, member.id));
    }
  });
}

type ExpenseRow = typeof expenses.$inferSelect;
type ShareRow = typeof expenseShares.$inferSelect;
type SettlementRow = typeof settlements.$inferSelect;

/** An Expense from its row and its Shares' rows, in Share order. */
function toExpense(e: ExpenseRow, shares: ShareRow[]): Expense {
  return {
    id: e.id,
    description: e.description,
    amount: e.amount,
    currency: e.currency as CurrencyCode,
    lockedRate: e.lockedRate,
    ...(e.manualRate ? { manualRate: true } : {}),
    payerId: e.payerId,
    splitType: e.splitType as SplitType,
    shares: shares.map((share) => ({
      memberId: share.memberId,
      amount: share.amount,
      ...(share.percentage !== null ? { percentage: share.percentage } : {}),
      ...(share.ratio !== null ? { ratio: share.ratio } : {}),
    })),
    date: e.date,
    createdAt: e.createdAt.toISOString(),
    category: e.category,
    ...(e.notes ? { notes: e.notes } : {}),
  };
}

function toSettlement(s: SettlementRow): Settlement {
  return {
    id: s.id,
    fromId: s.fromMemberId,
    toId: s.toMemberId,
    amount: s.amount,
    date: s.date,
    createdAt: s.createdAt.toISOString(),
  };
}

/** One Expense of the Group, locked until the transaction ends; `null` if it isn't there. */
async function lockExpense(tx: Tx, groupId: string, expenseId: string): Promise<Expense | null> {
  const [row] = await tx
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .for("update");
  if (!row) return null;
  const shares = await tx
    .select()
    .from(expenseShares)
    .where(eq(expenseShares.expenseId, expenseId))
    .orderBy(asc(expenseShares.position));
  return toExpense(row, shares);
}

/**
 * A User's Groups in Postgres: the Groups where they are a Linked Member,
 * plus, read-only, those where they are a Former Member whose Balance has
 * reopened (ADR 0006). Every query is scoped to that User, so other Users'
 * Groups never leak.
 */
export function createPostgresGroupRepository(
  db: Database,
  currentUser: GroupUser,
  newId: () => string = () => crypto.randomUUID(),
): GroupRepository {
  /** Groups where the User is a Linked Member now: the ones they may change. */
  const isLinkedMember = exists(
    db
      .select({ one: members.id })
      .from(members)
      .where(
        and(
          eq(members.groupId, groups.id),
          eq(members.userId, currentUser.id),
          eq(members.former, false),
        ),
      ),
  );
  /** Groups where the User is linked to any Member, Former Members included. */
  const wasLinkedMember = exists(
    db
      .select({ one: members.id })
      .from(members)
      .where(and(eq(members.groupId, groups.id), eq(members.userId, currentUser.id))),
  );

  /**
   * The Groups the User can read: those where they are a Linked Member, and
   * those where they are a Former Member with a non-zero Balance, computed
   * from the loaded Group since Balances are never stored (ADR 0004).
   */
  async function load(groupId?: string): Promise<GroupSnapshot[]> {
    return (await loadEverLinked(groupId)).filter((group) => {
      const me = group.members.find((m) => m.userId === currentUser.id);
      if (!me?.former) return true;
      return (computeLedger(group).balances.find((b) => b.memberId === me.id)?.amount ?? 0) !== 0;
    });
  }

  async function loadEverLinked(groupId?: string): Promise<GroupSnapshot[]> {
    const groupRows = await db
      .select()
      .from(groups)
      .where(groupId ? and(wasLinkedMember, eq(groups.id, groupId)) : wasLinkedMember)
      .orderBy(asc(groups.createdAt), asc(groups.id));
    if (groupRows.length === 0) return [];

    const ids = groupRows.map((g) => g.id);
    const [memberRows, expenseRows, shareRows, settlementRows, categoryRows] = await Promise.all([
      // A Linked Member is shown under their User's current name and avatar,
      // so a change in Account Settings reaches every Group at once.
      db
        .select({ member: members, userName: user.name, userImage: user.image })
        .from(members)
        .leftJoin(user, eq(members.userId, user.id))
        .where(inArray(members.groupId, ids))
        .orderBy(asc(members.position)),
      db.select().from(expenses).where(inArray(expenses.groupId, ids)),
      db
        .select({ share: expenseShares, groupId: expenses.groupId })
        .from(expenseShares)
        .innerJoin(expenses, eq(expenseShares.expenseId, expenses.id))
        .where(inArray(expenses.groupId, ids))
        .orderBy(asc(expenseShares.position)),
      db.select().from(settlements).where(inArray(settlements.groupId, ids)),
      db
        .select()
        .from(customCategories)
        .where(inArray(customCategories.groupId, ids))
        .orderBy(asc(customCategories.createdAt), asc(customCategories.id)),
    ]);

    return groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      currency: g.currency as CurrencyCode,
      ...(g.creatorUserId ? { creatorUserId: g.creatorUserId } : {}),
      members: memberRows
        .filter((row) => row.member.groupId === g.id)
        .map(({ member: m, userName, userImage }) => ({
          id: m.id,
          name: userName ?? m.name,
          avatarColor: m.avatarColor,
          ...(m.email ? { email: m.email } : {}),
          ...(m.userId ? { userId: m.userId } : {}),
          ...(m.former ? { former: true } : {}),
          ...(userImage ? { avatarUrl: userImage } : {}),
        })),
      customCategories: categoryRows
        .filter((c) => c.groupId === g.id)
        .map((c) => ({ id: c.id, name: c.name })),
      expenses: expenseRows
        .filter((e) => e.groupId === g.id)
        .map((e) =>
          toExpense(
            e,
            shareRows.filter((r) => r.share.expenseId === e.id).map((r) => r.share),
          ),
        ),
      settlements: settlementRows.filter((s) => s.groupId === g.id).map(toSettlement),
      ...(g.activityStartedOn ? { activityStartedOn: g.activityStartedOn } : {}),
    }));
  }

  /** Whether the User may change the Group: only as a Linked Member, never as a Former Member. */
  async function canChange(groupId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(isLinkedMember, eq(groups.id, groupId)));
    return row !== undefined;
  }

  /**
   * Records an Activity entry in the same transaction as its change, under
   * the User's Linked Member in that Group (one `canChange` already found).
   */
  async function record(tx: Tx, groupId: string, change: ActivityChange) {
    const [actor] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.groupId, groupId), eq(members.userId, currentUser.id)));
    await tx.insert(activity).values({ id: `act_${newId()}`, groupId, actorMemberId: actor.id, change });
  }

  async function insertShares(tx: Tx, expenseId: string, expense: NewExpense) {
    if (expense.shares.length === 0) return;
    await tx.insert(expenseShares).values(
      expense.shares.map((share, position) => ({
        expenseId,
        memberId: share.memberId,
        amount: share.amount,
        percentage: share.percentage ?? null,
        ratio: share.ratio ?? null,
        position,
      })),
    );
  }

  /** The Expense columns a visitor can set. */
  function expenseColumns(expense: NewExpense) {
    return {
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      lockedRate: expense.lockedRate,
      manualRate: expense.manualRate ?? false,
      payerId: expense.payerId,
      splitType: expense.splitType,
      date: expense.date,
      category: expense.category,
      notes: expense.notes ?? null,
    };
  }

  return {
    listGroups: () => load(),
    async getGroup(id) {
      const [group] = await load(id);
      return group ?? null;
    },
    async createGroup(input) {
      const groupId = `grp_${newId()}`;
      await db.transaction(async (tx) => {
        await tx.insert(groups).values({ id: groupId, ...input, creatorUserId: currentUser.id });
        await tx.insert(members).values({
          id: `mem_${newId()}`,
          groupId,
          name: currentUser.name,
          email: currentUser.email,
          userId: currentUser.id,
          avatarColor: AVATAR_COLORS[0],
          position: 0,
        });
      });
      const [group] = await load(groupId);
      return group;
    },
    async addExpense(groupId, input) {
      if (!(await canChange(groupId))) return null;
      const expenseId = `exp_${newId()}`;
      return db.transaction(async (tx) => {
        await tx.insert(expenses).values({ id: expenseId, groupId, ...expenseColumns(input) });
        await insertShares(tx, expenseId, input);
        const expense = (await lockExpense(tx, groupId, expenseId))!;
        await record(tx, groupId, { kind: "expense-added", expense });
        return expense;
      });
    },
    async updateExpense(groupId, expenseId, input) {
      if (!(await canChange(groupId))) return null;
      return db.transaction(async (tx) => {
        const before = await lockExpense(tx, groupId, expenseId);
        if (!before) return null;
        await tx.update(expenses).set(expenseColumns(input)).where(eq(expenses.id, expenseId));
        await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
        await insertShares(tx, expenseId, input);
        const after = (await lockExpense(tx, groupId, expenseId))!;
        if (!isSameExpense(before, after)) await record(tx, groupId, { kind: "expense-edited", before, after });
        return after;
      });
    },
    async deleteExpense(groupId, expenseId) {
      if (!(await canChange(groupId))) return false;
      return db.transaction(async (tx) => {
        const expense = await lockExpense(tx, groupId, expenseId);
        if (!expense) return false;
        await tx.delete(expenses).where(eq(expenses.id, expenseId));
        await record(tx, groupId, { kind: "expense-deleted", expense });
        return true;
      });
    },
    async addSettlement(groupId, input) {
      if (!(await canChange(groupId))) return null;
      // Both Members must belong to this Group, not merely exist.
      const found = await db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.groupId, groupId), inArray(members.id, [input.fromId, input.toId])));
      if (found.length !== new Set([input.fromId, input.toId]).size) return null;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(settlements)
          .values({
            id: `stl_${newId()}`,
            groupId,
            fromMemberId: input.fromId,
            toMemberId: input.toId,
            amount: input.amount,
            date: input.date,
          })
          .returning();
        const settlement = toSettlement(row);
        await record(tx, groupId, { kind: "settlement-added", settlement });
        return settlement;
      });
    },
    async deleteSettlement(groupId, settlementId) {
      if (!(await canChange(groupId))) return false;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .delete(settlements)
          .where(and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId)))
          .returning();
        if (!row) return false;
        await record(tx, groupId, { kind: "settlement-deleted", settlement: toSettlement(row) });
        return true;
      });
    },
    async updateGroup(id, details) {
      if (!(await canChange(id))) return null;
      await db
        .update(groups)
        .set({ name: details.name, description: details.description, currency: details.currency })
        .where(eq(groups.id, id));
      const [group] = await load(id);
      return group ?? null;
    },
    async addMember(groupId, { name, email }) {
      if (!(await canChange(groupId))) return null;
      const memberId = `mem_${newId()}`;
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ avatarColor: members.avatarColor })
          .from(members)
          .where(eq(members.groupId, groupId));
        const [{ last }] = await tx
          .select({ last: max(members.position) })
          .from(members)
          .where(eq(members.groupId, groupId));
        await tx.insert(members).values({
          id: memberId,
          groupId,
          name,
          email: email ?? null,
          userId: email ? await userToLink(tx, groupId, email) : null,
          avatarColor: nextAvatarColor(existing),
          position: (last ?? -1) + 1,
        });
      });
      const [group] = await load(groupId);
      return group?.members.find((m) => m.id === memberId) ?? null;
    },
    async setMemberEmail(groupId, memberId, email) {
      if (!(await canChange(groupId))) return null;
      const updated = await db.transaction(async (tx) => {
        const rows = await tx
          .update(members)
          .set({ email, userId: await userToLink(tx, groupId, email) })
          // A Linked Member's email is their User's, so leave it alone.
          .where(and(eq(members.id, memberId), eq(members.groupId, groupId), isNull(members.userId)))
          .returning({ id: members.id });
        return rows.length > 0;
      });
      if (!updated) return null;
      const [group] = await load(groupId);
      return group?.members.find((m) => m.id === memberId) ?? null;
    },
    async removeMember(groupId, memberId) {
      if (!(await canChange(groupId))) return false;
      const rows = await db
        .update(members)
        .set({ former: true })
        .where(and(eq(members.id, memberId), eq(members.groupId, groupId)))
        .returning({ id: members.id });
      return rows.length > 0;
    },
    async addCategory(groupId, name) {
      if (!(await canChange(groupId))) return null;
      const id = `cat_${newId()}`;
      await db.insert(customCategories).values({ id, groupId, name });
      return { id, name };
    },
    async renameCategory(groupId, categoryId, name) {
      if (!(await canChange(groupId))) return null;
      const rows = await db
        .update(customCategories)
        .set({ name })
        .where(and(eq(customCategories.id, categoryId), eq(customCategories.groupId, groupId)))
        .returning({ id: customCategories.id });
      return rows.length > 0 ? { id: categoryId, name } : null;
    },
    async deleteCategory(groupId, categoryId) {
      if (!(await canChange(groupId))) return false;
      // Never delete a Category an Expense uses, even one recorded a moment ago.
      const rows = await db
        .delete(customCategories)
        .where(
          and(
            eq(customCategories.id, categoryId),
            eq(customCategories.groupId, groupId),
            notExists(
              db
                .select({ one: expenses.id })
                .from(expenses)
                .where(and(eq(expenses.groupId, groupId), eq(expenses.category, categoryId))),
            ),
          ),
        )
        .returning({ id: customCategories.id });
      return rows.length > 0;
    },
    async listActivity(groupId) {
      if ((await load(groupId)).length === 0) return null;
      const rows = await db
        .select()
        .from(activity)
        .where(eq(activity.groupId, groupId))
        .orderBy(desc(activity.seq));
      return rows.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        actorMemberId: r.actorMemberId,
        change: r.change,
      }));
    },
    async deleteGroup(id) {
      // Only the Group Creator may delete a Group, so scope the delete to them,
      // and only while they are a Linked Member.
      if (!(await canChange(id))) return false;
      const rows = await db
        .delete(groups)
        .where(and(eq(groups.id, id), eq(groups.creatorUserId, currentUser.id)))
        .returning({ id: groups.id });
      return rows.length > 0;
    },
  };
}
