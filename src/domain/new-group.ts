import { isCurrencyCode } from "./currency";
import type { CurrencyCode } from "./types";

export const DEFAULT_GROUP_CURRENCY: CurrencyCode = "USD";
export const MAX_GROUP_NAME_LENGTH = 80;
export const MAX_GROUP_DESCRIPTION_LENGTH = 500;

export interface NewGroup {
  name: string;
  description: string;
  currency: CurrencyCode;
}

export interface NewGroupFields {
  name: string;
  description: string;
  currency: string;
}

export type ParseResult =
  | { ok: true; value: NewGroup }
  | { ok: false; errors: Partial<Record<keyof NewGroupFields, string>> };

/** Validates the fields of a Group about to be created. */
export function parseNewGroup(fields: NewGroupFields): ParseResult {
  const name = fields.name.trim();
  const description = fields.description.trim();
  const currency = fields.currency.trim() || DEFAULT_GROUP_CURRENCY;
  const errors: Partial<Record<keyof NewGroupFields, string>> = {};

  if (name === "") errors.name = "Enter a name for the Group.";
  else if (name.length > MAX_GROUP_NAME_LENGTH)
    errors.name = `Keep the name to ${MAX_GROUP_NAME_LENGTH} characters or fewer.`;
  if (description.length > MAX_GROUP_DESCRIPTION_LENGTH)
    errors.description = `Keep the description to ${MAX_GROUP_DESCRIPTION_LENGTH} characters or fewer.`;
  if (!isCurrencyCode(currency)) errors.currency = "Choose one of the supported currencies.";

  if (Object.keys(errors).length > 0 || !isCurrencyCode(currency)) return { ok: false, errors };
  return { ok: true, value: { name, description, currency } };
}
