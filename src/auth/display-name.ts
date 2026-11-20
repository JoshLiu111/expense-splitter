import { MAX_MEMBER_NAME_LENGTH } from "@/domain";

/** Longest display name: it is shown as a Member name, so it keeps to the same limit. */
export const MAX_DISPLAY_NAME_LENGTH = MAX_MEMBER_NAME_LENGTH;

/**
 * Why a User's display name (already trimmed) breaks the rules, or
 * `undefined` if it keeps them. Sign-up and Account Settings both ask this
 * one rule.
 */
export function displayNameRuleError(name: string): string | undefined {
  if (!name) return "Enter your name.";
  if (name.length > MAX_DISPLAY_NAME_LENGTH) return `Keep the name to ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`;
  return undefined;
}
