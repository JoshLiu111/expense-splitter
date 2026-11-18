import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Choose a new password · Expense Splitter" };

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
