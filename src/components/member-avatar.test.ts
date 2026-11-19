import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { AVATAR_COLORS } from "@/groups/group-repository";
import { avatarFill, contrastRatio, textColourOn } from "./member-avatar";

const sampleColours = JSON.stringify(sampleData).match(/#[0-9A-Fa-f]{6}/g) ?? [];

describe("avatarFill", () => {
  it.each([...new Set([...AVATAR_COLORS, ...sampleColours])])("gives %s initials at least 4.5:1", (colour) => {
    const fill = avatarFill(colour);
    expect(contrastRatio(fill, textColourOn(fill))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a colour that already passes", () => {
    expect(avatarFill("#3B82F6")).toBe("#3B82F6");
  });

  it("darkens #6366F1 only slightly, keeping it indigo", () => {
    const fill = avatarFill("#6366F1");
    expect(fill).not.toBe("#6366F1");
    expect(textColourOn(fill)).toBe("#ffffff");
    expect(contrastRatio(fill, "#ffffff")).toBeLessThan(5);
  });
});
