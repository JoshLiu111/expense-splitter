"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  editingModeBlock,
  groupDeletionBlock,
  groupManagementBlock,
  type GroupSnapshot,
  type ManagementAction,
  type Visitor,
} from "@/domain";
import type { CategoryManagement } from "@/categories/manage-categories";
import type { GroupManagement } from "@/groups/manage-group";
import { CategoriesSection } from "@/components/categories-section";
import {
  DeleteGroupSection,
  EditingModeSection,
  GroupDetailsSection,
  MembersSection,
  type NewsTone,
} from "@/components/group-settings";

/**
 * Everything a Member changes rarely: the Group's details, its Editing
 * Mode, its Categories, its Members, exporting it as CSV, and deleting it.
 * Reached from the Group page.
 */
export function GroupSettingsView({
  group,
  groupHref,
  afterDeleteHref,
  manage,
  categories,
  visitor,
}: {
  group: GroupSnapshot;
  /** The Group page, for the back link. */
  groupHref: string;
  /** Where to land once the Group is deleted: the Groups list. */
  afterDeleteHref: string;
  manage: GroupManagement;
  categories: CategoryManagement;
  /**
   * Who is looking: only the Group Creator may change the Editing Mode or
   * delete the Group, and in Own Records Only manage it.
   */
  visitor: Visitor;
}) {
  const router = useRouter();
  const [news, setNewsState] = useState<{ text: string; tone?: NewsTone }>({ text: "" });
  const setNews = (text: string, tone?: NewsTone) => setNewsState({ text, tone });
  const membersHeading = useRef<HTMLHeadingElement>(null);
  // Every action in a section has the same rule and reason, so one stands for all.
  const managing = (action: ManagementAction) => groupManagementBlock(group, visitor, action);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8">
      <div>
        <Link
          href={groupHref}
          className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold break-words text-accent"
        >
          <ArrowLeft aria-hidden className="size-4 shrink-0" /> Back to {group.name}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold">Group settings</h1>
      </div>

      <p role="status" className="empty:hidden">
        {news.text && (
          <span className={`font-semibold ${news.tone === "warning" ? "text-warning" : "text-success"}`}>
            {news.text}
          </span>
        )}
      </p>

      <GroupDetailsSection
        group={group}
        block={managing("edit-details")}
        onSave={manage.updateDetails}
        onSaved={() => setNews("Group details saved.")}
      />

      <EditingModeSection
        // Starts again from the saved Editing Mode whenever it changes.
        key={group.editingMode}
        group={group}
        block={editingModeBlock(group, visitor)}
        onSave={manage.setEditingMode}
        onSaved={() => setNews("Editing Mode saved.")}
      />

      <CategoriesSection
        group={group}
        block={managing("add-category")}
        categories={categories}
        onNews={setNews}
      />

      <MembersSection
        group={group}
        block={managing("add-member")}
        headingRef={membersHeading}
        onAdd={manage.addMember}
        onSetEmail={manage.setMemberEmail}
        onResendInvitation={manage.resendInvitation}
        onRemove={manage.removeMember}
        onNews={setNews}
      />

      <DeleteGroupSection
        group={group}
        block={groupDeletionBlock(group, visitor)}
        onDelete={manage.deleteGroup}
        onDeleted={() => router.replace(afterDeleteHref)}
      />
    </div>
  );
}
