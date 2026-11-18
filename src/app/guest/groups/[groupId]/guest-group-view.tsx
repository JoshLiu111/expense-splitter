"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GroupDetail } from "@/components/group-detail";
import { deleteExpense, saveExpense } from "@/expenses/save-expense";
import { addMember, deleteGroup, removeMember, updateGroupDetails } from "@/groups/manage-group";
import { GUEST_MEMBER_NAME } from "@/guest/guest-repository";
import { guestRepository, useGuestGroups } from "@/guest/use-guest-groups";

export function GuestGroupView() {
  const { groupId } = useParams<{ groupId: string }>();
  const groups = useGuestGroups();

  if (groups === null) {
    return (
      <p className="text-text-secondary" role="status">
        Loading Group…
      </p>
    );
  }

  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    return (
      <section className="mx-auto max-w-content">
        <h1 className="text-2xl font-extrabold">Group not found</h1>
        <p className="mt-2 text-text-secondary">
          It may have been deleted in this session.{" "}
          <Link href="/guest" className="font-semibold text-accent underline">
            Back to your Groups
          </Link>
        </p>
      </section>
    );
  }

  return (
    <GroupDetail
      group={group}
      backHref="/guest"
      backLabel="All Groups"
      // A Guest's own Groups have a Name-only Member "You"; the sample
      // Groups don't, so their first Member pays by default.
      currentMemberId={group.members.find((m) => m.name === GUEST_MEMBER_NAME)?.id}
      onSaveExpense={(expenseId, fields) =>
        saveExpense(guestRepository(), group.id, expenseId, fields)
      }
      onDeleteExpense={(expenseId) => deleteExpense(guestRepository(), group.id, expenseId)}
      manage={{
        updateDetails: (fields) => updateGroupDetails(guestRepository(), group.id, fields),
        addMember: (name) => addMember(guestRepository(), group.id, name),
        removeMember: (memberId) => removeMember(guestRepository(), group.id, memberId),
        deleteGroup: () => deleteGroup(guestRepository(), group.id, { userId: undefined }),
      }}
      // A Guest made, or was handed, every Group in their session.
      isGroupCreator
    />
  );
}
