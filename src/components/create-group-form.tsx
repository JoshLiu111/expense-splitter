"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import {
  CURRENCY_CODES,
  DEFAULT_GROUP_CURRENCY,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
} from "@/domain";
import type { CreateGroupAction } from "@/groups/new-group-form";
import { ErrorSummary, Field, FormCard } from "@/components/form";
import { Button } from "@/components/ui/button";

export function CreateGroupForm({
  action,
  cancelHref,
}: {
  action: CreateGroupAction;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formId = useId();
  const ids = {
    name: `${formId}-name`,
    description: `${formId}-description`,
    currency: `${formId}-currency`,
  };
  const errors = state.errors ?? {};

  return (
    <section aria-labelledby="new-group-heading" className="mx-auto flex max-w-content flex-col gap-6">
      <h1 id="new-group-heading" className="text-2xl font-extrabold">
        New Group
      </h1>
      <FormCard>
        <form action={formAction} noValidate className="flex flex-col gap-5">
          <ErrorSummary errors={errors} fieldIds={ids} />
          <Field id={ids.name} label="Name" error={errors.name}>
            {(describedBy, className) => (
              <input
                id={ids.name}
                name="name"
                required
                maxLength={MAX_GROUP_NAME_LENGTH}
                defaultValue={state.values?.name}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy}
                className={className}
              />
            )}
          </Field>
          <Field id={ids.description} label="Description (optional)" error={errors.description}>
            {(describedBy, className) => (
              <textarea
                id={ids.description}
                name="description"
                rows={3}
                maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
                defaultValue={state.values?.description}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={describedBy}
                className={className}
              />
            )}
          </Field>
          <Field
            id={ids.currency}
            label="Group Currency"
            hint="Balances and Settlements are measured in this currency."
            error={errors.currency}
          >
            {(describedBy, className) => (
              <select
                id={ids.currency}
                name="currency"
                defaultValue={state.values?.currency || DEFAULT_GROUP_CURRENCY}
                aria-invalid={errors.currency ? true : undefined}
                aria-describedby={describedBy}
                className={`${className} min-h-11`}
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating Group…" : "Create Group"}
            </Button>
            <Button asChild variant="outline">
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          </div>
        </form>
      </FormCard>
    </section>
  );
}
