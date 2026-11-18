"use client";

import { useRouter } from "next/navigation";
import { parseNewGroup } from "@/domain";
import { CreateGroupForm } from "@/components/create-group-form";
import { newGroupFields, type CreateGroupAction } from "@/groups/new-group-form";
import { guestRepository } from "@/guest/use-guest-groups";

export function GuestCreateGroup() {
  const router = useRouter();

  const createGroup: CreateGroupAction = async (_, formData) => {
    const values = newGroupFields(formData);
    const parsed = parseNewGroup(values);
    if (!parsed.ok) return { errors: parsed.errors, values };
    const group = await guestRepository().createGroup(parsed.value);
    router.push(`/guest/groups/${group.id}`);
    return { values };
  };

  return <CreateGroupForm action={createGroup} cancelHref="/guest" />;
}
