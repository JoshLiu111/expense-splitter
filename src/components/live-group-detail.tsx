"use client";

import { startTransition, useOptimistic, type ComponentProps } from "react";
import { GroupDetail } from "@/components/group-detail";
import { deleteExpense, saveExpense } from "@/expenses/save-expense";
import { applyLocally } from "@/groups/apply-locally";
import type { GroupRepository } from "@/groups/group-repository";
import { fetchTodaysRates } from "@/rates/use-todays-rates";
import { clearSmallChange, deleteSettlement, recordSettlement } from "@/settlements/settle-up";

/**
 * A signed-in User's Group page. Each write is first made on a copy of the
 * Group in the browser, so Balances change at once instead of after the
 * Server Action's round-trip. The refreshed Group then replaces the copy; if
 * the server refuses, the Group as it was comes back with the server's error.
 * Entries only the copy has can't be opened yet, since the server gives them
 * their ids. A write the copy refuses goes to the server as is, since the
 * server's Group may be newer.
 */
export function LiveGroupDetail({
  group,
  onSaveExpense,
  onDeleteExpense,
  settleUp,
  ...props
}: ComponentProps<typeof GroupDetail>) {
  const [shown, show] = useOptimistic(group);
  const confirmed = new Set([...group.expenses, ...group.settlements].map((entry) => entry.id));
  const unconfirmed = new Set(
    [...shown.expenses, ...shown.settlements].map((entry) => entry.id).filter((id) => !confirmed.has(id)),
  );

  async function write<Result extends { ok: boolean }>(
    local: (repo: GroupRepository, groupId: string) => Promise<Result>,
    server: () => Promise<Result>,
  ): Promise<Result> {
    const applied = await applyLocally(shown, local);
    if (!applied.result.ok) return server();
    return new Promise<Result>((resolve, reject) => {
      startTransition(async () => {
        show(applied.group);
        try {
          resolve(await server());
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  return (
    <GroupDetail
      {...props}
      group={shown}
      unconfirmed={unconfirmed}
      onSaveExpense={(expenseId, fields) =>
        write(
          (repo, groupId) => saveExpense(repo, groupId, expenseId, fields, fetchTodaysRates),
          () => onSaveExpense(expenseId, fields),
        )
      }
      onDeleteExpense={(expenseId) =>
        write(
          (repo, groupId) => deleteExpense(repo, groupId, expenseId),
          () => onDeleteExpense(expenseId),
        )
      }
      settleUp={{
        record: (fields) =>
          write(
            (repo, groupId) => recordSettlement(repo, groupId, fields),
            () => settleUp.record(fields),
          ),
        delete: (settlementId) =>
          write(
            (repo, groupId) => deleteSettlement(repo, groupId, settlementId),
            () => settleUp.delete(settlementId),
          ),
        clearSmallChange: (date) =>
          write(
            (repo, groupId) => clearSmallChange(repo, groupId, date),
            () => settleUp.clearSmallChange(date),
          ),
      }}
    />
  );
}
