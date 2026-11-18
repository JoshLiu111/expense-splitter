import { and, asc, eq, exists, inArray, isNull, max, notExists, sql } from "drizzle-orm";
import type { CurrencyCode, Expense, GroupSnapshot, NewExpense, SplitType } from "@/domain";
import type { Database } from "@/db/client";
import { customCategories, expenseShares, expenses, groups, members, settlements, user } from "@/db/schema";
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

/**
 * A User's Groups in Postgres: the Groups where they are a Linked Member.
 * Every query is scoped to that User, so other Users' Groups never leak.
 */
export function createPostgresGroupRepository(
  db: Database,
  currentUser: GroupUser,
  newId: () => string = () => crypto.randomUUID(),
): GroupRepository {
  const isLinkedMember = exists(
    db
      .select({ one: members.id })
      .from(members)
      // A Former Member no longer sees the Group.
      .where(
        and(
          eq(members.groupId, groups.id),
          eq(members.userId, currentUser.id),
          eq(members.former, false),
        ),
      ),
  );

  async function load(groupId?: string): Promise<GroupSnapshot[]> {
    const groupRows = await db
      .select()
      .from(groups)
      .where(groupId ? and(isLinkedMember, eq(groups.id, groupId)) : isLinkedMember)
      .orderBy(asc(groups.createdAt), asc(groups.id));
    if (groupRows.length === 0) return [];

    const ids = groupRows.map((g) => g.id);
    const [memberRows, expenseRows, shareRows, settlementRows, categoryRows] = await Promise.all([
      db
        .select()
        .from(members)
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
        .filter((m) => m.groupId === g.id)
        .map((m) => ({
          id: m.id,
          name: m.name,
          avatarColor: m.avatarColor,
          ...(m.email ? { email: m.email } : {}),
          ...(m.userId ? { userId: m.userId } : {}),
          ...(m.former ? { former: true } : {}),
        })),
      customCategories: categoryRows
        .filter((c) => c.groupId === g.id)
        .map((c) => ({ id: c.id, name: c.name })),
      expenses: expenseRows
        .filter((e) => e.groupId === g.id)
        .map(
          (e): Expense => ({
            id: e.id,
            description: e.description,
            amount: e.amount,
            currency: e.currency as CurrencyCode,
            lockedRate: e.lockedRate,
            ...(e.manualRate ? { manualRate: true } : {}),
            payerId: e.payerId,
            splitType: e.splitType as SplitType,
            shares: shareRows
              .filter((s) => s.share.expenseId === e.id)
              .map((s) => ({
                memberId: s.share.memberId,
                amount: s.share.amount,
                ...(s.share.percentage !== null ? { percentage: s.share.percentage } : {}),
                ...(s.share.ratio !== null ? { ratio: s.share.ratio } : {}),
              })),
            date: e.date,
            createdAt: e.createdAt.toISOString(),
            category: e.category,
            ...(e.notes ? { notes: e.notes } : {}),
          }),
        ),
      settlements: settlementRows
        .filter((s) => s.groupId === g.id)
        .map((s) => ({
          id: s.id,
          fromId: s.fromMemberId,
          toId: s.toMemberId,
          amount: s.amount,
          date: s.date,
          createdAt: s.createdAt.toISOString(),
        })),
    }));
  }

  async function canSee(groupId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(isLinkedMember, eq(groups.id, groupId)));
    return row !== undefined;
  }

  async function findExpense(groupId: string, expenseId: string): Promise<Expense | null> {
    const [group] = await load(groupId);
    return group?.expenses.find((e) => e.id === expenseId) ?? null;
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
      if (!(await canSee(groupId))) return null;
      const expenseId = `exp_${newId()}`;
      await db.transaction(async (tx) => {
        await tx.insert(expenses).values({ id: expenseId, groupId, ...expenseColumns(input) });
        await insertShares(tx, expenseId, input);
      });
      return findExpense(groupId, expenseId);
    },
    async updateExpense(groupId, expenseId, input) {
      if (!(await canSee(groupId))) return null;
      const updated = await db.transaction(async (tx) => {
        const rows = await tx
          .update(expenses)
          .set(expenseColumns(input))
          .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
          .returning({ id: expenses.id });
        if (rows.length === 0) return false;
        await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
        await insertShares(tx, expenseId, input);
        return true;
      });
      return updated ? findExpense(groupId, expenseId) : null;
    },
    async deleteExpense(groupId, expenseId) {
      if (!(await canSee(groupId))) return false;
      const rows = await db
        .delete(expenses)
        .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
        .returning({ id: expenses.id });
      return rows.length > 0;
    },
    async addSettlement(groupId, input) {
      if (!(await canSee(groupId))) return null;
      // Both Members must belong to this Group, not merely exist.
      const found = await db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.groupId, groupId), inArray(members.id, [input.fromId, input.toId])));
      if (found.length !== new Set([input.fromId, input.toId]).size) return null;
      const settlementId = `stl_${newId()}`;
      await db.insert(settlements).values({
        id: settlementId,
        groupId,
        fromMemberId: input.fromId,
        toMemberId: input.toId,
        amount: input.amount,
        date: input.date,
      });
      const [group] = await load(groupId);
      return group?.settlements.find((s) => s.id === settlementId) ?? null;
    },
    async deleteSettlement(groupId, settlementId) {
      if (!(await canSee(groupId))) return false;
      const rows = await db
        .delete(settlements)
        .where(and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId)))
        .returning({ id: settlements.id });
      return rows.length > 0;
    },
    async updateGroup(id, details) {
      if (!(await canSee(id))) return null;
      await db
        .update(groups)
        .set({ name: details.name, description: details.description, currency: details.currency })
        .where(eq(groups.id, id));
      const [group] = await load(id);
      return group ?? null;
    },
    async addMember(groupId, { name, email }) {
      if (!(await canSee(groupId))) return null;
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
      if (!(await canSee(groupId))) return null;
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
      if (!(await canSee(groupId))) return false;
      const rows = await db
        .update(members)
        .set({ former: true })
        .where(and(eq(members.id, memberId), eq(members.groupId, groupId)))
        .returning({ id: members.id });
      return rows.length > 0;
    },
    async addCategory(groupId, name) {
      if (!(await canSee(groupId))) return null;
      const id = `cat_${newId()}`;
      await db.insert(customCategories).values({ id, groupId, name });
      return { id, name };
    },
    async renameCategory(groupId, categoryId, name) {
      if (!(await canSee(groupId))) return null;
      const rows = await db
        .update(customCategories)
        .set({ name })
        .where(and(eq(customCategories.id, categoryId), eq(customCategories.groupId, groupId)))
        .returning({ id: customCategories.id });
      return rows.length > 0 ? { id: categoryId, name } : null;
    },
    async deleteCategory(groupId, categoryId) {
      if (!(await canSee(groupId))) return false;
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
    async deleteGroup(id) {
      // Only the Group Creator may delete a Group, so scope the delete to them.
      const rows = await db
        .delete(groups)
        .where(and(eq(groups.id, id), eq(groups.creatorUserId, currentUser.id)))
        .returning({ id: groups.id });
      return rows.length > 0;
    },
  };
}
