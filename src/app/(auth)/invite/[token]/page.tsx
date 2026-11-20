import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signInPath } from "@/auth/return-to";
import { getCurrentUser } from "@/auth/session";
import { FormCard } from "@/components/form";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { createInvitations, invitationExplanation, type InvitationProblem } from "@/invitations/invitations";
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
  const user = await getCurrentUser();
  // Signing in comes back here, to use the Invitation as that User.
  const signInHere = signInPath(`/invite/${encodeURIComponent(token)}`);

  if (found.status === "used") {
    // Its User goes back into the Group; anyone else is told it was used.
    if (user && found.claimedBy === user.id) redirect(`/groups/${encodeURIComponent(found.groupId)}`);
    return <Problem status="used" signIn={user ? undefined : signInHere} />;
  }
  if (found.status !== "valid") return <Problem status={found.status} />;

  if (user) {
    const accepted = await invitations.accept(token, user);
    if (accepted.ok) redirect(`/groups/${encodeURIComponent(accepted.groupId)}`);
    return <Problem status={accepted.status} />;
  }
  if (found.hasAccount) redirect(signInHere);
  return (
    <AuthForm
      mode="sign-up"
      invitation={{ token, email: found.email, groupName: found.groupName }}
    />
  );
}

/**
 * Why an Invitation link doesn't work. With `signIn`, offers the User who
 * used it a way back into the Group.
 */
function Problem({ status, signIn }: { status: InvitationProblem; signIn?: string }) {
  const { title, message } = invitationExplanation(status);
  return (
    <section aria-labelledby="invite-heading" className="mx-auto flex max-w-md flex-col gap-6">
      <h1 id="invite-heading" className="text-2xl font-extrabold">
        {title}
      </h1>
      <FormCard>
        <p>{message}</p>
        {signIn && <p className="mt-2">If it was you, sign in to open the Group.</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {signIn && (
            <Button asChild>
              <Link href={signIn}>Sign in</Link>
            </Button>
          )}
          <Button asChild variant={signIn ? "outline" : "default"}>
            <Link href="/">Go to Expense Splitter</Link>
          </Button>
        </div>
      </FormCard>
    </section>
  );
}
