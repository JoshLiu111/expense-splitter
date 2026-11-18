"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GroupDetail } from "@/components/group-detail";
import { useGuestGroups } from "@/guest/use-guest-groups";

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

  return <GroupDetail group={group} backHref="/guest" backLabel="All Groups" />;
}
