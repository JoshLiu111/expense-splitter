import type { Auth } from "@/auth/auth";
import { displayNameRuleError } from "@/auth/display-name";
import { passwordRuleError } from "@/auth/password";
import { invitationProblem, type Invitations } from "./invitations";

/** What signing up through an Invitation answers. */
export type InvitationSignUpResult =
  | { ok: true; email: string; groupId: string }
  | { ok: false; errors: { name?: string; password?: string; form?: string } };

const text = (record: unknown, key: string): string => {
  const value = typeof record === "object" && record !== null ? (record as Record<string, unknown>)[key] : "";
  return typeof value === "string" ? value : "";
};

/**
 * Creates an account for the email an Invitation was sent to (never one the
 * form sends), then uses the Invitation, which verifies that email and
 * claims its Pending Members (ADR 0007). No verification email is sent:
 * the link already proved the inbox. The caller signs the new User in.
 */
export async function signUpByInvitation(
  auth: Pick<Auth, "$context">,
  invitations: Invitations,
  input: unknown,
): Promise<InvitationSignUpResult> {
  const name = text(input, "name").trim();
  const password = text(input, "password");
  const errors: { name?: string; password?: string } = {};
  const nameError = displayNameRuleError(name);
  if (nameError) errors.name = nameError;
  const passwordError = passwordRuleError(password);
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const token = text(input, "token");
  const invitation = await invitations.lookUp(token);
  if (invitation.status !== "valid") return { ok: false, errors: { form: invitationProblem(invitation.status) } };
  if (invitation.hasAccount)
    return { ok: false, errors: { form: "This email is already registered. Sign in instead." } };

  // Better Auth's sign-up would email a verification link, so create the
  // account as it does, but without that email.
  const context = await auth.$context;
  const created = await context.internalAdapter.createUser(
    { email: invitation.email, name, emailVerified: false },
    { method: "email-password" },
  );
  await context.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await context.password.hash(password),
  });

  const accepted = await invitations.accept(token, created);
  if (!accepted.ok) return { ok: false, errors: { form: invitationProblem(accepted.status) } };
  return { ok: true, email: invitation.email, groupId: accepted.groupId };
}
