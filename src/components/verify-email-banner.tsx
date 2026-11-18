"use client";

import { useState, useTransition } from "react";
import { resendVerificationEmail } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/**
 * Reminds a User who hasn't verified their email yet. The app works without
 * it, but only a verified email links Groups others added them to by email.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [news, setNews] = useState("");
  const [pending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      try {
        setNews((await resendVerificationEmail()).done ?? "");
      } catch {
        setNews("Couldn't send the email. Check your connection and try again.");
      }
    });
  }

  return (
    <section
      aria-labelledby="verify-email-heading"
      className="mb-6 rounded-lg border border-border bg-surface p-4"
    >
      <h2 id="verify-email-heading" className="font-bold">
        Verify your email
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        We sent a link to {email}. Verify it so Groups people add you to by email show up here.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={resend} disabled={pending}>
          {pending ? "Sending…" : "Resend verification email"}
        </Button>
        <p role="status" className="text-sm">
          {news}
        </p>
      </div>
    </section>
  );
}
