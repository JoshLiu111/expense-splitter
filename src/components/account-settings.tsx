"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { MAX_MEMBER_NAME_LENGTH } from "@/domain";
import type { AccountFields, AccountManagement, AccountResult } from "@/account/account";
import { AvatarSection } from "@/components/account-avatar-section";
import { ErrorSummary, Field } from "@/components/form";
import { Button } from "@/components/ui/button";

type Failure = Extract<AccountResult, { ok: false }>;

const OFFLINE: Failure = {
  ok: false,
  errors: { form: "Couldn't save the change. Check your connection and try again." },
};

/** Runs an account call, turning a thrown network error into a Failure. */
async function attempt(call: () => Promise<AccountResult>): Promise<AccountResult> {
  try {
    return await call();
  } catch {
    return OFFLINE;
  }
}

/**
 * Account Settings: what a signed-in User changes about their own account,
 * one section per change. Reached from the user menu; Guests never see it.
 */
export function AccountSettingsView({
  user,
  account,
}: {
  user: { name: string; email: string; image?: string };
  account: AccountManagement;
}) {
  const [news, setNews] = useState("");

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold">Account Settings</h1>
        <p className="mt-1 break-words text-text-secondary">Signed in as {user.email}</p>
      </div>

      <p role="status" className="empty:hidden">
        {news && <span className="font-semibold text-success">{news}</span>}
      </p>

      <DisplayNameSection
        name={user.name}
        onSave={account.updateDisplayName}
        onSaved={() => setNews("Display name saved.")}
      />

      <AvatarSection
        name={user.name}
        image={user.image}
        onSet={account.setAvatar}
        onRemove={account.removeAvatar}
        onDone={setNews}
      />
    </div>
  );
}

/** The User's display name, which every Group they are Linked in shows. */
function DisplayNameSection({
  name,
  onSave,
  onSaved,
}: {
  name: string;
  onSave: (fields: AccountFields) => Promise<AccountResult>;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<AccountFields>({ name });
  const [failure, setFailure] = useState<Failure>();
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const ids = { name: `${formId}-name` };
  const errors = failure?.errors;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await attempt(() => onSave(fields));
      if (result.ok) {
        setFailure(undefined);
        onSaved();
      } else setFailure(result);
    });
  }

  return (
    <section aria-labelledby={`${formId}-heading`}>
      <h2 id={`${formId}-heading`} className="text-lg font-bold">
        Display name
      </h2>
      <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-5">
        <ErrorSummary errors={errors} fieldIds={ids} />
        <Field
          id={ids.name}
          label="Name"
          hint="Shown to the other Members of every Group you're in."
          error={errors?.name}
        >
          {(describedBy, className) => (
            <input
              id={ids.name}
              required
              autoComplete="name"
              maxLength={MAX_MEMBER_NAME_LENGTH}
              value={fields.name}
              onChange={(e) => setFields({ name: e.target.value })}
              aria-invalid={errors?.name ? true : undefined}
              aria-describedby={describedBy}
              className={className}
            />
          )}
        </Field>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save name"}
          </Button>
        </div>
      </form>
    </section>
  );
}
