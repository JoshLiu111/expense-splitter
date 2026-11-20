import "server-only";
import { addedToGroupEmail, sendEmail } from "@/auth/email";
import type { MemberNotifier } from "./member-notifier";

/** The app's public origin, for links in emails. */
function appOrigin(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/** Emails the people a signed-in User adds to a Group, on that User's behalf. */
export function emailMemberNotifier(inviter: { name: string }): MemberNotifier {
  return {
    inviterName: inviter.name,
    async added({ groupId, groupName, email, inviterName }) {
      // Signed out, the Group's page sends them through sign-in and back (return-to).
      const url = new URL(`/groups/${encodeURIComponent(groupId)}`, appOrigin()).toString();
      await sendEmail(addedToGroupEmail({ to: email, groupName, inviterName }, url));
    },
  };
}
