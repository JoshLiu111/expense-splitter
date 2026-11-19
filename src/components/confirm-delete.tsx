"use client";

import { AlertDialog } from "radix-ui";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A Delete button that asks for confirmation before `onConfirm` runs. The
 * button reads `confirmLabel`, as does the confirming action.
 */
export function ConfirmDelete({
  title,
  confirmLabel,
  children,
  onConfirm,
}: {
  title: string;
  /** "Delete Expense": the trigger and the confirming action. */
  confirmLabel: string;
  /** What will be removed, for the dialog's description. */
  children: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="quiet">
          <Trash2 aria-hidden /> {confirmLabel}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-lg outline-none">
          <AlertDialog.Title className="text-lg font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-text-secondary">
            {children} will be removed and Balances recomputed. This can&apos;t be undone.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button onClick={onConfirm} className="bg-error text-white hover:bg-error/90">
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
