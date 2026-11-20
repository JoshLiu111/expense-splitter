import { and, eq, isNull, max, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { groups, invitations, members, user } from "@/db/schema";
import { claimPendingMembers } from "@/groups/postgres-group-repository";
import { hashInvitationToken } from "./invitation-token";

/**
 * Why an Invitation's link does or doesn't work: `superseded` by a newer
 * Invitation to the same Pending Member, `revoked` because the Pending
 * Member was removed (or given another email), `used` once it or another
 * way of verifying the email has claimed the Pending Member.
 */
export type InvitationStatus = "valid" | "expired" | "superseded" | "revoked" | "used" | "unknown";

/** What an Invitation's link leads to. */
export type InvitationLookup =
  | {
      status: "valid";
      /** The email it was sent to, the only one it can claim. */
      email: string;
      groupId: string;
      groupName: string;
      /** Whether a User already has that email, so should sign in rather than up. */
      hasAccount: boolean;
    }
  | { status: Exclude<InvitationStatus, "valid" | "unknown">; groupId: string }
  | { status: "unknown" };

/** What following an Invitation as a signed-in User does. */
export type AcceptInvitationResult =
  | { ok: true; groupId: string }
  | { ok: false; status: Exclude<InvitationStatus, "valid"> | "wrong-email" };

/**
 * Invitations (ADR 0007): the one-time links emailed to Pending Members.
 * `now` is the clock they expire by.
 */
export function createInvitations(db: Database, now: () => Date = () => new Date()) {
  async function find(token: string) {
    const latest = db
      .select({ memberId: invitations.memberId, seq: max(invitations.seq).as("latest_seq") })
      .from(invitations)
      .groupBy(invitations.memberId)
      .as("latest");
    const [row] = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        expiresAt: invitations.expiresAt,
        usedAt: invitations.usedAt,
        seq: invitations.seq,
        latestSeq: latest.seq,
        memberEmail: members.email,
        memberUserId: members.userId,
        former: members.former,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(invitations)
      .innerJoin(members, eq(members.id, invitations.memberId))
      .innerJoin(groups, eq(groups.id, invitations.groupId))
      .innerJoin(latest, eq(latest.memberId, invitations.memberId))
      .where(eq(invitations.tokenHash, hashInvitationToken(token)));
    if (!row) return null;
    const status: InvitationStatus = row.usedAt
      ? "used"
      : row.former || row.memberEmail?.toLowerCase() !== row.email
        ? "revoked"
        : row.memberUserId
          ? "used"
          : row.seq !== row.latestSeq
            ? "superseded"
            : now().getTime() >= row.expiresAt.getTime()
              ? "expired"
              : "valid";
    return { ...row, status };
  }

  return {
    /** What the Invitation with this token leads to now. */
    async lookUp(token: string): Promise<InvitationLookup> {
      const found = await find(token);
      if (!found) return { status: "unknown" };
      if (found.status !== "valid") return { status: found.status, groupId: found.groupId };
      const [account] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(sql`lower(${user.email})`, found.email));
      return {
        status: "valid",
        email: found.email,
        groupId: found.groupId,
        groupName: found.groupName,
        hasAccount: account !== undefined,
      };
    },

    /**
     * Uses the Invitation for the User with the email it was sent to.
     * Following the link proves they control that inbox, so their email is
     * now verified (ADR 0007) and, as verifying does, claims every Pending
     * Member with it. Answers the Group to take them to.
     */
    async accept(token: string, account: { id: string; email: string }): Promise<AcceptInvitationResult> {
      const found = await find(token);
      if (!found) return { ok: false, status: "unknown" };
      if (found.status !== "valid") return { ok: false, status: found.status };
      if (account.email.toLowerCase() !== found.email) return { ok: false, status: "wrong-email" };
      const used = await db.transaction(async (tx) => {
        const rows = await tx
          .update(invitations)
          .set({ usedAt: now() })
          .where(and(eq(invitations.id, found.id), isNull(invitations.usedAt)))
          .returning({ id: invitations.id });
        if (rows.length === 0) return false;
        await tx.update(user).set({ emailVerified: true }).where(eq(user.id, account.id));
        return true;
      });
      if (!used) return { ok: false, status: "used" };
      await claimPendingMembers(db, account);
      return { ok: true, groupId: found.groupId };
    },
  };
}

export type Invitations = ReturnType<typeof createInvitations>;


/** What to tell someone whose Invitation link doesn't work. */
export function invitationProblem(status: Exclude<InvitationStatus, "valid"> | "wrong-email"): string {
  switch (status) {
    case "expired":
      return "This Invitation has expired. Ask the person who invited you to send a new one.";
    case "superseded":
      return "A newer Invitation was sent to this email. Use the link in the latest one.";
    case "revoked":
      return "This Invitation is no longer valid.";
    case "used":
      return "This Invitation has already been used.";
    case "wrong-email":
      return "This Invitation was sent to a different email. Sign out, then open the link again.";
    case "unknown":
      return "This Invitation link isn't valid. Check you copied all of it.";
  }
}
