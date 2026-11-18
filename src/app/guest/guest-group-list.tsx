"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { GroupList } from "@/components/group-list";
import { Button } from "@/components/ui/button";
import { useGuestGroups } from "@/guest/use-guest-groups";

export function GuestGroupList() {
  const groups = useGuestGroups();

  return (
    <section aria-labelledby="groups-heading" className="mx-auto max-w-content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="groups-heading" className="text-2xl font-extrabold">
          Your Groups
        </h1>
        <Button asChild>
          <Link href="/guest/groups/new">
            <Plus aria-hidden /> New Group
          </Link>
        </Button>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        You&apos;re exploring as a Guest. Changes last until you close this browser tab.
      </p>

      <div className="mt-6">
        {groups === null ? (
          <p className="text-text-secondary" role="status">
            Loading Groups…
          </p>
        ) : (
          <GroupList groups={groups} basePath="/guest/groups" />
        )}
      </div>
    </section>
  );
}
