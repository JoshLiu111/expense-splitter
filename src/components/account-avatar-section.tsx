"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import type { AccountResult } from "@/account/account";
import { AVATAR_SIZE_LIMIT, AVATAR_TYPE_NAMES, AVATAR_TYPES, avatarFileError, NOT_AN_IMAGE } from "@/account/avatar-rules";
import { cropAvatar } from "@/account/crop-avatar";
import { attempt } from "@/components/attempt";
import { ErrorSummary, Field } from "@/components/form";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { AVATAR_COLORS } from "@/groups/group-repository";

type Failure = Extract<AccountResult, { ok: false }>;

/** The colour behind the preview's initials; each Group picks its own. */
const PREVIEW_COLOUR = AVATAR_COLORS[0];

/**
 * The User's avatar, which every Group they are Linked in shows in place of
 * their initials. The chosen image is cropped to a square and downsized in
 * the browser before it is uploaded.
 */
export function AvatarSection({
  name,
  image,
  onSet,
  onRemove,
  onSaved,
}: {
  name: string;
  image?: string;
  onSet: (form: FormData) => Promise<AccountResult>;
  onRemove: () => Promise<AccountResult>;
  /** Called once an avatar is set or removed; the page says so. */
  onSaved: (change: "set" | "removed") => void;
}) {
  const [failure, setFailure] = useState<Failure>();
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const formId = useId();
  const ids = { avatar: `${formId}-avatar` };
  const errors = failure?.errors;

  function run(call: () => Promise<AccountResult>, change: "set" | "removed") {
    startTransition(async () => {
      const result = await attempt(call);
      if (result.ok) {
        setFailure(undefined);
        if (input.current) input.current.value = "";
        onSaved(change);
      } else setFailure(result);
    });
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    const refused = file ? avatarFileError(file) : NOT_AN_IMAGE;
    if (!file || refused) {
      setFailure({ ok: false, errors: { avatar: refused } });
      return;
    }
    run(async () => {
      const square = await cropAvatar(file);
      if (!square) return { ok: false, errors: { avatar: NOT_AN_IMAGE } };
      const form = new FormData();
      form.set("avatar", square, "avatar");
      return onSet(form);
    }, "set");
  }

  return (
    <section aria-labelledby={`${formId}-heading`}>
      <h2 id={`${formId}-heading`} className="text-lg font-bold">
        Avatar
      </h2>
      <div className="mt-3 flex items-center gap-4">
        <MemberAvatar member={{ name, avatarColor: PREVIEW_COLOUR, avatarUrl: image }} size="lg" named />
        <p className="text-sm text-text-secondary">
          {image ? "Your avatar shows in every Group you're in." : "Your initials show until you add an avatar."}
        </p>
      </div>
      <form onSubmit={upload} noValidate className="mt-4 flex flex-col gap-5">
        <ErrorSummary errors={errors} fieldIds={ids} />
        <Field
          id={ids.avatar}
          label="Avatar image"
          hint={`A ${AVATAR_TYPE_NAMES} of up to ${AVATAR_SIZE_LIMIT}. It's cropped to a square.`}
          error={errors?.avatar}
        >
          {(describedBy) => (
            <input
              ref={input}
              id={ids.avatar}
              type="file"
              accept={AVATAR_TYPES.join(",")}
              aria-invalid={errors?.avatar ? true : undefined}
              aria-describedby={describedBy}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border-input file:bg-surface file:px-3 file:py-2 file:font-semibold"
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : image ? "Replace avatar" : "Upload avatar"}
          </Button>
          {image && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(onRemove, "removed")}
            >
              Remove avatar
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
