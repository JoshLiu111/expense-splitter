"use client";

import { useId, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { AlertDialog, Dialog } from "radix-ui";
import { Mail, Trash2, UserPlus, X } from "lucide-react";
import {
  CURRENCY_CODES,
  currencyLock,
  EDITING_MODE_LABELS,
  EDITING_MODES,
  editingModeOf,
  currentMembers,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_MEMBER_NAME_LENGTH,
  memberEmailBlock,
  memberRemovalBlock,
  type EditingMode,
  type GroupSnapshot,
  type Member,
  type NewGroupFields,
} from "@/domain";
import type {
  AddMemberResult,
  ManageResult,
  NewMemberFields,
  SetMemberEmailResult,
} from "@/groups/manage-group";
import { attempt } from "@/components/attempt";
import { ErrorSummary, Field } from "@/components/form";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";

type Failure = Extract<ManageResult, { ok: false }>;

/** How news after an action reads: a plain confirmation, or a `warning` that part of it didn't happen. */
export type NewsTone = "warning";

const dialogClass =
  "fixed top-1/2 left-1/2 z-50 max-h-[92dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg outline-none";

const dangerClass = "bg-error text-white hover:bg-error/90";

/**
 * Edit a Group's name, description and Group Currency. The Group Currency is
 * locked, with the reason shown, once anything has been recorded. With a
 * `block`, the details are shown read-only with the reason.
 */
export function GroupDetailsSection({
  group,
  block,
  onSave,
  onSaved,
}: {
  group: GroupSnapshot;
  /** Why the visitor can't change the Group's details, or `null`. */
  block: string | null;
  onSave: (fields: NewGroupFields) => Promise<ManageResult>;
  onSaved: () => void;
}) {
  return (
    <section aria-labelledby="details-heading">
      <h2 id="details-heading" className="text-lg font-bold">
        Details
      </h2>
      <SectionBlock block={block} />
      <div className="mt-3">
        <GroupDetailsForm group={group} block={block} onSave={onSave} onSaved={onSaved} />
      </div>
    </section>
  );
}

/** Why the visitor can't use a section's controls, under its heading. */
export function SectionBlock({ block }: { block: string | null }) {
  return block && <p className="mt-1 text-sm text-text-secondary">{block}</p>;
}

function GroupDetailsForm({
  group,
  block,
  onSave,
  onSaved,
}: {
  group: GroupSnapshot;
  block: string | null;
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
      if (result.ok) {
        setFailure(undefined);
        onSaved();
      } else setFailure(result);
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={block !== null} className="flex flex-col gap-5">
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
        {block === null && (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

/** How a Member is tied to a User, for signed-in Users' Groups. */
function linkStatus(member: Member): string | null {
  if (member.userId) return `${member.email ?? "Signed up"} · Linked`;
  if (member.email) return `${member.email} · Pending until they join`;
  return null;
}

/**
 * The Group's current Members, with a form to add Members and a confirmed
 * Remove for any Member whose Balance is zero. Former Members are listed
 * apart; they stay on past Expenses. With `onSetEmail` (signed-in Users),
 * Members can be added by email and Name-only Members given one, which
 * links them to the User who verified it. With `onResendInvitation`, a
 * Pending Member shows whether their Invitation was sent and can be sent a
 * new one. With a `block`, the Members are only listed, with the reason.
 */
export function MembersSection({
  group,
  block,
  headingRef,
  onAdd,
  onSetEmail,
  onResendInvitation,
  onRemove,
  onNews,
}: {
  group: GroupSnapshot;
  /** Why the visitor can't add, remove or invite Members, or give them an email, or `null`. */
  block: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAdd: (fields: NewMemberFields) => Promise<AddMemberResult>;
  onSetEmail?: (memberId: string, email: string) => Promise<SetMemberEmailResult>;
  onResendInvitation?: (memberId: string) => Promise<ManageResult>;
  onRemove: (memberId: string) => Promise<ManageResult>;
  onNews: (news: string, tone?: NewsTone) => void;
}) {
  const current = currentMembers(group);
  const former = group.members.filter((m) => m.former);
  const [rowError, setRowError] = useState("");
  const [resending, setResending] = useState<string | null>(null);

  async function remove(member: Member) {
    setRowError("");
    const result = await attempt(() => onRemove(member.id));
    if (result.ok) onNews(`Removed ${member.name}. They stay on past Expenses.`);
    else setRowError(result.errors.form ?? `Couldn't remove ${member.name}.`);
    // The Remove button that opened the dialog may be gone, so land here.
    headingRef.current?.focus();
  }

  /** Says what was done, and at once if the Invitation it was due wasn't sent. */
  function told(done: string, invitationSent: boolean | undefined) {
    if (invitationSent === false) onNews(`${done} Their Invitation wasn't sent; use Resend to try again.`, "warning");
    else onNews(done);
  }

  async function resend(member: Member) {
    if (!onResendInvitation) return;
    setRowError("");
    setResending(member.id);
    const result = await attempt(() => onResendInvitation(member.id));
    setResending(null);
    if (result.ok) onNews(`Sent ${member.name} a new Invitation at ${member.email}.`);
    else setRowError(result.errors.form ?? `Couldn't send ${member.name} an Invitation.`);
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
      <SectionBlock block={block} />
      {rowError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {rowError}
        </p>
      )}
      <ul className="mt-3 divide-y divide-border-subtle rounded-lg border border-border bg-surface">
        {current.map((member) => {
          const removalBlock = memberRemovalBlock(group, member.id);
          const status = onSetEmail ? linkStatus(member) : null;
          return (
            <li
              key={member.id}
              data-testid={`member-${member.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
            >
              <span className="flex min-w-0 items-center gap-3">
                <MemberAvatar member={member} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold break-words">{member.name}</span>
                  {status && <span className="text-sm break-words text-text-secondary">{status}</span>}
                  {onResendInvitation && member.invitationSent !== undefined && (
                    <InvitationState
                      member={member}
                      sending={resending === member.id}
                      onResend={block === null ? () => resend(member) : undefined}
                    />
                  )}
                </span>
              </span>
              {block === null && (
                <span className="flex flex-wrap items-center gap-1">
                  {onSetEmail && memberEmailBlock(group, member.id) === null && (
                    <MemberEmailDialog
                      member={member}
                      onSave={(email) => onSetEmail(member.id, email)}
                      onSaved={(email, invitationSent) => told(`Saved ${email} for ${member.name}.`, invitationSent)}
                    />
                  )}
                  {removalBlock ? (
                    <span className="text-sm text-text-secondary">{removalBlock}</span>
                  ) : (
                    <ConfirmRemoveMember member={member} onConfirm={() => remove(member)} />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {block === null && (
        <AddMemberForm
          byEmail={onSetEmail !== undefined}
          onAdd={onAdd}
          onAdded={(name, invitationSent) => told(`Added ${name}.`, invitationSent)}
        />
      )}
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

/**
 * Whether a Pending Member's latest Invitation was sent, with a way to send
 * a new one (which stops the older link working) given `onResend`.
 */
function InvitationState({
  member,
  sending,
  onResend,
}: {
  member: Member;
  sending: boolean;
  onResend?: () => void;
}) {
  const button = (label: string) =>
    onResend && (
      <Button
        variant="quiet"
        className="-ml-3 text-sm"
        aria-label={`Resend Invitation to ${member.name}`}
        disabled={sending}
        onClick={onResend}
      >
        {sending ? "Sending…" : label}
      </Button>
    );
  return member.invitationSent ? (
    <span className="flex flex-wrap items-center gap-x-3 text-sm text-text-secondary">
      <span>Invitation sent</span>
      {button("Resend Invitation")}
    </span>
  ) : (
    <span className="flex flex-wrap items-center gap-x-3 text-sm">
      <span className="font-semibold text-error">Invitation not sent{onResend && " —"}</span>
      {button("Resend")}
    </span>
  );
}

function ConfirmRemoveMember({ member, onConfirm }: { member: Member; onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="quiet" aria-label={`Remove ${member.name}`}>
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
  byEmail,
  onAdd,
  onAdded,
}: {
  /** Offer an email field, to add a Linked or Pending Member. */
  byEmail: boolean;
  onAdd: (fields: NewMemberFields) => Promise<AddMemberResult>;
  /** With whether the Invitation the new Member was due was sent, if one was. */
  onAdded: (name: string, invitationSent: boolean | undefined) => void;
}) {
  const [fields, setFields] = useState<NewMemberFields>({ name: "", email: "" });
  const [errors, setErrors] = useState<Failure["errors"]>();
  const [pending, startTransition] = useTransition();
  const id = useId();
  const ids = { name: `${id}-name`, email: `${id}-email` };
  const nameInput = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await attempt(() => onAdd(fields));
      if (result.ok) {
        onAdded(result.name, result.invitationSent);
        setFields({ name: "", email: "" });
        setErrors(undefined);
      } else {
        setErrors(
          result.errors.name || result.errors.email
            ? result.errors
            : { name: result.errors.form ?? "Couldn't add the Member." },
        );
      }
      nameInput.current?.focus();
    });
  }

  const hasError = Boolean(errors?.name || errors?.email);
  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <Field id={ids.name} label="Add a Member by name" error={errors?.name}>
          {(describedBy, className) => (
            <input
              ref={nameInput}
              id={ids.name}
              autoComplete="off"
              maxLength={MAX_MEMBER_NAME_LENGTH}
              value={fields.name}
              onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
              aria-invalid={errors?.name ? true : undefined}
              aria-describedby={describedBy}
              className={className}
            />
          )}
        </Field>
      </div>
      {byEmail && (
        <div className="min-w-48 flex-1">
          <Field id={ids.email} label="Email (optional)" error={errors?.email}>
            {(describedBy, className) => (
              <input
                id={ids.email}
                type="email"
                autoComplete="off"
                value={fields.email}
                onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
                aria-invalid={errors?.email ? true : undefined}
                aria-describedby={describedBy}
                className={className}
              />
            )}
          </Field>
        </div>
      )}
      <Button type="submit" variant="outline" disabled={pending} className={hasError ? "mb-7" : undefined}>
        <UserPlus aria-hidden /> Add Member
      </Button>
      {byEmail && (
        <p className="basis-full text-sm text-text-secondary">
          With an email, someone who has signed up and verified it can see and edit this Group
          straight away; anyone else is emailed an Invitation and linked once they join.
        </p>
      )}
    </form>
  );
}

/** Give a Name-only or Pending Member an email, in a dialog. */
function MemberEmailDialog({
  member,
  onSave,
  onSaved,
}: {
  member: Member;
  onSave: (email: string) => Promise<SetMemberEmailResult>;
  onSaved: (email: string, invitationSent: boolean | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(member.email ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const id = useId();
  const action = member.email ? "Change email" : "Add email";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await attempt(() => onSave(email));
      if (result.ok) {
        setOpen(false);
        onSaved(email.trim().toLowerCase(), result.invitationSent);
      } else setError(result.errors.email ?? result.errors.form ?? "Couldn't save the email.");
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setEmail(member.email ?? "");
          setError(undefined);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="quiet" aria-label={`${action} for ${member.name}`}>
          <Mail aria-hidden /> {action}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className={dialogClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Dialog.Title className="text-lg font-bold break-words">
              {action} for {member.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-text-secondary">
            {member.name} keeps their Expenses and Balance. Once they&apos;ve signed up and verified this
            email, they can see and edit the Group.
          </Dialog.Description>
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <Field id={id} label="Email" error={error}>
              {(describedBy, className) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy}
                  className={className}
                />
              )}
            </Field>
            <div className="flex flex-wrap justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save email"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const EDITING_MODE_HINTS: Record<EditingMode, string> = {
  open: "Any Member can edit or delete any Expense or Settlement.",
  "own-records-only":
    "Members can edit or delete only the Expenses and Settlements they recorded. The Group Creator can edit or delete everything, including records no one is known to have recorded, and alone changes the Group's details, Categories and Members.",
};

const modeChipClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border-input bg-surface px-4 py-1 text-sm font-semibold transition-colors duration-(--duration-fast) has-checked:border-accent has-checked:bg-accent-subtle has-focus-visible:ring-[3px] has-focus-visible:ring-ring has-disabled:pointer-events-none has-disabled:opacity-50";

/**
 * The Group's Editing Mode: every Member sees it; only the Group Creator can
 * change it, and anyone else sees why they can't.
 */
export function EditingModeSection({
  group,
  block,
  onSave,
  onSaved,
}: {
  group: GroupSnapshot;
  /** Why the visitor can't change the Editing Mode, or `null`. */
  block: string | null;
  onSave: (mode: EditingMode) => Promise<ManageResult>;
  onSaved: () => void;
}) {
  const saved = editingModeOf(group);
  const [mode, setMode] = useState<EditingMode>(saved);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const id = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await attempt(() => onSave(mode));
      if (result.ok) onSaved();
      else setError(result.errors.form ?? "Couldn't change the Editing Mode.");
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-lg font-bold">
        Editing Mode
      </h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <fieldset disabled={block !== null} aria-describedby={`${id}-hint`}>
          <legend className="sr-only">Editing Mode</legend>
          <div className="flex flex-wrap gap-2">
            {EDITING_MODES.map((option) => (
              <label key={option} className={modeChipClass}>
                <input
                  type="radio"
                  name="editingMode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                  className="sr-only"
                />
                {EDITING_MODE_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>
        <p id={`${id}-hint`} className="text-sm text-text-secondary">
          {EDITING_MODE_HINTS[mode]}
          {block && ` ${block}`}
        </p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-error">
            {error}
          </p>
        )}
        {block === null && (
          <div>
            <Button type="submit" variant="outline" disabled={pending || mode === saved}>
              {pending ? "Saving…" : "Save Editing Mode"}
            </Button>
          </div>
        )}
      </form>
    </section>
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
