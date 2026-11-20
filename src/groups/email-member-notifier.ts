import "server-only";
import { addedToGroupEmail, invitationEmail, sendEmail } from "@/auth/email";
import type { MemberNotifier } from "./member-notifier";

/** The app's public origin, for links in emails. */
function appOrigin(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/** Emails the people a signed-in User adds to a Group, on that User's behalf. */
export function emailMemberNotifier(inviter: { name: string }): MemberNotifier {
  const inviterName = inviter.name;
  return {
    async invited({ groupName, email, token }) {
      const url = new URL(`/invite/${encodeURIComponent(token)}`, appOrigin()).toString();
      await sendEmail(invitationEmail({ to: email, groupName, inviterName }, url));
    },
    async added({ groupId, groupName, email }) {
      // Signed out, the Group's page sends them through sign-in and back (return-to).
      const url = new URL(`/groups/${encodeURIComponent(groupId)}`, appOrigin()).toString();
      await sendEmail(addedToGroupEmail({ to: email, groupName, inviterName }, url));
    },
  };
}
