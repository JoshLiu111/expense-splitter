const DISMISSED_KEY = "expense-splitter:guest:sign-up-prompt-dismissed";

/**
 * Whether the Guest has dismissed the sign-up prompt. Dismissal lasts for the
 * browser session, like the Guest's Groups: a new session prompts again.
 */
export function isSignUpPromptDismissed(storage: Storage): boolean {
  return storage.getItem(DISMISSED_KEY) !== null;
}

/** Hides the sign-up prompt for the rest of the browser session. */
export function dismissSignUpPrompt(storage: Storage): void {
  storage.setItem(DISMISSED_KEY, "1");
}
