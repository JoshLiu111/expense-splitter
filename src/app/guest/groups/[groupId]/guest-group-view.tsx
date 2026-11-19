"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import type { GroupSnapshot } from "@/domain";
import { addCategory, deleteCategory, renameCategory } from "@/categories/manage-categories";
import { GroupDetail } from "@/components/group-detail";
import { GroupSettingsView } from "@/components/group-settings-view";
import { deleteExpense, saveExpense } from "@/expenses/save-expense";
import { addMember, deleteGroup, removeMember, updateGroupDetails } from "@/groups/manage-group";
import { clearSmallChange, deleteSettlement, recordSettlement } from "@/settlements/settle-up";
import { GUEST_MEMBER_NAME } from "@/guest/guest-repository";
import { guestRepository, useGuestGroups } from "@/guest/use-guest-groups";
import { fetchTodaysRates } from "@/rates/use-todays-rates";

/** Renders the session's Group named in the URL, or says it's missing. */
function GuestGroup({ children }: { children: (group: GroupSnapshot) => ReactNode }) {
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

  return children(group);
}

export function GuestGroupView() {
  return (
    <GuestGroup>
      {(group) => (
        <GroupDetail
          group={group}
          backHref="/guest"
          backLabel="All Groups"
          settingsHref={`/guest/groups/${group.id}/settings`}
          // A Guest's own Groups have a Name-only Member "You"; the sample
          // Groups don't, so their first Member pays by default.
          currentMemberId={group.members.find((m) => m.name === GUEST_MEMBER_NAME)?.id}
          onSaveExpense={(expenseId, fields) =>
            saveExpense(guestRepository(), group.id, expenseId, fields, fetchTodaysRates)
          }
          onDeleteExpense={(expenseId) => deleteExpense(guestRepository(), group.id, expenseId)}
          settleUp={{
            record: (fields) => recordSettlement(guestRepository(), group.id, fields),
            delete: (settlementId) => deleteSettlement(guestRepository(), group.id, settlementId),
            clearSmallChange: (date) => clearSmallChange(guestRepository(), group.id, date),
          }}
        />
      )}
    </GuestGroup>
  );
}

export function GuestGroupSettingsView() {
  return (
    <GuestGroup>
      {(group) => (
        <GroupSettingsView
          group={group}
          groupHref={`/guest/groups/${group.id}`}
          groupsHref="/guest"
          manage={{
            updateDetails: (fields) => updateGroupDetails(guestRepository(), group.id, fields),
            // Guests have no Users to link, so they add Name-only Members.
            addMember: ({ name }) => addMember(guestRepository(), group.id, { name }),
            removeMember: (memberId) => removeMember(guestRepository(), group.id, memberId),
            deleteGroup: () => deleteGroup(guestRepository(), group.id, { userId: undefined }),
          }}
          categories={{
            add: (fields) => addCategory(guestRepository(), group.id, fields),
            rename: (categoryId, fields) => renameCategory(guestRepository(), group.id, categoryId, fields),
            delete: (categoryId) => deleteCategory(guestRepository(), group.id, categoryId),
          }}
          // A Guest made, or was handed, every Group in their session.
          isGroupCreator
        />
      )}
    </GuestGroup>
  );
}
