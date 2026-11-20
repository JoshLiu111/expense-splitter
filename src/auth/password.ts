/** Shortest password Better Auth accepts; shown as a hint on sign-up. */
export const MIN_PASSWORD_LENGTH = 8;

/** Longest password Better Auth accepts. */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Why a new password breaks the password rules, or `undefined` if it keeps
 * them. Sign-up, password reset and change password all ask this one rule.
 */
export function passwordRuleError(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use a password of ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  return undefined;
}
