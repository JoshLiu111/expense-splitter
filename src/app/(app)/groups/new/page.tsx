import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { CreateGroupForm } from "@/components/create-group-form";
import { createGroup } from "./actions";

export const metadata: Metadata = { title: "New Group · Expense Splitter" };

export default function NewGroupPage() {
  return (
    <Suspense>
      <SignedInForm />
    </Suspense>
  );
}

async function SignedInForm() {
  await requireUser("/groups/new");
  return <CreateGroupForm action={createGroup} cancelHref="/dashboard" />;
}
