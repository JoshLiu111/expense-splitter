import { Suspense } from "react";
import { GuestGroupView } from "./guest-group-view";

export default function GuestGroupPage() {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Loading Group…
        </p>
      }
    >
      <GuestGroupView />
    </Suspense>
  );
}
