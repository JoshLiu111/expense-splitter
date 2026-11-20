import { Suspense } from "react";
import { GuestGroupActivityView } from "../guest-group-view";

export default function GuestGroupActivityPage() {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Loading Activity…
        </p>
      }
    >
      <GuestGroupActivityView />
    </Suspense>
  );
}
