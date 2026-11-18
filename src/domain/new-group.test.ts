import { describe, expect, it } from "vitest";
import { parseNewGroup } from "./new-group";

describe("parseNewGroup", () => {
  it("accepts a name and defaults the Group Currency to USD", () => {
    expect(parseNewGroup({ name: "Flat 3B", description: "", currency: "" })).toEqual({
      ok: true,
      value: { name: "Flat 3B", description: "", currency: "USD" },
    });
  });

  it("trims the name and description and keeps a chosen Group Currency", () => {
    expect(
      parseNewGroup({ name: "  Lisbon trip ", description: " June ", currency: "EUR" }),
    ).toEqual({
      ok: true,
      value: { name: "Lisbon trip", description: "June", currency: "EUR" },
    });
  });

  it("rejects a blank name with a specific message", () => {
    expect(parseNewGroup({ name: "   ", description: "", currency: "USD" })).toEqual({
      ok: false,
      errors: { name: "Enter a name for the Group." },
    });
  });

  it("rejects a name over 80 characters", () => {
    expect(parseNewGroup({ name: "x".repeat(81), description: "", currency: "USD" })).toEqual({
      ok: false,
      errors: { name: "Keep the name to 80 characters or fewer." },
    });
  });

  it("rejects a description over 500 characters", () => {
    expect(
      parseNewGroup({ name: "Flat", description: "x".repeat(501), currency: "USD" }),
    ).toEqual({
      ok: false,
      errors: { description: "Keep the description to 500 characters or fewer." },
    });
  });

  it("rejects an unsupported currency", () => {
    expect(parseNewGroup({ name: "Flat", description: "", currency: "BTC" })).toEqual({
      ok: false,
      errors: { currency: "Choose one of the supported currencies." },
    });
  });
});
