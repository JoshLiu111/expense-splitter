import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { GroupSettingsView } from "@/components/group-settings-view";
import { userGroupRepository } from "@/groups/user-groups";
import {
  addUserCategory,
  addUserMember,
  deleteUserCategory,
  deleteUserGroup,
  removeUserMember,
  renameUserCategory,
  setUserMemberEmail,
  updateUserGroup,
} from "../actions";

export default function GroupSettingsPage({ params }: PageProps<"/groups/[groupId]/settings">) {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Loading Group settings…
        </p>
      }
    >
      <UserGroupSettings params={params} />
    </Suspense>
  );
}

async function UserGroupSettings({ params }: Pick<PageProps<"/groups/[groupId]/settings">, "params">) {
  const { groupId } = await params;
  const user = await requireUser(`/groups/${groupId}/settings`);
  // Groups the User isn't a Linked Member of look the same as missing ones.
  const group = await userGroupRepository(user).getGroup(groupId);
  if (!group) notFound();
  // A Former Member reading a reopened Balance can't change anything (ADR 0006).
  if (group.members.find((m) => m.userId === user.id)?.former) redirect(`/groups/${groupId}`);
  return (
    <GroupSettingsView
      group={group}
      groupHref={`/groups/${groupId}`}
      afterDeleteHref="/dashboard"
      manage={{
        updateDetails: updateUserGroup.bind(null, groupId),
        addMember: addUserMember.bind(null, groupId),
        setMemberEmail: setUserMemberEmail.bind(null, groupId),
        removeMember: removeUserMember.bind(null, groupId),
        deleteGroup: deleteUserGroup.bind(null, groupId),
      }}
      categories={{
        add: addUserCategory.bind(null, groupId),
        rename: renameUserCategory.bind(null, groupId),
        delete: deleteUserCategory.bind(null, groupId),
      }}
      isGroupCreator={group.creatorUserId === user.id}
    />
  );
}
