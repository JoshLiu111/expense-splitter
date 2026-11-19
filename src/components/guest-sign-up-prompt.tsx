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
 * A gentle, dismissible one-line nudge for Guests to sign up, shown directly
 * under the header on Guest pages. Never gates anything; once dismissed it
 * stays hidden for the rest of the browser session.
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
    // Main starts just under the header, so focusing it must not scroll a page taller than the screen.
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }

  return (
    <section
      aria-label="Sign up to save your Groups"
      className="border-b border-border-subtle bg-accent-subtle"
    >
      <div className="mx-auto flex max-w-page items-center gap-3 px-4 py-1.5">
        <p className="flex-1 py-2 text-sm">
          <Link
            href="/sign-up"
            className="rounded-sm font-semibold text-accent underline underline-offset-4 hover:text-accent-hover"
          >
            Sign up
          </Link>{" "}
          to save your Groups across visits and devices. Guest changes won&apos;t carry over to a
          new account.
        </p>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss sign-up prompt">
          <X aria-hidden />
        </Button>
      </div>
    </section>
  );
}
