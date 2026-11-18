import type { Metadata } from "next";
import { ForgotPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Reset your password · Expense Splitter" };

export default function Page() {
  return <ForgotPasswordForm />;
}
