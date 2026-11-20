import { describe, expect, it } from "vitest";
import { displayNameRuleError } from "./display-name";

describe("displayNameRuleError", () => {
  it("asks for a name when there is none", () => {
    expect(displayNameRuleError("")).toBe("Enter your name.");
  });

  it("accepts a name of up to 60 characters and refuses a longer one", () => {
    expect(displayNameRuleError("M".repeat(60))).toBeUndefined();
    expect(displayNameRuleError("M".repeat(61))).toBe("Keep the name to 60 characters or fewer.");
  });
});
