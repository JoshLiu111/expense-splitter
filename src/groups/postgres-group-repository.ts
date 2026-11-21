import { and, asc, desc, eq, exists, inArray, isNotNull, isNull, max, ne, notExists, sql } from "drizzle-orm";
import {
  changedGroupDetails,
  computeLedger,
  convertedRate,
  groupCurrenciesThen,
  isPendingMember,
  isSameExpense,
  type ActivityChange,
  type ActivityMember,
  type CurrencyCode,
  type EditingMode,
  type Expense,
  type GroupSnapshot,
  type NewExpense,
  type Settlement,
  type SplitType,
} from "@/domain";
import type { Database, Transaction } from "@/db/client";
import {
  activity,
  customCategories,
  expenseShares,
  expenses,
  groups,
  invitations,
  members,
  settlements,
  user,
} from "@/db/schema";
import {
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
  newInvitationToken,
} from "@/invitations/invitation-token";
import { AVATAR_COLORS, nextAvatarColor, type GroupRepository } from "./group-repository";

/** The signed-in User a repository acts for. */
export interface GroupUser {
  id: string;
  name: string;
  email: string;
}

type Tx = Transaction;

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
 * The rows of Pending Members (`isPendingMember`): an email, no User yet,
 * not removed.
 */
const pendingMembers = () => and(isNotNull(members.email), isNull(members.userId), eq(members.former, false));

type MemberRow = typeof members.$inferSelect;

/** Inserts one Activity entry; every entry is recorded through here. */
async function insertActivity(tx: Tx, id: string, groupId: string, actorMemberId: string, change: ActivityChange) {
  await tx.insert(activity).values({ id: `act_${id}`, groupId, actorMemberId, change });
}

/**
 * One Member of the Group, locked until the transaction ends, with how
 * Activity names them now: a Linked Member under their User's name.
 * `null` if they aren't in that Group.
 */
async function lockMember(tx: Tx, groupId: string, memberId: string): Promise<{ row: MemberRow; asNamed: ActivityMember } | null> {
  const [row] = await tx
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.groupId, groupId)))
    .for("update");
  if (!row) return null;
  return { row, asNamed: { id: row.id, name: await shownName(tx, row) } };
}

/** The name a Member is shown under: a Linked Member's is their User's. */
async function shownName(tx: Tx, row: Pick<MemberRow, "name" | "userId">): Promise<string> {
  if (!row.userId) return row.name;
  const [linked] = await tx.select({ name: user.name }).from(user).where(eq(user.id, row.userId));
  return linked?.name ?? row.name;
}

/**
 * Links a User who has just verified their email to every Pending Member
 * with that exact email, at most one per Group and never in a Group where
 * they are already linked. Former Members are left as they are. Pass a
 * transaction to make claiming part of it.
 */
export async function claimPendingMembers(
  db: Database | Transaction,
  verified: { id: string; email: string },
  newId: () => string = () => crypto.randomUUID(),
) {
  await db.transaction(async (tx) => {
    const pending = await tx
      .select({ id: members.id, groupId: members.groupId, name: members.name })
      .from(members)
      .where(and(eq(sql`lower(${members.email})`, verified.email.toLowerCase()), pendingMembers()))
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
      // Claiming is the User's own doing, so it is recorded under the Member they now are.
      const asNamed = { id: member.id, name: await shownName(tx, { name: member.name, userId: verified.id }) };
      await insertActivity(tx, newId(), member.groupId, member.id, { kind: "member-joined", member: asNamed });
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
    ...(e.recorderMemberId ? { recorderId: e.recorderMemberId } : {}),
  };
}

function toSettlement(s: SettlementRow): Settlement {
  return {
    id: s.id,
    fromId: s.fromMemberId,
    toId: s.toMemberId,
    amount: s.amount,
    currency: s.currency as CurrencyCode,
    lockedRate: s.lockedRate,
    ...(s.manualRate ? { manualRate: true } : {}),
    date: s.date,
    createdAt: s.createdAt.toISOString(),
    ...(s.recorderMemberId ? { recorderId: s.recorderMemberId } : {}),
  };
}

/**
 * Settlement Activity recorded before Settlements had a Settlement Currency
 * holds Settlements without one: they were in the Group Currency of the
 * time, at 1 (ADR 0009). The rows stay as recorded; they are only read that way.
 */
function withSettlementCurrency(change: ActivityChange, groupCurrency: CurrencyCode): ActivityChange {
  if (change.kind !== "settlement-added" && change.kind !== "settlement-deleted") return change;
  const recorded: Partial<Settlement> = change.settlement;
  if (recorded.currency) return change;
  return { ...change, settlement: { ...change.settlement, currency: groupCurrency, lockedRate: "1" } };
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
  now: () => Date = () => new Date(),
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
    const [memberRows, expenseRows, shareRows, settlementRows, categoryRows, invitationRows] = await Promise.all([
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
      // Each Member's latest Invitation: whether it was sent is shown.
      db
        .selectDistinctOn([invitations.memberId], { memberId: invitations.memberId, sentAt: invitations.sentAt })
        .from(invitations)
        .where(inArray(invitations.groupId, ids))
        .orderBy(invitations.memberId, desc(invitations.seq)),
    ]);
    const sentInvitation = new Map(invitationRows.map((r) => [r.memberId, r.sentAt !== null]));

    return groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      currency: g.currency as CurrencyCode,
      editingMode: g.editingMode as EditingMode,
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
          ...(isPendingMember(m) ? { invitationSent: sentInvitation.get(m.id) ?? false } : {}),
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
   * A caller that has already looked that Member up passes it as `actorMemberId`.
   */
  async function record(tx: Tx, groupId: string, change: ActivityChange, actorMemberId?: string) {
    actorMemberId ??= await linkedMemberId(tx, groupId);
    await insertActivity(tx, newId(), groupId, actorMemberId, change);
  }

  /**
   * The User's Linked Member in a Group `canChange` already found: the actor
   * of their Activity entries and the Recorder of what they record.
   */
  async function linkedMemberId(tx: Tx, groupId: string): Promise<string> {
    const [me] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.groupId, groupId), eq(members.userId, currentUser.id)));
    return me.id;
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
        const myMemberId = await linkedMemberId(tx, groupId);
        await tx.insert(expenses).values({ id: expenseId, groupId, ...expenseColumns(input), recorderMemberId: myMemberId });
        await insertShares(tx, expenseId, input);
        const expense = (await lockExpense(tx, groupId, expenseId))!;
        await record(tx, groupId, { kind: "expense-added", expense }, myMemberId);
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
        const myMemberId = await linkedMemberId(tx, groupId);
        const [row] = await tx
          .insert(settlements)
          .values({
            id: `stl_${newId()}`,
            groupId,
            fromMemberId: input.fromId,
            toMemberId: input.toId,
            amount: input.amount,
            currency: input.currency,
            lockedRate: input.lockedRate,
            manualRate: input.manualRate ?? false,
            date: input.date,
            recorderMemberId: myMemberId,
          })
          .returning();
        const settlement = toSettlement(row);
        await record(tx, groupId, { kind: "settlement-added", settlement }, myMemberId);
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
      await db.transaction(async (tx) => {
        const [before] = await tx
          .select({ name: groups.name, description: groups.description })
          .from(groups)
          .where(eq(groups.id, id))
          .for("update");
        const after = { name: details.name, description: details.description };
        if (!before || changedGroupDetails(before, after).length === 0) return;
        await tx.update(groups).set(after).where(eq(groups.id, id));
        await record(tx, id, { kind: "group-details-edited", before, after });
      });
      const [group] = await load(id);
      return group ?? null;
    },
    async changeGroupCurrency(id, change) {
      // Only the Group Creator may, and only while they are a Linked Member.
      if (!(await canChange(id))) return null;
      const changed = await db.transaction(async (tx) => {
        // Locking the Group makes a second change wait, then find it changed.
        const [group] = await tx
          .select({ currency: groups.currency })
          .from(groups)
          .where(and(eq(groups.id, id), eq(groups.creatorUserId, currentUser.id)))
          .for("update");
        if (group?.currency !== change.from) return false;
        await tx.update(groups).set({ currency: change.to }).where(eq(groups.id, id));
        for (const table of [expenses, settlements]) {
          const rows = await tx
            .select({ id: table.id, currency: table.currency, lockedRate: table.lockedRate, manualRate: table.manualRate })
            .from(table)
            .where(eq(table.groupId, id))
            .for("update");
          // One update per converted rate: records sharing a rate share one.
          const byRate = new Map<string, { lockedRate: string; manualRate: boolean; ids: string[] }>();
          for (const row of rows) {
            const converted = convertedRate({ ...row, currency: row.currency as CurrencyCode }, change);
            const key = `${converted.lockedRate} ${converted.manualRate}`;
            const batch = byRate.get(key) ?? { ...converted, ids: [] };
            batch.ids.push(row.id);
            byRate.set(key, batch);
          }
          for (const { lockedRate, manualRate, ids } of byRate.values()) {
            await tx.update(table).set({ lockedRate, manualRate }).where(inArray(table.id, ids));
          }
        }
        const { from, to, rate } = change;
        await record(tx, id, { kind: "currency-changed", from, to, rate });
        return true;
      });
      if (!changed) return null;
      const [group] = await load(id);
      return group ?? null;
    },
    async setEditingMode(id, mode) {
      // Only the Group Creator may, and only while they are a Linked Member.
      if (!(await canChange(id))) return null;
      const allowed = await db.transaction(async (tx) => {
        const [group] = await tx
          .select({ editingMode: groups.editingMode })
          .from(groups)
          .where(and(eq(groups.id, id), eq(groups.creatorUserId, currentUser.id)))
          .for("update");
        if (!group) return false;
        const before = group.editingMode as EditingMode;
        if (before === mode) return true;
        await tx.update(groups).set({ editingMode: mode }).where(eq(groups.id, id));
        await record(tx, id, { kind: "editing-mode-changed", before, after: mode });
        return true;
      });
      if (!allowed) return null;
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
        const [row] = await tx
          .insert(members)
          .values({
            id: memberId,
            groupId,
            name,
            email: email ?? null,
            userId: email ? await userToLink(tx, groupId, email) : null,
            avatarColor: nextAvatarColor(existing),
            position: (last ?? -1) + 1,
          })
          .returning();
        const member = { id: memberId, name: await shownName(tx, row) };
        await record(tx, groupId, { kind: "member-added", member });
      });
      const [group] = await load(groupId);
      return group?.members.find((m) => m.id === memberId) ?? null;
    },
    async setMemberEmail(groupId, memberId, email) {
      if (!(await canChange(groupId))) return null;
      const updated = await db.transaction(async (tx) => {
        const before = await lockMember(tx, groupId, memberId);
        // A Linked Member's email is their User's, so leave it alone.
        if (!before || before.row.userId) return false;
        if (before.row.email === email) return true;
        await tx
          .update(members)
          .set({ email, userId: await userToLink(tx, groupId, email) })
          .where(eq(members.id, memberId));
        await record(tx, groupId, { kind: "member-email-set", member: before.asNamed, email });
        return true;
      });
      if (!updated) return null;
      const [group] = await load(groupId);
      return group?.members.find((m) => m.id === memberId) ?? null;
    },
    async issueInvitation(groupId, memberId) {
      if (!(await canChange(groupId))) return null;
      const [pending] = await db
        .select({ email: members.email })
        .from(members)
        .where(and(eq(members.id, memberId), eq(members.groupId, groupId), pendingMembers()));
      if (!pending?.email) return null;
      const token = newInvitationToken();
      const issuedAt = now();
      // Older Invitations stop working because this one is newer.
      await db.insert(invitations).values({
        id: `inv_${newId()}`,
        tokenHash: hashInvitationToken(token),
        memberId,
        groupId,
        email: pending.email.toLowerCase(),
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + INVITATION_LIFETIME_MS),
      });
      return token;
    },
    async recordInvitationSent(groupId, token) {
      if (!(await canChange(groupId))) return false;
      return db.transaction(async (tx) => {
        const [sent] = await tx
          .select()
          .from(invitations)
          .where(and(eq(invitations.tokenHash, hashInvitationToken(token)), eq(invitations.groupId, groupId)))
          .for("update");
        if (!sent) return false;
        // Recording the same sending twice changes nothing.
        if (sent.sentAt) return true;
        await tx.update(invitations).set({ sentAt: now() }).where(eq(invitations.id, sent.id));
        const pending = (await lockMember(tx, groupId, sent.memberId))!;
        const [earlier] = await tx
          .select({ id: invitations.id })
          .from(invitations)
          .where(
            and(
              eq(invitations.memberId, sent.memberId),
              eq(invitations.email, sent.email),
              isNotNull(invitations.sentAt),
              ne(invitations.id, sent.id),
            ),
          )
          .limit(1);
        await record(tx, groupId, {
          kind: "member-invited",
          member: pending.asNamed,
          email: sent.email,
          resent: earlier !== undefined,
        });
        return true;
      });
    },
    async removeMember(groupId, memberId) {
      if (!(await canChange(groupId))) return false;
      return db.transaction(async (tx) => {
        const member = await lockMember(tx, groupId, memberId);
        if (!member) return false;
        if (member.row.former) return true;
        await tx.update(members).set({ former: true }).where(eq(members.id, memberId));
        await record(tx, groupId, { kind: "member-removed", member: member.asNamed });
        return true;
      });
    },
    async addCategory(groupId, name) {
      if (!(await canChange(groupId))) return null;
      const category = { id: `cat_${newId()}`, name };
      await db.transaction(async (tx) => {
        await tx.insert(customCategories).values({ ...category, groupId });
        await record(tx, groupId, { kind: "category-added", category });
      });
      return category;
    },
    async renameCategory(groupId, categoryId, name) {
      if (!(await canChange(groupId))) return null;
      return db.transaction(async (tx) => {
        const [before] = await tx
          .select({ id: customCategories.id, name: customCategories.name })
          .from(customCategories)
          .where(and(eq(customCategories.id, categoryId), eq(customCategories.groupId, groupId)))
          .for("update");
        if (!before) return null;
        const after = { id: categoryId, name };
        if (before.name === name) return after;
        await tx.update(customCategories).set({ name }).where(eq(customCategories.id, categoryId));
        await record(tx, groupId, { kind: "category-renamed", before, after });
        return after;
      });
    },
    async deleteCategory(groupId, categoryId) {
      if (!(await canChange(groupId))) return false;
      return db.transaction(async (tx) => {
        // Never delete a Category an Expense uses, even one recorded a moment ago.
        const [row] = await tx
          .delete(customCategories)
          .where(
            and(
              eq(customCategories.id, categoryId),
              eq(customCategories.groupId, groupId),
              notExists(
                tx
                  .select({ one: expenses.id })
                  .from(expenses)
                  .where(and(eq(expenses.groupId, groupId), eq(expenses.category, categoryId))),
              ),
            ),
          )
          .returning({ id: customCategories.id, name: customCategories.name });
        if (!row) return false;
        await record(tx, groupId, { kind: "category-deleted", category: row });
        return true;
      });
    },
    async listActivity(groupId) {
      const [group] = await load(groupId);
      if (!group) return null;
      const rows = await db
        .select()
        .from(activity)
        .where(eq(activity.groupId, groupId))
        .orderBy(desc(activity.seq));
      const currencies = groupCurrenciesThen(rows, group.currency);
      return rows.map((r, i) => ({
        id: r.id,
        at: r.at.toISOString(),
        actorMemberId: r.actorMemberId,
        change: withSettlementCurrency(r.change, currencies[i]),
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
