import {
  amountText,
  computeLedger,
  parseNewSettlement,
  recordChangeBlock,
  type CalendarDate,
  type NewSettlementErrors,
  type NewSettlementFields,
  type Visitor,
} from "@/domain";
import type { TodaysRates } from "@/expenses/save-expense";
import type { GroupRepository } from "@/groups/group-repository";

/** What the Settle up controls show after they act. */
export type SettlementResult =
  | { ok: true }
  | { ok: false; errors: NewSettlementErrors & { form?: string } };

/** The Settle up operations a Group page can call, bound to one Group. */
export interface SettleUp {
  record(fields: NewSettlementFields): Promise<SettlementResult>;
  delete(settlementId: string): Promise<SettlementResult>;
  /** `date`: today where the visitor is. */
  clearSmallChange(date: CalendarDate): Promise<SettlementResult>;
}

const GROUP_GONE = "This Group is no longer available.";
const formError = (form: string): SettlementResult => ({ ok: false, errors: { form } });

/** Form fields from an untrusted caller: anything but text becomes empty. */
function settlementFields(input: unknown): NewSettlementFields {
  const record = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : "");
  return {
    fromId: text("fromId"),
    toId: text("toId"),
    amount: text("amount"),
    currency: text("currency"),
    rate: text("rate"),
    date: text("date"),
  };
}

/**
 * Records a Settlement after Validate Settlement against the Group as
 * stored now, so a stale form can never settle a debt that's already gone.
 * A Settlement in another Settlement Currency gets Today's Rate from `rates`
 * as its Locked Rate, unless a rate was typed.
 */
export async function recordSettlement(
  repo: GroupRepository,
  groupId: string,
  input: unknown,
  rates: TodaysRates,
): Promise<SettlementResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const fields = settlementFields(input);
  const needsRate = fields.currency !== group.currency && fields.rate.trim() === "";
  const parsed = parseNewSettlement(fields, group, needsRate ? await rates() : null);
  if (!parsed.ok) return parsed;
  return (await repo.addSettlement(groupId, parsed.value)) ? { ok: true } : formError(GROUP_GONE);
}

const SETTLEMENT_GONE = "This Settlement no longer exists. It may have been deleted.";

/** Deletes a Settlement, if the Editing Mode lets `visitor` delete it. */
export async function deleteSettlement(
  repo: GroupRepository,
  groupId: string,
  settlementId: string,
  visitor: Visitor,
): Promise<SettlementResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const existing = group.settlements.find((s) => s.id === settlementId);
  if (!existing) return formError(SETTLEMENT_GONE);
  const block = recordChangeBlock(group, visitor, "delete-settlement", existing);
  if (block) return formError(block);
  return (await repo.deleteSettlement(groupId, settlementId)) ? { ok: true } : formError(SETTLEMENT_GONE);
}

/**
 * Records the Settlements that clear Small Change, once nothing larger is
 * left to settle, so the Group can reach Settled Up.
 */
export async function clearSmallChange(
  repo: GroupRepository,
  groupId: string,
  date: unknown,
): Promise<SettlementResult> {
  const group = await repo.getGroup(groupId);
  if (!group) return formError(GROUP_GONE);
  const ledger = computeLedger(group);
  if (ledger.settledUp) return formError("Everyone is already Settled Up.");
  if (ledger.suggestions.length > 0) return formError("There's more than Small Change left to settle.");

  for (const payment of ledger.smallChange) {
    // Each one goes through Validate Settlement against the Group as it is
    // after the ones before it. Small Change is always in the Group Currency.
    const result = await recordSettlement(
      repo,
      groupId,
      {
        fromId: payment.fromId,
        toId: payment.toId,
        amount: amountText(payment.amount, group.currency),
        currency: group.currency,
        rate: "",
        date: typeof date === "string" ? date : "",
      },
      async () => null,
    );
    if (!result.ok) return result;
  }
  return { ok: true };
}
