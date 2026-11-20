import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { LiveGroupDetail } from "@/components/live-group-detail";
import { userGroupRepository } from "@/groups/user-groups";
import {
  clearUserSmallChange,
  deleteUserSettlement,
  recordUserSettlement,
  deleteUserExpense,
  saveUserExpense,
} from "./actions";

export default function GroupPage({ params }: PageProps<"/groups/[groupId]">) {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Loading Group…
        </p>
      }
    >
      <UserGroup params={params} />
    </Suspense>
  );
}

async function UserGroup({ params }: Pick<PageProps<"/groups/[groupId]">, "params">) {
  const { groupId } = await params;
  const user = await requireUser(`/groups/${groupId}`);
  // Groups the User isn't a Linked Member of look the same as missing ones.
  const group = await userGroupRepository(user).getGroup(groupId);
  if (!group) notFound();
  const me = group.members.find((m) => m.userId === user.id);
  return (
    <LiveGroupDetail
      group={group}
      backHref="/dashboard"
      backLabel="All Groups"
      settingsHref={`/groups/${groupId}/settings`}
      activityHref={`/groups/${groupId}/activity`}
      currentMemberId={me?.id}
      // Only a Former Member with a reopened Balance gets here as one (ADR 0006).
      readOnly={me?.former === true}
      onSaveExpense={saveUserExpense.bind(null, groupId)}
      onDeleteExpense={deleteUserExpense.bind(null, groupId)}
      settleUp={{
        record: recordUserSettlement.bind(null, groupId),
        delete: deleteUserSettlement.bind(null, groupId),
        clearSmallChange: clearUserSmallChange.bind(null, groupId),
      }}
    />
  );
}
