import { createHash, randomBytes } from "node:crypto";

/** How long an Invitation works after it is issued. */
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** A new random Invitation token, URL-safe; only its hash is ever stored. */
export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The hash an Invitation token is stored and looked up under. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
