import { describe, expect, it } from "vitest";
import { verbFor } from "./format";

describe("verbFor", () => {
  it("agrees with a Member's name", () => {
    expect(verbFor("Sam", "pays", "pay")).toBe("pays");
    expect(verbFor("Taylor", "is", "are")).toBe("is");
  });

  it("takes the base form after a Guest's own Member, named You", () => {
    expect(verbFor("You", "pays", "pay")).toBe("pay");
    expect(verbFor("You", "is", "are")).toBe("are");
  });

  it("goes by the exact name, not one that starts with You", () => {
    expect(verbFor("Young", "owes", "owe")).toBe("owes");
  });
});
