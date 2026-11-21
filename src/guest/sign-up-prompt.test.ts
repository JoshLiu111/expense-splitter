import { describe, expect, it } from "vitest";
import { memoryStorage } from "@/lib/memory-storage";
import { dismissSignUpPrompt, isSignUpPromptDismissed } from "./sign-up-prompt";

describe("Guest sign-up prompt", () => {
  it("shows until the Guest dismisses it", () => {
    const storage = memoryStorage();
    expect(isSignUpPromptDismissed(storage)).toBe(false);

    dismissSignUpPrompt(storage);

    expect(isSignUpPromptDismissed(storage)).toBe(true);
  });

  it("stays dismissed for the rest of the browser session", () => {
    const storage = memoryStorage();
    dismissSignUpPrompt(storage);
    // A later page in the same session reads the same Storage afresh.
    expect(isSignUpPromptDismissed(storage)).toBe(true);
    expect(isSignUpPromptDismissed(memoryStorage())).toBe(false);
  });

  it("doesn't touch the Guest's Groups when dismissed", () => {
    const storage = memoryStorage();
    storage.setItem("expense-splitter:guest:v4", "groups");
    dismissSignUpPrompt(storage);
    expect(storage.getItem("expense-splitter:guest:v4")).toBe("groups");
  });
});
