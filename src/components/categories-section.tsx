"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { AlertDialog, Dialog } from "radix-ui";
import { Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import {
  categoryDeletionBlock,
  MAX_CATEGORY_NAME_LENGTH,
  type CustomCategory,
  type GroupSnapshot,
} from "@/domain";
import type { CategoryFields, CategoryManagement, CategoryResult } from "@/categories/manage-categories";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";

const OFFLINE: CategoryResult = {
  ok: false,
  errors: { form: "Couldn't save the change. Check your connection and try again." },
};

async function attempt(call: () => Promise<CategoryResult>): Promise<CategoryResult> {
  try {
    return await call();
  } catch {
    return OFFLINE;
  }
}

const dialogClass =
  "fixed top-1/2 left-1/2 z-50 max-h-[92dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg outline-none";

/**
 * The Group's Custom Categories, visible only in this Group: add one,
 * rename it, or delete it once no Expense uses it.
 */
export function CategoriesSection({
  group,
  categories,
  onNews,
}: {
  group: GroupSnapshot;
  categories: CategoryManagement;
  onNews: (news: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState("");
  const custom = group.customCategories ?? [];

  async function remove(category: CustomCategory) {
    setError("");
    const result = await attempt(() => categories.delete(category.id));
    if (result.ok) onNews(`Deleted the Category ${category.name}.`);
    else setError(result.errors.form ?? `Couldn't delete ${category.name}.`);
    heading.current?.focus();
  }

  return (
    <section aria-labelledby="categories-heading">
      <h2
        id="categories-heading"
        ref={heading}
        tabIndex={-1}
        className="rounded-md text-lg font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        Categories
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        The nine standard Categories are always available. Categories you add here exist only in
        this Group.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {error}
        </p>
      )}
      {custom.length > 0 && (
        <ul className="mt-3 divide-y divide-border-subtle rounded-lg border border-border bg-surface">
          {custom.map((category) => {
            const block = categoryDeletionBlock(group, category.id);
            return (
              <li
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 font-semibold break-words">
                  <Tag aria-hidden className="size-4 shrink-0 text-text-secondary" />
                  {category.name}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <RenameCategory
                    category={category}
                    onRename={(fields) => categories.rename(category.id, fields)}
                    onRenamed={(name) => onNews(`Renamed ${category.name} to ${name}.`)}
                  />
                  {block ? (
                    <span className="text-sm text-text-secondary">{block}</span>
                  ) : (
                    <ConfirmDeleteCategory category={category} onConfirm={() => remove(category)} />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <AddCategoryForm onAdd={categories.add} onAdded={(name) => onNews(`Added the Category ${name}.`)} />
    </section>
  );
}

function AddCategoryForm({
  onAdd,
  onAdded,
}: {
  onAdd: CategoryManagement["add"];
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
      const result = await attempt(() => onAdd({ name }));
      if (result.ok) {
        onAdded(name.trim());
        setName("");
        setError(undefined);
      } else setError(result.errors.name ?? result.errors.form ?? "Couldn't add the Category.");
      input.current?.focus();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <Field id={id} label="Add a Category" error={error}>
          {(describedBy, className) => (
            <input
              ref={input}
              id={id}
              autoComplete="off"
              maxLength={MAX_CATEGORY_NAME_LENGTH}
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
        <Plus aria-hidden /> Add Category
      </Button>
    </form>
  );
}

function RenameCategory({
  category,
  onRename,
  onRenamed,
}: {
  category: CustomCategory;
  onRename: (fields: CategoryFields) => Promise<CategoryResult>;
  onRenamed: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const id = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await attempt(() => onRename({ name }));
      if (result.ok) {
        setOpen(false);
        onRenamed(name.trim());
      } else setError(result.errors.name ?? result.errors.form ?? "Couldn't rename the Category.");
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(category.name);
          setError(undefined);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="quiet" aria-label={`Rename ${category.name}`}>
          <Pencil aria-hidden /> Rename
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className={dialogClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Dialog.Title className="text-lg font-bold break-words">Rename {category.name}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-text-secondary">
            Expenses in this Category show the new name.
          </Dialog.Description>
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <Field id={id} label="Name" error={error}>
              {(describedBy, className) => (
                <input
                  id={id}
                  autoComplete="off"
                  maxLength={MAX_CATEGORY_NAME_LENGTH}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                {pending ? "Saving…" : "Save name"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ConfirmDeleteCategory({ category, onConfirm }: { category: CustomCategory; onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="quiet" aria-label={`Delete ${category.name}`}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Content className={dialogClass}>
          <AlertDialog.Title className="text-lg font-bold break-words">
            Delete the Category {category.name}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-text-secondary">
            No Expense uses it. It will no longer be offered in this Group.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button onClick={onConfirm} className="bg-error text-white hover:bg-error/90">
                Delete Category
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
