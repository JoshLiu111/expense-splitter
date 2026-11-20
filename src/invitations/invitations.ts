import { and, eq, isNull, max, sql } from "drizzle-orm";
import type { Database, Transaction } from "@/db/client";
import { account, groups, invitations, members, user } from "@/db/schema";
import { claimPendingMembers } from "@/groups/postgres-group-repository";
import { hashInvitationToken } from "./invitation-token";
import { invitationStatus, type InvitationStatus } from "./invitation-status";

export type { InvitationStatus } from "./invitation-status";

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
  | {
      status: "used";
      groupId: string;
      /** The User whose Linked Member it became, who is taken into the Group. */
      claimedBy?: string;
    }
  | { status: Exclude<InvitationStatus, "valid" | "used" | "unknown">; groupId: string }
  | { status: "unknown" };

/** What following an Invitation as a signed-in User does. */
export type AcceptInvitationResult =
  | { ok: true; groupId: string }
  | { ok: false; status: Exclude<InvitationStatus, "valid"> | "wrong-email" };

/** The account to create for someone signing up through an Invitation. */
export interface NewInvitedUser {
  id: string;
  /** The id of the credential account holding their password. */
  accountId: string;
  name: string;
  passwordHash: string;
}

/** What signing up through an Invitation does: `registered` if the email already has an account. */
export type InvitationSignUpOutcome = AcceptInvitationResult | { ok: false; status: "registered" };

/** Undoes a sign-up whose Invitation couldn't be used, carrying why. */
class Unused extends Error {
  constructor(readonly result: Extract<AcceptInvitationResult, { ok: false }>) {
    super(`Invitation not used: ${result.status}`);
  }
}

/** Whether Postgres refused a write because a unique value was taken. */
function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; typeof e === "object" && e !== null; e = (e as { cause?: unknown }).cause)
    if ((e as { code?: unknown }).code === "23505") return true;
  return false;
}

/**
 * Invitations (ADR 0007): the one-time links emailed to Pending Members.
 * `now` is the clock they expire by.
 */
export function createInvitations(db: Database, now: () => Date = () => new Date()) {
  async function find(token: string, executor: Database | Transaction = db) {
    const latest = db
      .select({ memberId: invitations.memberId, seq: max(invitations.seq).as("latest_seq") })
      .from(invitations)
      .groupBy(invitations.memberId)
      .as("latest");
    const [row] = await executor
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
    const status = invitationStatus(row, now());
    return { ...row, status };
  }

  return {
    /** What the Invitation with this token leads to now. */
    async lookUp(token: string): Promise<InvitationLookup> {
      const found = await find(token);
      if (!found) return { status: "unknown" };
      if (found.status === "used")
        return {
          status: "used",
          groupId: found.groupId,
          ...(found.memberUserId ? { claimedBy: found.memberUserId } : {}),
        };
      if (found.status !== "valid") return { status: found.status, groupId: found.groupId };
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(sql`lower(${user.email})`, found.email));
      return {
        status: "valid",
        email: found.email,
        groupId: found.groupId,
        groupName: found.groupName,
        hasAccount: existing !== undefined,
      };
    },

    /**
     * Uses the Invitation for the User with the email it was sent to.
     * Following the link proves they control that inbox, so their email is
     * now verified (ADR 0007) and, as verifying does, claims every Pending
     * Member with it. Answers the Group to take them to.
     */
    async accept(token: string, holder: { id: string; email: string }): Promise<AcceptInvitationResult> {
      return db.transaction((tx) => acceptIn(tx, token, holder));
    },

    /**
     * Creates an account, with a credential password, for the email the
     * Invitation was sent to, and uses the Invitation for it, all at once:
     * if any step fails nothing is kept and the link still works. Answers
     * `registered` if that email has an account, even one created a moment
     * ago by a concurrent sign-up.
     */
    async signUp(token: string, newUser: NewInvitedUser): Promise<InvitationSignUpOutcome> {
      try {
        return await db.transaction(async (tx) => {
          const found = await find(token, tx);
          if (found?.status !== "valid") return { ok: false, status: found?.status ?? "unknown" };
          const [created] = await tx
            .insert(user)
            .values({ id: newUser.id, name: newUser.name, email: found.email, emailVerified: false })
            .returning({ id: user.id, email: user.email });
          await tx.insert(account).values({
            id: newUser.accountId,
            userId: created.id,
            accountId: created.id,
            providerId: "credential",
            password: newUser.passwordHash,
          });
          const used = await acceptIn(tx, token, created);
          // Nothing of the account is kept if the Invitation can't be used.
          if (!used.ok) throw new Unused(used);
          return used;
        });
      } catch (error) {
        if (error instanceof Unused) return error.result;
        if (isUniqueViolation(error)) return { ok: false, status: "registered" };
        throw error;
      }
    },
  };

  /**
   * Uses the Invitation in `tx` for `holder`: marks it used, verifies the
   * email and claims its Pending Members, so a failure in any step undoes
   * all of them and leaves the link working. Marking it used only while
   * unused makes a second, concurrent use wait for the first, then fail.
   */
  async function acceptIn(
    tx: Transaction,
    token: string,
    holder: { id: string; email: string },
  ): Promise<AcceptInvitationResult> {
    const found = await find(token, tx);
    if (!found) return { ok: false, status: "unknown" };
    if (found.status !== "valid") return { ok: false, status: found.status };
    if (holder.email.toLowerCase() !== found.email) return { ok: false, status: "wrong-email" };
    const used = await tx
      .update(invitations)
      .set({ usedAt: now() })
      .where(and(eq(invitations.id, found.id), isNull(invitations.usedAt)))
      .returning({ id: invitations.id });
    if (used.length === 0) return { ok: false, status: "used" };
    await tx.update(user).set({ emailVerified: true }).where(eq(user.id, holder.id));
    await claimPendingMembers(tx, holder);
    return { ok: true, groupId: found.groupId };
  }
}

export type Invitations = ReturnType<typeof createInvitations>;

/** Why an Invitation link didn't take someone into its Group. */
export type InvitationProblem = Exclude<InvitationStatus, "valid"> | "wrong-email";

/** The page shown for an Invitation link that doesn't work: its heading and why. */
export function invitationExplanation(status: InvitationProblem): { title: string; message: string } {
  switch (status) {
    case "expired":
      return {
        title: "This Invitation has expired",
        message: "Invitations work for 7 days. Ask the person who invited you to send a new one.",
      };
    case "superseded":
      return {
        title: "There's a newer Invitation",
        message: "A newer Invitation to this Group was sent to your email. Use the link in the latest one.",
      };
    case "revoked":
      return {
        title: "This Invitation was withdrawn",
        message: "The Group no longer has a Member waiting for this email, so the link doesn't work any more.",
      };
    case "used":
      return {
        title: "This Invitation was already used",
        message: "Each Invitation works once, and this one has already been used to join the Group.",
      };
    case "wrong-email":
      return {
        title: "This Invitation is for someone else",
        message: "It was sent to a different email. Sign out, then open the link again.",
      };
    case "unknown":
      return {
        title: "This Invitation link isn't valid",
        message: "Check you copied all of it, or ask the person who invited you to send a new one.",
      };
  }
}

/** What to tell someone whose Invitation link doesn't work, in a sentence or two. */
export function invitationProblem(status: InvitationProblem): string {
  const { title, message } = invitationExplanation(status);
  return `${title}. ${message}`;
}
