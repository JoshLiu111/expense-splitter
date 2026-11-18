import { and, asc, eq, exists, inArray } from "drizzle-orm";
import type { CurrencyCode, Expense, GroupSnapshot, SplitType } from "@/domain";
import type { Database } from "@/db/client";
import { expenseShares, expenses, groups, members, settlements } from "@/db/schema";
import { AVATAR_COLORS, type GroupRepository } from "./group-repository";

/** The signed-in User a repository acts for. */
export interface GroupUser {
  id: string;
  name: string;
  email: string;
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
      .where(and(eq(members.groupId, groups.id), eq(members.userId, currentUser.id))),
  );

  async function load(groupId?: string): Promise<GroupSnapshot[]> {
    const groupRows = await db
      .select()
      .from(groups)
      .where(groupId ? and(isLinkedMember, eq(groups.id, groupId)) : isLinkedMember)
      .orderBy(asc(groups.createdAt), asc(groups.id));
    if (groupRows.length === 0) return [];

    const ids = groupRows.map((g) => g.id);
    const [memberRows, expenseRows, shareRows, settlementRows] = await Promise.all([
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
        })),
      expenses: expenseRows
        .filter((e) => e.groupId === g.id)
        .map(
          (e): Expense => ({
            id: e.id,
            description: e.description,
            amount: e.amount,
            currency: e.currency as CurrencyCode,
            lockedRate: e.lockedRate,
            payerId: e.payerId,
            splitType: e.splitType as SplitType,
            shares: shareRows
              .filter((s) => s.share.expenseId === e.id)
              .map((s) => ({ memberId: s.share.memberId, amount: s.share.amount })),
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
  };
}
