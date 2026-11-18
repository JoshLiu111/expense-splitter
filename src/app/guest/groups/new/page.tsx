import type { Metadata } from "next";
import { GuestCreateGroup } from "./guest-create-group";

export const metadata: Metadata = { title: "New Group · Expense Splitter" };

export default function GuestNewGroupPage() {
  return <GuestCreateGroup />;
}
