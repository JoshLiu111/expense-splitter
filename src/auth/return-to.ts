/** Where to go after signing in when no `next` path was given. */
export const DEFAULT_RETURN_TO = "/dashboard";

/**
 * A same-site path to return to after signing in. Anything that could leave
 * the site (absolute URLs, protocol-relative `//host`, backslashes) is
 * replaced with the dashboard.
 */
export function safeReturnTo(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return DEFAULT_RETURN_TO;
  // Browsers drop tabs and newlines from URLs, so "/\t/evil.com" would become
  // "//evil.com"; refuse any control character or backslash outright.
  if (next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return DEFAULT_RETURN_TO;
  return next;
}

export function signInPath(returnTo: string): string {
  return `/sign-in?next=${encodeURIComponent(returnTo)}`;
}
