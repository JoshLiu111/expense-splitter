"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { ErrorSummary, Field, FormCard } from "@/components/form";
import { MIN_PASSWORD_LENGTH } from "@/auth/password";
import { signIn, signUp, type AuthFormState } from "./actions";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const justReset = mode === "sign-in" && params.get("reset") !== null;
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === "sign-up" ? signUp : signIn,
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
        {isSignUp ? "Sign up" : "Sign in"}
      </h1>
      {justReset && (
        <p role="status" className="rounded-md border border-border p-4 text-sm">
          Your password has been changed. Sign in with your new password.
        </p>
      )}
      <FormCard>
        <form action={action} noValidate className="flex flex-col gap-5">
          <ErrorSummary errors={errors} fieldIds={ids} />
          <input type="hidden" name="next" value={next} />
          {isSignUp && (
            <Field id={ids.name} label="Name" error={errors.name}>
              {(describedBy, className) => (
                <input
                  id={ids.name}
                  name="name"
                  autoComplete="name"
                  required
                  defaultValue={state.values?.name}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy}
                  className={className}
                />
              )}
            </Field>
          )}
          <Field id={ids.email} label="Email" error={errors.email}>
            {(describedBy, className) => (
              <input
                id={ids.email}
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={state.values?.email}
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
