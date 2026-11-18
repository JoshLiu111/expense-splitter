import type { Member } from "@/domain";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Picks whichever of near-black or white has more contrast on the colour. */
function textColourOn(hex: string): string {
  const l = relativeLuminance(hex);
  const onDark = 1.05 / (l + 0.05);
  const onLight = (l + 0.05) / (0.0039 + 0.05);
  return onDark >= onLight ? "#ffffff" : "#0a0d13";
}

export function MemberAvatar({
  member,
}: {
  member: Pick<Member, "name" | "avatarColor">;
}) {
  return (
    <span
      aria-hidden
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{ backgroundColor: member.avatarColor, color: textColourOn(member.avatarColor) }}
    >
      {initials(member.name)}
    </span>
  );
}
