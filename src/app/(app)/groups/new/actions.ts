"use server";

import { redirect } from "next/navigation";
import { parseNewGroup } from "@/domain";
import { requireUser } from "@/auth/session";
import { newGroupFields, type CreateGroupState } from "@/groups/new-group-form";
import { userGroupRepository } from "@/groups/user-groups";

export async function createGroup(
  _: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  // Re-check the session: Server Actions are public endpoints.
  const user = await requireUser("/groups/new");
  const values = newGroupFields(formData);
  const parsed = parseNewGroup(values);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const group = await userGroupRepository(user).createGroup(parsed.value);
  redirect(`/groups/${group.id}`);
}
