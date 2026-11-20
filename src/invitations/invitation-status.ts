/**
 * Why an Invitation's link does or doesn't work: `superseded` by a newer
 * Invitation to the same Pending Member, `revoked` because the Pending
 * Member was removed (or given another email), `used` once it or another
 * way of verifying the email has claimed the Pending Member.
 */
export type InvitationStatus = "valid" | "expired" | "superseded" | "revoked" | "used" | "unknown";

/** What an Invitation's status depends on: it, and the Member it was sent to now. */
export interface InvitationState {
  /** The email it was sent to, lower-cased. */
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  /** Its place among its Pending Member's Invitations, and the newest's. */
  seq: number;
  latestSeq: number | null;
  memberEmail: string | null;
  memberUserId: string | null;
  former: boolean;
}

/**
 * Whether a known Invitation works at `now`, and if not why. A used link
 * says so first; then one whose Member is no longer waiting for that email
 * was revoked, or claimed already; an older link was superseded before it
 * could expire.
 */
export function invitationStatus(
  invitation: InvitationState,
  now: Date,
): Exclude<InvitationStatus, "unknown"> {
  if (invitation.usedAt) return "used";
  if (invitation.former || invitation.memberEmail?.toLowerCase() !== invitation.email) return "revoked";
  if (invitation.memberUserId) return "used";
  if (invitation.seq !== invitation.latestSeq) return "superseded";
  if (now.getTime() >= invitation.expiresAt.getTime()) return "expired";
  return "valid";
}
