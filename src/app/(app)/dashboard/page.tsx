import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser } from "@/auth/session";
import { GroupList } from "@/components/group-list";
import { Button } from "@/components/ui/button";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { claimUserPendingMembers, userGroupRepository } from "@/groups/user-groups";

export const metadata: Metadata = { title: "Your Groups · Expense Splitter" };

export default function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-heading" className="mx-auto max-w-content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="dashboard-heading" className="text-2xl font-extrabold">
          Your Groups
        </h1>
        <Button asChild>
          <Link href="/groups/new">
            <Plus aria-hidden /> New Group
          </Link>
        </Button>
      </div>
      <div className="mt-6">
        <Suspense
          fallback={
            <p className="text-text-secondary" role="status">
              Loading Groups…
            </p>
          }
        >
          <UserGroups />
        </Suspense>
      </div>
    </section>
  );
}

async function UserGroups() {
  const user = await requireUser("/dashboard");
  // Verifying claims Pending Members; this catches any added since, or a claim that failed.
  await claimUserPendingMembers(user);
  const groups = await userGroupRepository(user).listGroups();

  return (
    <>
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-input p-6 text-center">
          <h2 className="text-lg font-bold">No Groups yet</h2>
          <p className="mt-1 text-text-secondary">
            Create a Group for your flat, a trip or a night out, then add Expenses.
          </p>
        </div>
      ) : (
        <GroupList groups={groups} basePath="/groups" viewerUserId={user.id} />
      )}
    </>
  );
}
