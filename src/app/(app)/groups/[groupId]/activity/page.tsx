import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { GroupActivity } from "@/components/group-activity";
import { userGroupRepository } from "@/groups/user-groups";

export default function GroupActivityPage({ params, searchParams }: PageProps<"/groups/[groupId]/activity">) {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Loading Activity…
        </p>
      }
    >
      <UserGroupActivity params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function UserGroupActivity({
  params,
  searchParams,
}: Pick<PageProps<"/groups/[groupId]/activity">, "params" | "searchParams">) {
  const { groupId } = await params;
  const { expense } = await searchParams;
  const user = await requireUser(`/groups/${groupId}/activity`);
  const repo = userGroupRepository(user);
  // Groups the User isn't a Linked Member of look the same as missing ones.
  const [group, entries] = await Promise.all([repo.getGroup(groupId), repo.listActivity(groupId)]);
  if (!group || !entries) notFound();
  return (
    <GroupActivity
      group={group}
      entries={entries}
      groupHref={`/groups/${groupId}`}
      focusExpenseId={typeof expense === "string" ? expense : undefined}
    />
  );
}
