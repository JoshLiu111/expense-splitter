"use client";

import Link from "next/link";
import { History, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { formatMoney, type Expense, type GroupSnapshot, type NewExpenseFields } from "@/domain";
import type { TodaysRatesState } from "@/rates/use-todays-rates";
import type { ExpenseResult } from "@/expenses/save-expense";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ExpenseForm } from "@/components/expense-form";
import { RecordedBy } from "@/components/recorded-by";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/components/use-media-query";

interface ExpenseEditorProps {
  group: GroupSnapshot;
  /** The Expense being edited, or `null` to add one. */
  expense: Expense | null;
  rates: TodaysRatesState;
  currentMemberId: string | undefined;
  /** Where "View changes" leads: Activity, at this Expense's entries. */
  changesHref: (expense: Expense) => string;
  onSave: (fields: NewExpenseFields) => Promise<ExpenseResult>;
  onClose: () => void;
  onSaved: () => void;
  /** Deletes the Expense being edited, once confirmed. */
  onDelete: (expense: Expense) => void;
  /** Why the visitor can't edit the Expense being edited, or `null`: it is then shown read-only. */
  editBlock: string | null;
  /** Why the visitor can't delete it, or `null`: Delete is then left out. */
  deleteBlock: string | null;
}

/**
 * Expense entry: an inline panel on wide screens (no modal for a routine
 * action), an accessible bottom sheet on phones. The sheet traps focus and
 * returns it to whatever opened it. An existing Expense can be deleted from
 * here, after confirmation, and its changes viewed in Activity, and says
 * who recorded it. One the Editing Mode keeps the visitor from editing is
 * shown read-only, saying why.
 */
export function ExpenseEditor(props: ExpenseEditorProps) {
  const wide = useMediaQuery("(min-width: 48rem)");
  const { expense } = props;
  const title = !expense ? "Add Expense" : props.editBlock ? "Expense" : "Edit Expense";
  // At the panel's edge it pulls its padding back so the text lines up. The
  // editor closes as it goes, so the Group page isn't left behind a sheet
  // when it is kept for coming back.
  const viewChanges = (className?: string) =>
    expense && (
      <Button asChild variant="quiet" className={className}>
        <Link href={props.changesHref(expense)} onClick={props.onClose}>
          <History aria-hidden /> View changes
        </Link>
      </Button>
    );
  const recordedBy = expense && (
    <RecordedBy
      group={props.group}
      recorderId={expense.recorderId}
      currentMemberId={props.currentMemberId}
      className="-mt-2 mb-4"
    />
  );
  const form = (
    <ExpenseForm
      key={expense?.id ?? "new"}
      group={props.group}
      expense={expense}
      rates={props.rates}
      currentMemberId={props.currentMemberId}
      onSave={props.onSave}
      onCancel={props.onClose}
      onSaved={props.onSaved}
      editBlock={props.editBlock}
      deleteAction={
        expense &&
        !props.deleteBlock && (
          <ConfirmDelete
            title="Delete this Expense?"
            confirmLabel="Delete Expense"
            onConfirm={() => props.onDelete(expense)}
          >
            “{expense.description}” (
            <span className="amount">{formatMoney(expense.amount, expense.currency)}</span>)
          </ConfirmDelete>
        )
      }
    />
  );

  if (wide) {
    return (
      <section
        aria-labelledby="expense-editor-heading"
        className="rounded-lg border border-accent bg-surface p-6 shadow-md"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="expense-editor-heading" className="text-lg font-bold">
            {title}
          </h2>
          {viewChanges("-mr-3")}
        </div>
        {recordedBy}
        {form}
      </section>
    );
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          aria-describedby={undefined}
          // The Group page returns focus itself: to the opener, or after a delete to the list.
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-xl border-t border-border bg-surface px-4 pt-2 pb-6 shadow-lg outline-none"
        >
          <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-border-input" />
          <div className="mb-4 flex items-center justify-between gap-2">
            <Dialog.Title className="mr-auto text-lg font-bold">{title}</Dialog.Title>
            {viewChanges()}
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          {recordedBy}
          {form}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
