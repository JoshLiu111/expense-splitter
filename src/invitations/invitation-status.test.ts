import { describe, expect, it } from "vitest";
import { invitationStatus, type InvitationState } from "./invitation-status";

const now = new Date("2026-03-01T09:00:00Z");

/** The newest Invitation to Dev's Pending Member, sent to dev@example.com, not yet used or expired. */
const valid: InvitationState = {
  email: "dev@example.com",
  expiresAt: new Date("2026-03-05T09:00:00Z"),
  usedAt: null,
  seq: 2,
  latestSeq: 2,
  memberEmail: "dev@example.com",
  memberUserId: null,
  former: false,
};

describe("invitationStatus", () => {
  it("is valid while it is the Pending Member's newest and unexpired", () => {
    expect(invitationStatus(valid, now)).toBe("valid");
    expect(invitationStatus({ ...valid, memberEmail: "Dev@Example.com" }, now)).toBe("valid");
  });

  it("is expired from the moment it expires", () => {
    expect(invitationStatus({ ...valid, expiresAt: now }, now)).toBe("expired");
  });

  it("is superseded once a newer one was issued", () => {
    expect(invitationStatus({ ...valid, seq: 1 }, now)).toBe("superseded");
  });

  it("is revoked once the Member is removed or given another email, even if newest", () => {
    expect(invitationStatus({ ...valid, former: true }, now)).toBe("revoked");
    expect(invitationStatus({ ...valid, memberEmail: "other@example.com" }, now)).toBe("revoked");
    expect(invitationStatus({ ...valid, memberEmail: null }, now)).toBe("revoked");
  });

  it("is used once used, or once the Pending Member was claimed another way", () => {
    expect(invitationStatus({ ...valid, usedAt: now, former: true }, now)).toBe("used");
    expect(invitationStatus({ ...valid, memberUserId: "usr_dev", seq: 1 }, now)).toBe("used");
  });

  it("says revoked rather than used when a removed Member had been claimed", () => {
    expect(invitationStatus({ ...valid, memberUserId: "usr_dev", former: true }, now)).toBe("revoked");
  });

  it("says superseded rather than expired for an old link", () => {
    expect(invitationStatus({ ...valid, seq: 1, expiresAt: now }, now)).toBe("superseded");
  });
});
