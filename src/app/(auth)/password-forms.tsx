"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useId } from "react";
import { MIN_PASSWORD_LENGTH } from "@/auth/password";
import { ErrorSummary, Field, FormCard } from "@/components/form";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, resetPassword, type AuthFormState } from "./actions";

/** Asks for an email and sends it a password-reset link. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  const formId = useId();
  const ids = { email: `${formId}-email` };
  const errors = state.errors ?? {};

  return (
    <section aria-labelledby={`${formId}-heading`} className="mx-auto flex max-w-md flex-col gap-6">
      <h1 id={`${formId}-heading`} className="text-2xl font-extrabold">
        Reset your password
      </h1>
      <FormCard>
        <form action={action} noValidate className="flex flex-col gap-5">
          <ErrorSummary errors={errors} fieldIds={ids} />
          {state.done && (
            <p role="status" className="rounded-md border border-border p-4 text-sm">
              {state.done}
            </p>
          )}
          <Field
            id={ids.email}
            label="Email"
            error={errors.email}
            hint="We'll email you a link to choose a new password."
          >
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
          <Button type="submit" disabled={pending}>
            {pending ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      </FormCard>
      <p className="text-sm text-text-secondary">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-accent underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}

/** Sets a new password with the token from an emailed reset link. */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPassword, {});
  const formId = useId();
  const ids = { password: `${formId}-password` };
  const errors = state.errors ?? {};
  const linkFailed = !token || params.get("error") !== null;

  return (
    <section aria-labelledby={`${formId}-heading`} className="mx-auto flex max-w-md flex-col gap-6">
      <h1 id={`${formId}-heading`} className="text-2xl font-extrabold">
        Choose a new password
      </h1>
      {linkFailed ? (
        <FormCard>
          <p role="alert" className="font-semibold text-error">
            This reset link has expired or was already used.
          </p>
          <Button asChild className="mt-4">
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
        </FormCard>
      ) : (
        <FormCard>
          <form action={action} noValidate className="flex flex-col gap-5">
            <ErrorSummary errors={errors} fieldIds={ids} />
            <input type="hidden" name="token" value={token} />
            <Field
              id={ids.password}
              label="New password"
              error={errors.password}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            >
              {(describedBy, className) => (
                <input
                  id={ids.password}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={describedBy}
                  className={className}
                />
              )}
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save new password"}
            </Button>
          </form>
          {errors.form && (
            <Link href="/forgot-password" className="mt-4 inline-block font-semibold text-accent underline">
              Send a new link
            </Link>
          )}
        </FormCard>
      )}
    </section>
  );
}
