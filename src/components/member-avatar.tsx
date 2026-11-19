import type { Member } from "@/domain";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const DARK_TEXT = "#0a0d13";
/** WCAG AA for normal text; initials are small, so they get no large-text allowance. */
const AA = 4.5;

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks whichever of near-black or white has more contrast on the colour. */
export function textColourOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, DARK_TEXT) ? "#ffffff" : DARK_TEXT;
}

/**
 * The colour to paint a Member's avatar: their own colour, or, when neither
 * white nor near-black initials reach AA on it (e.g. #6366F1), that colour
 * darkened just enough for white initials to. Avatar colours are stored per
 * Member, so this applies to existing Members and sample data alike.
 */
export function avatarFill(hex: string): string {
  let rgb = channels(hex);
  let fill = hex;
  while (contrastRatio(fill, textColourOn(fill)) < AA) {
    rgb = rgb.map((c) => Math.floor(c * 0.97));
    fill = `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }
  return fill;
}

export function MemberAvatar({
  member,
  size = "md",
}: {
  member: Pick<Member, "name" | "avatarColor">;
  size?: "sm" | "md";
}) {
  const fill = avatarFill(member.avatarColor);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${size === "sm" ? "size-8 text-xs" : "size-9 text-sm"}`}
      style={{ backgroundColor: fill, color: textColourOn(fill) }}
    >
      {initials(member.name)}
    </span>
  );
}
