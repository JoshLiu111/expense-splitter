import { Suspense } from "react";
import { GuestGroupSettingsView } from "../guest-group-view";

export default function GuestGroupSettingsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-text-secondary" role="status">
          Loading Group settings…
        </p>
      }
    >
      <GuestGroupSettingsView />
    </Suspense>
  );
}
