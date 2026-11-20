import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { AccountSettingsView } from "@/components/account-settings";
import { changeUserPassword, removeUserAvatar, setUserAvatar, updateUserDisplayName } from "./actions";

export const metadata: Metadata = { title: "Account Settings · Expense Splitter" };

export default function AccountSettingsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Loading Account Settings…
        </p>
      }
    >
      <UserAccountSettings />
    </Suspense>
  );
}

async function UserAccountSettings() {
  const user = await requireUser("/account");
  return (
    <AccountSettingsView
      user={{ name: user.name, email: user.email, image: user.image }}
      account={{
        updateDisplayName: updateUserDisplayName,
        setAvatar: setUserAvatar,
        removeAvatar: removeUserAvatar,
        changePassword: changeUserPassword,
      }}
    />
  );
}
