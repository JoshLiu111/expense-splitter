import { describe, expect, it } from "vitest";
import sampleData from "../../data/sample-groups.json";
import { AVATAR_COLORS } from "@/groups/group-repository";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { avatarFill, contrastRatio, MemberAvatar, textColourOn } from "./member-avatar";

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

describe("MemberAvatar", () => {
  const maya = { name: "Maya Chen", avatarColor: "#3B82F6" };
  const render = (member: Parameters<typeof MemberAvatar>[0]["member"]) =>
    renderToStaticMarkup(createElement(MemberAvatar, { member }));

  it("shows a Member with no avatar image as their coloured initials", () => {
    const html = render(maya);

    expect(html).toContain(">MC<");
    expect(html).not.toContain("<img");
  });

  it("shows a Member's avatar image, named for the Member, over their initials until it loads", () => {
    const html = render({ ...maya, avatarUrl: "https://blob.example/maya.webp" });

    expect(html).toMatch(/<img [^>]*alt="Maya Chen"/);
    expect(html).toMatch(/<img [^>]*src="https:\/\/blob.example\/maya.webp"/);
    // The initials stay underneath, shown while the image loads or if it fails.
    expect(html).toContain(">MC<");
  });
});
