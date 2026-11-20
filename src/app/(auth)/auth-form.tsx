"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { ErrorSummary, Field, FormCard } from "@/components/form";
import { MAX_DISPLAY_NAME_LENGTH } from "@/auth/display-name";
import { MIN_PASSWORD_LENGTH } from "@/auth/password";
import { signIn, signUp, signUpThroughInvitation, type AuthFormState } from "./actions";

/** A valid Invitation being followed: sign-up is for its email only. */
export interface InvitationToJoin {
  token: string;
  email: string;
  groupName: string;
}

export function AuthForm({
  mode,
  invitation,
}: {
  mode: "sign-in" | "sign-up";
  /** Sign up through this Invitation, with its email filled in and locked. */
  invitation?: InvitationToJoin;
}) {
  const params = useSearchParams();
  const next = invitation ? `/invite/${invitation.token}` : (params.get("next") ?? "");
  const justReset = mode === "sign-in" && params.get("reset") !== null;
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    invitation ? signUpThroughInvitation : mode === "sign-up" ? signUp : signIn,
    {},
  );
  const formId = useId();
  const ids = {
    name: `${formId}-name`,
    email: `${formId}-email`,
    password: `${formId}-password`,
  };
  const errors = state.errors ?? {};
  const isSignUp = mode === "sign-up";
  const otherHref = `${isSignUp ? "/sign-in" : "/sign-up"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <section aria-labelledby={`${formId}-heading`} className="mx-auto flex max-w-md flex-col gap-6">
      <h1 id={`${formId}-heading`} className="text-2xl font-extrabold">
        {invitation ? `Join ${invitation.groupName}` : isSignUp ? "Sign up" : "Sign in"}
      </h1>
      {invitation && (
        <p className="text-text-secondary">
          Sign up as {invitation.email} to join the Group. This link verifies your email, so there&apos;s
          nothing else to confirm.
        </p>
      )}
      {justReset && (
        <p role="status" className="rounded-md border border-border p-4 text-sm">
          Your password has been changed. Sign in with your new password.
        </p>
      )}
      <FormCard>
        <form action={action} noValidate className="flex flex-col gap-5">
          <ErrorSummary errors={errors} fieldIds={ids} />
          <input type="hidden" name="next" value={next} />
          {invitation && <input type="hidden" name="token" value={invitation.token} />}
          {isSignUp && (
            <Field id={ids.name} label="Name" error={errors.name}>
              {(describedBy, className) => (
                <input
                  id={ids.name}
                  name="name"
                  autoComplete="name"
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  required
                  defaultValue={state.values?.name}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy}
                  className={className}
                />
              )}
            </Field>
          )}
          <Field
            id={ids.email}
            label="Email"
            error={errors.email}
            hint={invitation ? "The Invitation was sent to this email, so it can't be changed." : undefined}
          >
            {(describedBy, className) => (
              <input
                id={ids.email}
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={invitation?.email ?? state.values?.email}
                readOnly={invitation !== undefined}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy}
                className={className}
              />
            )}
          </Field>
          <Field
            id={ids.password}
            label="Password"
            error={errors.password}
            hint={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
          >
            {(describedBy, className) => (
              <input
                id={ids.password}
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={describedBy}
                className={className}
              />
            )}
          </Field>
          {!isSignUp && (
            <Link href="/forgot-password" className="self-start text-sm font-semibold text-accent underline">
              Forgot your password?
            </Link>
          )}
          <Button type="submit" disabled={pending}>
            {pending
              ? isSignUp
                ? "Signing up…"
                : "Signing in…"
              : isSignUp
                ? "Sign up"
                : "Sign in"}
          </Button>
        </form>
      </FormCard>
      <p className="text-sm text-text-secondary">
        {isSignUp ? "Already signed up? " : "New here? "}
        <Link href={otherHref} className="font-semibold text-accent underline">
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </section>
  );
}
