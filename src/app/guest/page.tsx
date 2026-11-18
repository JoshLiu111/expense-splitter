import type { Metadata } from "next";
import { GuestGroupList } from "./guest-group-list";

export const metadata: Metadata = { title: "Your Groups · Expense Splitter (Guest)" };

export default function GuestPage() {
  return <GuestGroupList />;
}
