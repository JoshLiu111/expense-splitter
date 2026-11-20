import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signInPath } from "@/auth/return-to";
import { getCurrentUser } from "@/auth/session";
import { FormCard } from "@/components/form";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { createInvitations, invitationProblem } from "@/invitations/invitations";
import { AuthForm } from "../../auth-form";

export const metadata: Metadata = { title: "Join a Group · Expense Splitter" };

/**
 * Where an emailed Invitation lands. With no account yet, sign up as its
 * email; with one, sign in first. Signed in as that email, the Invitation is
 * used and the User goes straight into the Group.
 */
export default function Page({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Opening your Invitation…
        </p>
      }
    >
      <Invitation params={params} />
    </Suspense>
  );
}

async function Invitation({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const invitations = createInvitations(db());
  const found = await invitations.lookUp(token);
  if (found.status !== "valid") return <Problem message={invitationProblem(found.status)} />;

  const user = await getCurrentUser();
  if (user) {
    const accepted = await invitations.accept(token, user);
    if (accepted.ok) redirect(`/groups/${encodeURIComponent(accepted.groupId)}`);
    return <Problem message={invitationProblem(accepted.status)} />;
  }
  // Signing in comes back here, to use the Invitation as that User.
  if (found.hasAccount) redirect(signInPath(`/invite/${encodeURIComponent(token)}`));
  return (
    <AuthForm
      mode="sign-up"
      invitation={{ token, email: found.email, groupName: found.groupName }}
    />
  );
}

function Problem({ message }: { message: string }) {
  return (
    <section aria-labelledby="invite-heading" className="mx-auto flex max-w-md flex-col gap-6">
      <h1 id="invite-heading" className="text-2xl font-extrabold">
        This Invitation doesn&apos;t work
      </h1>
      <FormCard>
        <p role="alert">{message}</p>
        <Button asChild className="mt-4">
          <Link href="/">Go to Expense Splitter</Link>
        </Button>
      </FormCard>
    </section>
  );
}
