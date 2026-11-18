"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { dismissSignUpPrompt, isSignUpPromptDismissed } from "@/guest/sign-up-prompt";

const CHANGE_EVENT = "expense-splitter:sign-up-prompt-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/**
 * A gentle, dismissible nudge for Guests to sign up. Never gates anything;
 * once dismissed it stays hidden for the rest of the browser session.
 */
export function GuestSignUpPrompt() {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => isSignUpPromptDismissed(window.sessionStorage),
    // Rendered on the server so most Guests see it without a layout shift.
    () => false,
  );
  if (dismissed) return null;

  function dismiss() {
    dismissSignUpPrompt(window.sessionStorage);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    document.getElementById("main-content")?.focus();
  }

  return (
    <section
      aria-labelledby="sign-up-prompt-heading"
      className="mx-auto mb-6 flex max-w-content items-start gap-3 rounded-lg border border-border bg-accent-subtle p-4"
    >
      <div className="flex-1">
        <h2 id="sign-up-prompt-heading" className="font-bold">
          Sign up to save your Groups
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          An account keeps your Groups across visits and devices and lets you share them with
          friends. Guest changes won&apos;t carry over: a new account starts empty.
        </p>
        <Button asChild className="mt-3">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </div>
      <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss sign-up prompt">
        <X aria-hidden />
      </Button>
    </section>
  );
}
