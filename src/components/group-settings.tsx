"use client";

import { useId, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { AlertDialog, Dialog } from "radix-ui";
import { Pencil, Trash2, UserPlus, X } from "lucide-react";
import {
  CURRENCY_CODES,
  currencyLock,
  currentMembers,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_MEMBER_NAME_LENGTH,
  memberRemovalBlock,
  type GroupSnapshot,
  type Member,
  type NewGroupFields,
} from "@/domain";
import type { ManageResult } from "@/groups/manage-group";
import { ErrorSummary, Field } from "@/components/form";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";

type Failure = Extract<ManageResult, { ok: false }>;

const OFFLINE: Failure = {
  ok: false,
  errors: { form: "Couldn't save the change. Check your connection and try again." },
};

/** Runs a management call, turning a thrown network error into a Failure. */
async function attempt(call: () => Promise<ManageResult>): Promise<ManageResult> {
  try {
    return await call();
  } catch {
    return OFFLINE;
  }
}

const dialogClass =
  "fixed top-1/2 left-1/2 z-50 max-h-[92dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg outline-none";

const dangerClass = "bg-error text-white hover:bg-error/90";

/**
 * Edit a Group's name, description and Group Currency in a dialog that traps
 * focus and returns it to the Edit button. The Group Currency is locked,
 * with the reason shown, once anything has been recorded.
 */
export function EditGroupDetails({
  group,
  onSave,
  onSaved,
}: {
  group: GroupSnapshot;
  onSave: (fields: NewGroupFields) => Promise<ManageResult>;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline">
          <Pencil aria-hidden /> Edit Group
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content aria-describedby={undefined} className={dialogClass}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <Dialog.Title className="text-lg font-bold">Edit Group</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          {/* Remounted on every open, so it starts from the Group as it is now. */}
          <GroupDetailsForm
            group={group}
            onSave={onSave}
            onSaved={() => {
              setOpen(false);
              onSaved();
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GroupDetailsForm({
  group,
  onSave,
  onSaved,
}: {
  group: GroupSnapshot;
  onSave: (fields: NewGroupFields) => Promise<ManageResult>;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<NewGroupFields>({
    name: group.name,
    description: group.description,
    currency: group.currency,
  });
  const [failure, setFailure] = useState<Failure>();
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const ids = {
    name: `${formId}-name`,
    description: `${formId}-description`,
    currency: `${formId}-currency`,
  };
  const errors = failure?.errors;
  const lock = currencyLock(group);
  const set = (key: keyof NewGroupFields, value: string) => setFields((f) => ({ ...f, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await attempt(() => onSave(fields));
      if (result.ok) onSaved();
      else setFailure(result);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <ErrorSummary errors={errors} fieldIds={ids} />
      <Field id={ids.name} label="Name" error={errors?.name}>
        {(describedBy, className) => (
          <input
            id={ids.name}
            required
            maxLength={MAX_GROUP_NAME_LENGTH}
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={errors?.name ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          />
        )}
      </Field>
      <Field id={ids.description} label="Description (optional)" error={errors?.description}>
        {(describedBy, className) => (
          <textarea
            id={ids.description}
            rows={3}
            maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
            value={fields.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={errors?.description ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          />
        )}
      </Field>
      <Field
        id={ids.currency}
        label="Group Currency"
        hint={lock ?? "Balances and Settlements are measured in this currency."}
        error={errors?.currency}
      >
        {(describedBy, className) => (
          <select
            id={ids.currency}
            value={fields.currency}
            disabled={lock !== null}
            onChange={(e) => set("currency", e.target.value)}
            aria-invalid={errors?.currency ? true : undefined}
            aria-describedby={describedBy}
            className={`${className} min-h-11 disabled:opacity-60`}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="flex flex-wrap justify-end gap-3">
        <Dialog.Close asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Dialog.Close>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/**
 * The Group's current Members, with a form to add Name-only Members and a
 * confirmed Remove for any Member whose Balance is zero. Former Members are
 * listed apart; they stay on past Expenses.
 */
export function MembersSection({
  group,
  headingRef,
  onAdd,
  onRemove,
  onNews,
}: {
  group: GroupSnapshot;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAdd: (name: string) => Promise<ManageResult>;
  onRemove: (memberId: string) => Promise<ManageResult>;
  onNews: (news: string) => void;
}) {
  const current = currentMembers(group);
  const former = group.members.filter((m) => m.former);
  const [removeError, setRemoveError] = useState("");

  async function remove(member: Member) {
    setRemoveError("");
    const result = await attempt(() => onRemove(member.id));
    if (result.ok) onNews(`Removed ${member.name}. They stay on past Expenses.`);
    else setRemoveError(result.errors.form ?? `Couldn't remove ${member.name}.`);
    // The Remove button that opened the dialog may be gone, so land here.
    headingRef.current?.focus();
  }

  return (
    <section aria-labelledby="members-heading">
      <h2
        id="members-heading"
        ref={headingRef}
        tabIndex={-1}
        className="rounded-md text-lg font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        Members
      </h2>
      {removeError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {removeError}
        </p>
      )}
      <ul className="mt-3 divide-y divide-border-subtle rounded-lg border border-border bg-surface">
        {current.map((member) => {
          const block = memberRemovalBlock(group, member.id);
          return (
            <li
              key={member.id}
              data-testid={`member-${member.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
            >
              <span className="flex min-w-0 items-center gap-3">
                <MemberAvatar member={member} />
                <span className="font-semibold break-words">{member.name}</span>
              </span>
              {block ? (
                <span className="text-sm text-text-secondary">{block}</span>
              ) : (
                <ConfirmRemoveMember member={member} onConfirm={() => remove(member)} />
              )}
            </li>
          );
        })}
      </ul>
      <AddMemberForm onAdd={onAdd} onAdded={(name) => onNews(`Added ${name}.`)} />
      {former.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-text-secondary">Former Members</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {former.map((member) => (
              <li
                key={member.id}
                className="inline-flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 text-sm text-text-secondary"
              >
                <MemberAvatar member={member} size="sm" />
                {member.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ConfirmRemoveMember({ member, onConfirm }: { member: Member; onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="ghost" aria-label={`Remove ${member.name}`}>
          <Trash2 aria-hidden /> Remove
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Content className={dialogClass}>
          <AlertDialog.Title className="text-lg font-bold">
            Remove {member.name} from the Group?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-text-secondary">
            They&apos;ll stay on past Expenses as a Former Member but can&apos;t be added to new
            ones.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button onClick={onConfirm} className={dangerClass}>
                Remove Member
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function AddMemberForm({
  onAdd,
  onAdded,
}: {
  onAdd: (name: string) => Promise<ManageResult>;
  onAdded: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await attempt(() => onAdd(name));
      if (result.ok) {
        onAdded(name.trim());
        setName("");
        setError(undefined);
      } else {
        setError(result.errors.name ?? result.errors.form ?? "Couldn't add the Member.");
      }
      input.current?.focus();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <Field id={id} label="Add a Member by name" error={error}>
          {(describedBy, className) => (
            <input
              ref={input}
              id={id}
              autoComplete="off"
              maxLength={MAX_MEMBER_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={className}
            />
          )}
        </Field>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className={error ? "mb-7" : undefined}>
        <UserPlus aria-hidden /> Add Member
      </Button>
    </form>
  );
}

/**
 * Delete the Group: for its Group Creator once it is Settled Up, after
 * confirmation. Anyone else sees why they can't.
 */
export function DeleteGroupSection({
  group,
  block,
  onDelete,
  onDeleted,
}: {
  group: GroupSnapshot;
  /** Why the visitor can't delete the Group, or `null`. */
  block: string | null;
  onDelete: () => Promise<ManageResult>;
  onDeleted: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const reasonId = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  function confirm() {
    setError("");
    startTransition(async () => {
      const result = await attempt(onDelete);
      if (result.ok) onDeleted();
      else {
        setError(result.errors.form ?? "Couldn't delete the Group.");
        trigger.current?.focus();
      }
    });
  }

  return (
    <section aria-labelledby="delete-group-heading" className="rounded-lg border border-border p-4">
      <h2 id="delete-group-heading" className="text-lg font-bold">
        Delete Group
      </h2>
      <p id={reasonId} className="mt-1 text-sm text-text-secondary">
        {block ?? "Removes the Group and all its Expenses and Settlements for everyone."}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {error}
        </p>
      )}
      <AlertDialog.Root>
        <AlertDialog.Trigger asChild>
          <Button
            ref={trigger}
            variant="outline"
            disabled={block !== null}
            aria-describedby={reasonId}
            className="mt-3"
          >
            <Trash2 aria-hidden /> {pending ? "Deleting Group…" : "Delete Group"}
          </Button>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <AlertDialog.Content className={dialogClass}>
            <AlertDialog.Title className="text-lg font-bold break-words">
              Delete “{group.name}”?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-text-secondary">
              The Group and all its Expenses and Settlements will be removed for everyone. This
              can&apos;t be undone.
            </AlertDialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={confirm} className={dangerClass}>
                  Delete Group
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
